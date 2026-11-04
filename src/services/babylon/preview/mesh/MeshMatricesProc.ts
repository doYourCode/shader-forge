import { Matrix, Mesh, ShaderMaterial } from "@babylonjs/core";

export function calculateNormalMatrix(mesh: Mesh): Matrix {
    const worldMatrix = mesh.getWorldMatrix();

    const normalMatrix = worldMatrix.clone();

    normalMatrix.invert();
    normalMatrix.transpose();

    return normalMatrix;
}

export function updateNormalMatrix(
    mesh: Mesh,
    material: ShaderMaterial,
    inverseWorld: Matrix,
    normalMatrix: Matrix
): void {
    mesh.computeWorldMatrix(true);

    // Copy the world matrix (don't modify the mesh's matrix).
    inverseWorld.copyFrom(mesh.getWorldMatrix());

    // Inverse transpose.
    inverseWorld.invert();
    Matrix.TransposeToRef(inverseWorld, normalMatrix);

    // Extract and upload the 3x3 matrix.
    material.setMatrix3x3(
        "normalMatrix",
        Matrix.GetAsMatrix3x3(normalMatrix)
    );
}