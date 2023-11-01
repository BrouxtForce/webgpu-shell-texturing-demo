import { vec3, quat, mat4, Vec3, Quat, Mat4 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";

export class Transform {
    public readonly position: Vec3;
    public readonly rotation: Quat;
    public readonly scale: Vec3;

    constructor(position: Vec3, rotation: Quat, scale: Vec3) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }

    getMatrix(): Mat4 {
        const translationMatrix = mat4.translation(this.position);
        const rotationMatrix = mat4.fromQuat(this.rotation);
        const scaleMatrix = mat4.scaling(this.scale);

        return mat4.mul(translationMatrix, mat4.mul(rotationMatrix, scaleMatrix));
    }
    
    getInverseMatrix(): Mat4 {
        const transformMatrix = this.getMatrix();
        return mat4.inverse(transformMatrix, transformMatrix);
    }

    static get identity() {
        return new Transform(vec3.zero(), quat.identity(), vec3.create(1, 1, 1));
    }
}