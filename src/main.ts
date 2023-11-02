import { quat, vec3 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
import { Camera } from "./camera.js";
import { Transform } from "./transform.js";
import { Input } from "./input.js";
import { DebugTable } from "./debug-table.js";
import { loadObj, loadObjIntoBuffers } from "./obj-loader.js";

async function main() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();

    if (!device) {
        alert("WebGPU is not supported by your browser.");
        return;
    }

    const canvas = document.querySelector(".game-canvas") as HTMLCanvasElement;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const input = new Input(canvas);
    const debugTable = new DebugTable(document.querySelector(".debug-table") as HTMLElement);

    const context = canvas.getContext("webgpu");
    if (!context) {
        alert("Failed to initialize WebGPU canvas context");
        return;
    }

    const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: preferredFormat });

    const depthTextureFormat: GPUTextureFormat = "depth32float";
    const depthTexture = device.createTexture({
        size: {
            width: canvas.width,
            height: canvas.height
        },
        format: depthTextureFormat,
        dimension: "2d",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    })

    const shaderModule = device.createShaderModule({
        label: "main shader",
        code: `
            struct CameraData {
                viewMatrix: mat4x4f,
                projectionMatrix: mat4x4f,
            };

            struct ModelData {
                modelMatrix: mat4x4f,
            };

            struct Vertex {
                @location(0) position: vec3f,
                @location(1) normal: vec3f,
            };

            struct VertexData {
                @builtin(position) position: vec4f,
                @location(0) color: vec3f,
            };

            @group(0) @binding(0) var<uniform> cameraData: CameraData;
            @group(0) @binding(1) var<uniform> modelData: ModelData;

            @vertex fn vert_main(@builtin(vertex_index) vertexId: u32, vertex: Vertex) -> VertexData {
                var out: VertexData;

                var mvpMatrix = cameraData.projectionMatrix * cameraData.viewMatrix * modelData.modelMatrix;
                out.position = mvpMatrix * vec4f(vertex.position, 1.0);

                out.color = vertex.normal;

                return out;
            }

            @fragment fn frag_main(in: VertexData) -> @location(0) vec4f {
                return vec4f(in.color, 1);
            }
        `
    });

    const cameraDataBuffer = device.createBuffer({
        size: 128, // Two mat4x4f's
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const cameraBufferData = new Float32Array(32);

    const modelDataBuffer = device.createBuffer({
        size: 64, // sizeof(mat4x4f)
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
                    arrayStride: 12, // sizeof(vec3f)
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                    ]
                },
                {
                    arrayStride: 12, // sizeof(vec3f)
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: "float32x3" }
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
        }
    });

    const { positionBuffer, indexBuffer, normalBuffer, indexCount } = await loadObjIntoBuffers(device, "assets/stanford-bunny.obj");
    if (!normalBuffer) {
        throw new Error("Normal buffer not present in model.");
    }

    const bindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: cameraDataBuffer }},
            { binding: 1, resource: { buffer: modelDataBuffer }}
        ]
    });

    const renderPassDescriptor: GPURenderPassDescriptor = {
        label: "main render pass",
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
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

    const camera = new Camera(Transform.identity, 1, canvas.width / canvas.height, 0.1, 1000);
    let cameraRotationX = 0;
    let cameraRotationY = 0;

    const modelTransform = Transform.identity;
    vec3.mulScalar(modelTransform.scale, 15, modelTransform.scale);

    const update = () => {
        if (input.pointerIsLocked) {
            const mouseSpeed = 0.005;
            cameraRotationX -= input.mouseDelta[1] * mouseSpeed;
            cameraRotationY -= input.mouseDelta[0] * mouseSpeed;
            quat.fromEuler(cameraRotationX, cameraRotationY, 0, "zyx", camera.transform.rotation);
        }

        const movement = vec3.normalize(vec3.transformQuat(input.movement(), camera.transform.rotation));
        const movementSpeed = 0.1;
        vec3.add(vec3.mulScalar(movement, movementSpeed), camera.transform.position, camera.transform.position);

        debugTable.set("camera position", camera.transform.position);
        debugTable.set("mouse delta", input.mouseDelta);

        input.endFrame();
    };

    const render = () => {
        cameraBufferData.set(new Float32Array(camera.getViewMatrix()), 0);
        cameraBufferData.set(new Float32Array(camera.getProjectionMatrix()), 16);
        device.queue.writeBuffer(cameraDataBuffer, 0, cameraBufferData);

        device.queue.writeBuffer(modelDataBuffer, 0, new Float32Array(modelTransform.getMatrix()));
        
        // @ts-ignore shut up
        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();

        const commandEncoder = device.createCommandEncoder({ label: "main command encoder" });

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, positionBuffer);
        renderPass.setVertexBuffer(1, normalBuffer);
        renderPass.setIndexBuffer(indexBuffer, "uint32");
        renderPass.drawIndexed(indexCount);
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