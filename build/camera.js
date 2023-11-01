import { mat4 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
export class Camera {
    constructor(transform, fov, aspect, zNear, zFar) {
        this.transform = transform;
        this.fov = fov;
        this.aspect = aspect;
        this.zNear = zNear;
        this.zFar = zFar;
    }
    getViewMatrix() {
        return this.transform.getInverseMatrix();
    }
    getProjectionMatrix() {
        return mat4.perspective(this.fov, this.aspect, this.zNear, this.zFar);
    }
}
