import { mat4, Mat4 } from "../dependencies/wgpu-matrix/wgpu-matrix.js";
import { Transform } from "./transform.js";

export class Camera {
    public readonly transform: Transform;
    public fov: number;
    public aspect: number;
    public zNear: number;
    public zFar: number;

    constructor(transform: Transform, fov: number, aspect: number, zNear: number, zFar: number) {
        this.transform = transform;
        this.fov = fov;
        this.aspect = aspect;
        this.zNear = zNear;
        this.zFar = zFar;
    }

    getViewMatrix(): Mat4 {
        return this.transform.getInverseMatrix();
    }

    getProjectionMatrix(): Mat4 {
        return mat4.perspective(this.fov, this.aspect, this.zNear, this.zFar);
    }
}