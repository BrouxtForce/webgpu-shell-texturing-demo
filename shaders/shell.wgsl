struct CameraData {
    viewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
};

struct ModelData {
    modelMatrix: mat4x4f,
};

struct ShellUniforms {
    density: f32,
    thickness: f32,
    height: f32,
    shellCount: f32,
    baseColor: vec3f,
    tipColor: vec3f,
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
    @location(2) normal: vec3f,
    @location(3) @interpolate(flat) normalizedHeight: f32,
};

@group(0) @binding(0) var<uniform> cameraData: CameraData;
@group(0) @binding(1) var<uniform> modelData: ModelData;

@group(1) @binding(0) var<uniform> shellUniforms: ShellUniforms;

fn hash12(p: vec2f) -> f32
{
    var p3: vec3f = fract(p.xyx * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@vertex fn vert_main(@builtin(vertex_index) vertexId: u32, @builtin(instance_index) instanceId: u32, vertex: Vertex) -> VertexData {
    var out: VertexData;

    var normalizedHeight = f32(instanceId) / shellUniforms.shellCount;
    out.normalizedHeight = normalizedHeight;

    var height = normalizedHeight * shellUniforms.height;

    var mvpMatrix = cameraData.projectionMatrix * cameraData.viewMatrix * modelData.modelMatrix;
    out.position = mvpMatrix * vec4f(vertex.position + vertex.normal * height, 1.0);

    out.color = mix(shellUniforms.baseColor, shellUniforms.tipColor, pow(normalizedHeight, 2));
    out.normal = vertex.normal;
    out.texcoord = vertex.texcoord;

    return out;
}

@fragment fn frag_main(in: VertexData) -> @location(0) vec4f {
    var local: vec2f = fract(in.texcoord * shellUniforms.density) * 2 - 1;
    var index: vec2f = floor(in.texcoord * shellUniforms.density);
    var rand: f32 = hash12(index);

    if (in.normalizedHeight != 0) {
        var localDistanceFromCenter = sqrt(dot(local, local));
        if (localDistanceFromCenter > shellUniforms.thickness * (rand - in.normalizedHeight) || in.normalizedHeight > rand) {
            discard;
        }
    }

    var ndotl: f32 = saturate(dot(in.normal, normalize(vec3f(1, 1, 1)))) * 0.5 + 0.5;

    return vec4f(in.color * ndotl * ndotl, 1);
}
