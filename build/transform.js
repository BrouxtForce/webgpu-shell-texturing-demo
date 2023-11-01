import { vec3, quat, mat4 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
export class Transform {
    constructor(position, rotation, scale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
    getMatrix() {
        const translationMatrix = mat4.translation(this.position);
        const rotationMatrix = mat4.fromQuat(this.rotation);
        const scaleMatrix = mat4.scaling(this.scale);
        return mat4.mul(translationMatrix, mat4.mul(rotationMatrix, scaleMatrix));
    }
    getInverseMatrix() {
        const transformMatrix = this.getMatrix();
        return mat4.inverse(transformMatrix, transformMatrix);
    }
    static get identity() {
        return new Transform(vec3.zero(), quat.identity(), vec3.create(1, 1, 1));
    }
}
