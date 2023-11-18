import { quat, vec3 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
import { Camera } from "./camera.js";
import { Transform } from "./transform.js";
import { Input } from "./input.js";
import { DebugTable } from "./debug-table.js";
import { loadObjIntoBuffers } from "./obj-loader.js";
async function main() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
        alert("WebGPU is not supported by your browser.");
        return;
    }
    const settings = await (await fetch("../assets/settings.json", { cache: "no-store" })).json();
    const canvas = document.querySelector(".game-canvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const input = new Input(canvas);
    const debugTable = new DebugTable(document.querySelector(".debug-table"));
    const context = canvas.getContext("webgpu");
    if (!context) {
        alert("Failed to initialize WebGPU canvas context");
        return;
    }
    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: preferredFormat });
    const canvasMultisampleTexture = device.createTexture({
        size: {
            width: canvas.width,
            height: canvas.height
        },
        sampleCount: 4,
        format: preferredFormat,
        dimension: "2d",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const canvasMultisampleView = canvasMultisampleTexture.createView();
    const depthTextureFormat = "depth32float";
    const depthTexture = device.createTexture({
        size: {
            width: canvas.width,
            height: canvas.height
        },
        sampleCount: 4,
        format: depthTextureFormat,
        dimension: "2d",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const cubemapPaths = settings["cubemap-paths"];
    if (cubemapPaths?.length !== 6) {
        throw new Error("Invalid cubemap.");
    }
    const bitmapPromises = cubemapPaths.map(async (path) => {
        const blob = await (await fetch(path)).blob();
        return createImageBitmap(blob);
    });
    const bitmaps = await Promise.all(bitmapPromises);
    const cubemapTexture = device.createTexture({
        dimension: "2d",
        size: [bitmaps[0].width, bitmaps[1].height, 6],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    for (let i = 0; i < bitmaps.length; i++) {
        device.queue.copyExternalImageToTexture({ source: bitmaps[i] }, { texture: cubemapTexture, origin: [0, 0, i] }, [bitmaps[i].width, bitmaps[i].height]);
    }
    const cubemapSampler = device.createSampler({
        minFilter: "linear",
        magFilter: "linear"
    });
    const cubemapShaderSource = await (await fetch("../shaders/cubemap.wgsl", { cache: "no-store" })).text();
    const cubemapShaderModule = device.createShaderModule({
        label: "cubemap shader",
        code: cubemapShaderSource
    });
    const shaderSource = await (await fetch("../shaders/shell.wgsl", { cache: "no-store" })).text();
    const shaderModule = device.createShaderModule({
        label: "main shader",
        code: shaderSource
    });
    const cameraDataBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const cameraBufferData = new Float32Array(32);
    const modelDataBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const cameraBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } },
        ]
    });
    const modelDataBindGroupLayout = cameraBindGroupLayout;
    const shellUniformsBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        ]
    });
    const cubemapTextureBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: "cube" } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        ]
    });
    const cubemapRenderPipeline = device.createRenderPipeline({
        label: "cubemap pipeline",
        layout: device.createPipelineLayout({
            bindGroupLayouts: [
                cameraBindGroupLayout,
                cubemapTextureBindGroupLayout
            ]
        }),
        vertex: {
            module: cubemapShaderModule,
            entryPoint: "cubemap_vert"
        },
        fragment: {
            module: cubemapShaderModule,
            entryPoint: "cubemap_frag",
            targets: [{ format: preferredFormat }]
        },
        multisample: {
            count: 4
        }
    });
    const renderPipeline = device.createRenderPipeline({
        label: "main pipeline",
        layout: device.createPipelineLayout({
            bindGroupLayouts: [
                cameraBindGroupLayout,
                modelDataBindGroupLayout,
                shellUniformsBindGroupLayout,
            ]
        }),
        vertex: {
            module: shaderModule,
            entryPoint: "vert_main",
            buffers: [
                {
                    arrayStride: 12,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                    ]
                },
                {
                    arrayStride: 12,
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: "float32x3" }
                    ]
                },
                {
                    arrayStride: 8,
                    attributes: [
                        { shaderLocation: 2, offset: 0, format: "float32x2" }
                    ]
                }
            ]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "frag_main",
            targets: [{ format: preferredFormat }]
        },
        depthStencil: {
            format: depthTextureFormat,
            depthWriteEnabled: true,
            depthCompare: "less"
        },
        multisample: {
            count: 4
        }
    });
    const { positionBuffer, indexBuffer, normalBuffer, texcoordBuffer, indexCount } = await loadObjIntoBuffers(device, settings["model-path"]);
    if (!normalBuffer) {
        throw new Error("Normal buffer not present in model.");
    }
    if (!texcoordBuffer) {
        throw new Error("Texcoord buffer not present in model.");
    }
    const shellUniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const shellBindGroup = device.createBindGroup({
        layout: shellUniformsBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: shellUniformBuffer } }
        ]
    });
    const cameraBindGroup = device.createBindGroup({
        layout: cameraBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: cameraDataBuffer } },
        ]
    });
    const modelDataBindGroup = device.createBindGroup({
        layout: modelDataBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: modelDataBuffer } }
        ]
    });
    const cubemapTextureBindGroup = device.createBindGroup({
        layout: cubemapTextureBindGroupLayout,
        entries: [
            { binding: 0, resource: cubemapTexture.createView({ dimension: "cube" }) },
            { binding: 1, resource: cubemapSampler }
        ]
    });
    const cubemapRenderPassDescriptor = {
        label: "cubemap render pass",
        colorAttachments: [
            {
                view: canvasMultisampleView,
                resolveTarget: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: [0, 0, 0, 0],
                storeOp: "store"
            }
        ]
    };
    const renderPassDescriptor = {
        label: "main render pass",
        colorAttachments: [
            {
                view: canvasMultisampleView,
                resolveTarget: context.getCurrentTexture().createView(),
                loadOp: "load",
                storeOp: "store"
            }
        ],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store"
        }
    };
    const camera = new Camera(Transform.identity, 1, canvas.width / canvas.height, 0.01, 1000);
    let cameraRotationX = 0;
    let cameraRotationY = 0;
    {
        const loadedCameraPosition = settings["position"] ?? vec3.zero();
        camera.transform.position[0] = loadedCameraPosition[0];
        camera.transform.position[1] = loadedCameraPosition[1];
        camera.transform.position[2] = loadedCameraPosition[2];
        const loadedCameraScale = settings["camera-scale"] ?? 1;
        vec3.set(loadedCameraScale, loadedCameraScale, loadedCameraScale, camera.transform.scale);
    }
    const modelTransform = Transform.identity;
    const update = () => {
        if (input.pointerIsLocked) {
            const mouseSpeed = 0.005;
            cameraRotationX -= input.mouseDelta[1] * mouseSpeed;
            cameraRotationY -= input.mouseDelta[0] * mouseSpeed;
            quat.fromEuler(cameraRotationX, cameraRotationY, 0, "zyx", camera.transform.rotation);
        }
        const movement = vec3.normalize(vec3.transformQuat(input.movement(), camera.transform.rotation));
        const movementSpeed = settings["camera-speed"] ?? 0.1;
        vec3.add(vec3.mulScalar(movement, movementSpeed), camera.transform.position, camera.transform.position);
        debugTable.set("camera position", camera.transform.position);
        debugTable.set("mouse delta", input.mouseDelta);
        input.endFrame();
    };
    const render = () => {
        const shellDensity = debugTable.slider("shell density", settings["shell-density"] ?? 100, 1, 1000, 1);
        const shellThickness = debugTable.slider("shell thickness", settings["shell-thickness"] ?? 1, 0, 50, 0.01);
        const shellHeight = debugTable.slider("shell height", settings["shell-height"] ?? 1, 0, 5, 0.01);
        const shellCount = debugTable.slider("shell count", settings["shell-count"] ?? 16, 1, 256, 1);
        const shellBaseColor = debugTable.slider3("shell base color", settings["shell-base-color"] ?? [0, 0, 0], 0, 1, 0.01);
        const shellTipColor = debugTable.slider3("shell tip color", settings["shell-tip-color"] ?? [1, 1, 1], 0, 1, 0.01);
        const shellDisplacement = debugTable.slider3("shell displacement", settings["shell-displacement"] ?? [0, 0, 0], -1, 1, 0.01);
        const shellDistanceAttenuation = debugTable.slider("distance attenuation", settings["shell-distance-attenuation"] ?? 1, 0.01, 1, 0.01);
        const shellCurvature = debugTable.slider("shell curvature", settings["shell-curvature"] ?? 1, 0, 10, 0.01);
        device.queue.writeBuffer(shellUniformBuffer, 0, new Float32Array([
            shellDensity, shellThickness, shellHeight, shellCount,
            shellBaseColor[0], shellBaseColor[1], shellBaseColor[2], shellDistanceAttenuation,
            shellTipColor[0], shellTipColor[1], shellTipColor[2], shellCurvature,
            shellDisplacement[0], shellDisplacement[1], shellDisplacement[2], 0
        ]));
        cameraBufferData.set(new Float32Array(camera.getViewMatrix()), 0);
        cameraBufferData.set(new Float32Array(camera.getProjectionMatrix()), 16);
        device.queue.writeBuffer(cameraDataBuffer, 0, cameraBufferData);
        device.queue.writeBuffer(modelDataBuffer, 0, new Float32Array(modelTransform.getMatrix()));
        renderPassDescriptor.colorAttachments[0].resolveTarget = context.getCurrentTexture().createView();
        cubemapRenderPassDescriptor.colorAttachments[0].resolveTarget = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder({ label: "main command encoder" });
        const cubemapRenderPass = commandEncoder.beginRenderPass(cubemapRenderPassDescriptor);
        cubemapRenderPass.setPipeline(cubemapRenderPipeline);
        cubemapRenderPass.setBindGroup(0, cameraBindGroup);
        cubemapRenderPass.setBindGroup(1, cubemapTextureBindGroup);
        cubemapRenderPass.draw(36);
        cubemapRenderPass.end();
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, cameraBindGroup);
        renderPass.setBindGroup(1, modelDataBindGroup);
        renderPass.setBindGroup(2, shellBindGroup);
        renderPass.setVertexBuffer(0, positionBuffer);
        renderPass.setVertexBuffer(1, normalBuffer);
        renderPass.setVertexBuffer(2, texcoordBuffer);
        renderPass.setIndexBuffer(indexBuffer, "uint32");
        renderPass.drawIndexed(indexCount, shellCount);
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    };
    const loop = () => {
        update();
        render();
        window.requestAnimationFrame(loop);
    };
    loop();
}
main();
