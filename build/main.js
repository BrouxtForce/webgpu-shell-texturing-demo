import { quat, vec3 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
import { Camera } from "./camera.js";
import { Transform } from "./transform.js";
import { Input } from "./input.js";
import { DebugTable } from "./debug-table.js";
async function main() {
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
        alert("WebGPU is not supported by your browser.");
        return;
    }
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
    const shaderModule = device.createShaderModule({
        label: "hardcoded triangle shader",
        code: `
            struct CameraData {
                viewMatrix: mat4x4f,
                projectionMatrix: mat4x4f,
            };

            @group(0) @binding(0) var<uniform> cameraData: CameraData;

            @vertex fn vert_main(
                @builtin(vertex_index) vertexIndex : u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                );

                var viewProjectionMatrix = cameraData.projectionMatrix * cameraData.viewMatrix;
                return viewProjectionMatrix * vec4f(pos[vertexIndex], 0.0, 1.0);
            }

            @fragment fn frag_main() -> @location(0) vec4f {
                return vec4f(1.0, 0.0, 0.0, 1.0);
            }
        `
    });
    const cameraDataBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const cameraBufferData = new Float32Array(32);
    const renderPipeline = device.createRenderPipeline({
        label: "hardcoded triangle pipeline",
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vert_main"
        },
        fragment: {
            module: shaderModule,
            entryPoint: "frag_main",
            targets: [{ format: preferredFormat }]
        }
    });
    const bindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: cameraDataBuffer } }
        ]
    });
    const renderPassDescriptor = {
        label: "main render pass",
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: [0, 0, 0, 0],
                loadOp: "clear",
                storeOp: "store"
            }
        ]
    };
    const camera = new Camera(Transform.identity, 1, canvas.width / canvas.height, 0.1, 1000);
    let cameraRotationX = 0;
    let cameraRotationY = 0;
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
        cameraBufferData.set(camera.getViewMatrix(), 0);
        cameraBufferData.set(camera.getProjectionMatrix(), 16);
        device.queue.writeBuffer(cameraDataBuffer, 0, cameraBufferData);
        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder({ label: "main command encoder" });
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, bindGroup);
        renderPass.draw(3);
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
