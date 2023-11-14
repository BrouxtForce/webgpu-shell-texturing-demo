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
    const renderPipeline = device.createRenderPipeline({
        label: "main pipeline",
        layout: "auto",
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
    const shellCount = settings["shell-count"] || 16;
    const shellCoverage = settings["shell-coverage"] || 0.1;
    const shellOffsetData = new Float32Array(shellCount);
    for (let i = 0; i < shellCount; i++) {
        shellOffsetData[i] = i / (shellCount + 1) * shellCoverage;
    }
    const shellOffsetBuffer = device.createBuffer({
        size: shellOffsetData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(shellOffsetBuffer, 0, shellOffsetData);
    const shellDensity = settings["shell-density"] || 10;
    const highestShellHeight = shellOffsetData[shellOffsetData.length - 1];
    const shellThickness = settings["shell-thickness"] || 1;
    const shellBaseColor = settings["shell-base-color"] || [0, 0, 0];
    const shellTipColor = settings["shell-tip-color"] || [0, 0, 0];
    const shellUniformBuffer = device.createBuffer({
        size: 96,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(shellUniformBuffer, 0, new Float32Array([
        shellDensity, highestShellHeight, shellThickness, 0,
        shellBaseColor[0], shellBaseColor[1], shellBaseColor[2], 0,
        shellTipColor[0], shellTipColor[1], shellTipColor[2], 0
    ]));
    const shellBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: { buffer: shellOffsetBuffer } },
            { binding: 1, resource: { buffer: shellUniformBuffer } }
        ]
    });
    const bindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: cameraDataBuffer } },
            { binding: 1, resource: { buffer: modelDataBuffer } }
        ]
    });
    const renderPassDescriptor = {
        label: "main render pass",
        colorAttachments: [
            {
                view: canvasMultisampleView,
                resolveTarget: context.getCurrentTexture().createView(),
                clearValue: [0, 0, 0, 0],
                loadOp: "clear",
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
        debugTable.set("camera rotation", camera.transform.rotation);
        debugTable.set("camera scale", camera.transform.scale);
        debugTable.set("mouse delta", input.mouseDelta);
        input.endFrame();
    };
    const render = () => {
        cameraBufferData.set(new Float32Array(camera.getViewMatrix()), 0);
        cameraBufferData.set(new Float32Array(camera.getProjectionMatrix()), 16);
        device.queue.writeBuffer(cameraDataBuffer, 0, cameraBufferData);
        device.queue.writeBuffer(modelDataBuffer, 0, new Float32Array(modelTransform.getMatrix()));
        renderPassDescriptor.colorAttachments[0].resolveTarget = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder({ label: "main command encoder" });
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setBindGroup(1, shellBindGroup);
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
