export namespace ProceduralGeometry {
    interface GeometryData {
        positions: Float32Array;
        indices: Uint32Array;
        normals: Float32Array;
        texcoords: Float32Array;
    }

    interface GeometryBuffers {
        positionBuffer: GPUBuffer;
        indexBuffer: GPUBuffer;
        indexCount: number;
        normalBuffer: GPUBuffer;
        texcoordBuffer: GPUBuffer;
    }

    export function unitPlane(subdivisions: number): GeometryData {
        const vertices: number[][] = [];
        const texcoords: number[][] = [];
        const normals: number[][] = [];
        for (let x = 0; x < subdivisions + 1; x++)
        {
            for (let z = 0; z < subdivisions + 1; z++)
            {
                let normX = x / subdivisions;
                let normZ = z / subdivisions;
                vertices.push([normX, 0, normZ]);
                texcoords.push([normX, normZ]);
                normals.push([0, 1, 0]);
            }
        }

        const indices: number[] = [];
        for (let x = 0; x < subdivisions; x++)
        {
            for (let y = 0; y < subdivisions; y++)
            {
                let indexA =  y      * (subdivisions + 1) + x;
                let indexB = (y + 1) * (subdivisions + 1) + x;
                let indexC = (y + 1) * (subdivisions + 1) + x + 1;
                let indexD =  y      * (subdivisions + 1) + x + 1;

                indices.push(indexA);
                indices.push(indexB);
                indices.push(indexC);
                indices.push(indexC);
                indices.push(indexD);
                indices.push(indexA);
            }
        }

        return {
            positions: new Float32Array(vertices.flat()),
            indices: new Uint32Array(indices),
            normals: new Float32Array(normals.flat()),
            texcoords: new Float32Array(texcoords.flat())
        };
    }

    export function loadIntoBuffers(device: GPUDevice, data: GeometryData): GeometryBuffers {
        const positionBuffer = device.createBuffer({
            label: "procedural position buffer",
            size: data.positions.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(positionBuffer, 0, data.positions);

        const indexCount = data.indices.length;
        const indexBuffer = device.createBuffer({
            label: "procedural index buffer",
            size: data.indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(indexBuffer, 0, data.indices);

        const normalBuffer = device.createBuffer({
            label: "procedural normal buffer",
            size: data.normals.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(normalBuffer, 0, data.normals);

        const texcoordBuffer = device.createBuffer({
            label: "procedural texcoord buffer",
            size: data.texcoords.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(texcoordBuffer, 0, data.texcoords);

        return { positionBuffer, indexBuffer, indexCount, normalBuffer, texcoordBuffer };
    }
}