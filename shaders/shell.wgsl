struct CameraData {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
};

struct ModelData {
    modelMatrix: mat4x4f,
};

struct ShellUniforms {
    density: f32,
    highestShellHeight: f32,
};

struct Vertex {
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) texcoord: vec2f,
};

struct VertexData {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
    @location(1) texcoord: vec2f,
    @location(2) @interpolate(flat) height: f32,
};

@group(0) @binding(0) var<uniform> cameraData: CameraData;
@group(0) @binding(1) var<uniform> modelData: ModelData;

@group(1) @binding(0) var<storage, read> shellOffsets: array<f32>;
@group(1) @binding(1) var<uniform> shellUniforms: ShellUniforms;

fn hash12(p: vec2f) -> f32
{
    var p3: vec3f = fract(p.xyx * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@vertex fn vert_main(@builtin(vertex_index) vertexId: u32, @builtin(instance_index) instanceId: u32, vertex: Vertex) -> VertexData {
    var out: VertexData;

    var shellHeight = shellOffsets[instanceId];
    out.height = shellHeight;

    var mvpMatrix = cameraData.projectionMatrix * cameraData.viewMatrix * modelData.modelMatrix;
    out.position = mvpMatrix * vec4f(vertex.position + vertex.normal * shellHeight, 1.0);

    out.color = vec3f(1, 0, 0) * pow(shellHeight / shellUniforms.highestShellHeight, 2);
    out.texcoord = vertex.texcoord;

    return out;
}

@fragment fn frag_main(in: VertexData) -> @location(0) vec4f {
    var index: vec2f = floor(in.texcoord * shellUniforms.density);
    var totalHeight: f32 = hash12(index);

    if (in.height / shellUniforms.highestShellHeight > totalHeight) {
        discard;
    }
    
    return vec4f(in.color, 1);
}