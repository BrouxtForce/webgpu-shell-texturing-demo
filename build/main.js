"use strict";
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
            @vertex fn vert_main(
                @builtin(vertex_index) vertexIndex : u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f( 0.0,  0.5),  // top center
                    vec2f(-0.5, -0.5),  // bottom left
                    vec2f( 0.5, -0.5)   // bottom right
                );

                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }

            @fragment fn frag_main() -> @location(0) vec4f {
                return vec4f(1.0, 0.0, 0.0, 1.0);
            }
        `
    });
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
    const render = () => {
        renderPassDescriptor.colorAttachments[0].view = context.getCurrentTexture().createView();
        const commandEncoder = device.createCommandEncoder({ label: "main command encoder" });
        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.draw(3);
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    };
    render();
}
main();
