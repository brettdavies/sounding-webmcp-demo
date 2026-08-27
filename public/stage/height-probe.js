/**
 * GPU 1×1 height probe — samples summed cascade displacement.y at world XZ.
 * Same UV contract as ocean-material vertex displacement.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D displacement0;
  uniform sampler2D displacement1;
  uniform sampler2D displacement2;
  uniform vec3 patchLengths;
  uniform vec2 sampleXZ;
  out vec4 outputColor;

  vec4 sampleDisplacement(sampler2D map, vec2 xz, float lengthScale) {
    return texture(map, fract(xz / lengthScale));
  }

  void main() {
    vec3 displacement =
      sampleDisplacement(displacement0, sampleXZ, patchLengths.x).xyz +
      sampleDisplacement(displacement1, sampleXZ, patchLengths.y).xyz +
      sampleDisplacement(displacement2, sampleXZ, patchLengths.z).xyz;
    outputColor = vec4(displacement, 1.0);
  }
`;

export class HeightProbe {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {number[]} patchLengths
   */
  constructor(renderer, patchLengths) {
    this.renderer = renderer;
    // FloatType + Float32Array — HalfFloat readback needs Uint16Array and
    // extra decode; matches gpgpu_water-style float FBO sampling.
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        displacement0: { value: null },
        displacement1: { value: null },
        displacement2: { value: null },
        patchLengths: { value: new THREE.Vector3(...patchLengths) },
        sampleXZ: { value: new THREE.Vector2() },
      },
      vertexShader,
      fragmentShader,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
    this._pixel = new Float32Array(4);
    this.last = new THREE.Vector3();
  }

  /**
   * @param {import('../ocean/ocean-system.js').SpectralOceanSystem['cascades']} cascades
   * @param {number} x
   * @param {number} z
   * @returns {THREE.Vector3}
   */
  sample(cascades, x, z) {
    const u = this.material.uniforms;
    u.displacement0.value = cascades[0].displacement;
    u.displacement1.value = cascades[1].displacement;
    u.displacement2.value = cascades[2].displacement;
    u.sampleXZ.value.set(x, z);

    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, 1, 1, this._pixel);
    this.renderer.setRenderTarget(prev);

    this.last.set(this._pixel[0], this._pixel[1], this._pixel[2]);
    return this.last;
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
