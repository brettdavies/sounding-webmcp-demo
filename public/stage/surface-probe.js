/**
 * GPU 1×1 surface probe — samples the same displacement as ocean-material vertex shader.
 * Buoy kinematics read back (x, y, z) relative to the still-water plane.
 */
import * as THREE from 'three';
import {
  OCEAN_DISPLACEMENT_UNIFORM_KEYS,
  OCEAN_WAVE_DISPLACEMENT_GLSL,
  syncOceanDisplacementUniforms,
} from '../ocean/ocean-material.js';

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
  uniform float time;
  uniform vec2 sampleXZ;
  out vec4 outputColor;

  ${OCEAN_WAVE_DISPLACEMENT_GLSL}

  vec4 sampleDisplacement(sampler2D map, vec2 xz, float lengthScale) {
    return texture(map, fract(xz / lengthScale));
  }

  void main() {
    vec3 cascade =
      (sampleDisplacement(displacement0, sampleXZ, patchLengths.x).xyz +
       sampleDisplacement(displacement1, sampleXZ, patchLengths.y).xyz +
       sampleDisplacement(displacement2, sampleXZ, patchLengths.z).xyz) *
      cascadeScale;
    vec3 gerstner = setWaveDisplacement(sampleXZ);
    outputColor = vec4(cascade + gerstner, 1.0);
  }
`;

function createProbeUniforms(patchLengths) {
  /** @type {Record<string, { value: unknown }>} */
  const uniforms = {
    displacement0: { value: null },
    displacement1: { value: null },
    displacement2: { value: null },
    patchLengths: { value: new THREE.Vector3(...patchLengths) },
    time: { value: 0 },
    sampleXZ: { value: new THREE.Vector2() },
    setWaveActive: { value: 0 },
    setWaveAmplitude: { value: 0 },
    setWaveSteepness: { value: 0 },
    setWaveK: { value: 0.05 },
    setWaveWidth: { value: 80 },
    setWaveCrestAlong: { value: 0 },
    setWaveDirection: { value: new THREE.Vector2(1, 0) },
    cascadeScale: { value: 1 },
    swellAmplitude: { value: 0.85 },
    swellSteepness: { value: 0.18 },
    swellK: { value: (Math.PI * 2) / 380 },
    swellOmega: { value: Math.sqrt(9.81 * ((Math.PI * 2) / 380)) },
    swellDirection: { value: new THREE.Vector2(1, 0) },
    swell2Amplitude: { value: 0.35 },
    swell2Steepness: { value: 0.14 },
    swell2K: { value: (Math.PI * 2) / 190 },
    swell2Omega: { value: Math.sqrt(9.81 * ((Math.PI * 2) / 190)) },
    swell2Direction: { value: new THREE.Vector2(0.98, 0.2) },
  };
  return uniforms;
}

export class SurfaceProbe {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {number[]} patchLengths
   */
  constructor(renderer, patchLengths) {
    this.renderer = renderer;
    this.uniforms = createProbeUniforms(patchLengths);
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
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.mesh);
    this._pixel = new Float32Array(4);
    this.last = new THREE.Vector3();
    /** @type {{ maxDeltaY: number, samples: number } | null} */
    this.alignment = null;
  }

  /**
   * @param {import('../ocean/ocean-system.js').SpectralOceanSystem['cascades']} cascades
   * @param {THREE.ShaderMaterial} oceanMaterial
   * @param {number} x
   * @param {number} z
   * @returns {THREE.Vector3}
   */
  sample(cascades, oceanMaterial, x, z) {
    const u = this.uniforms;
    u.displacement0.value = cascades[0].displacement;
    u.displacement1.value = cascades[1].displacement;
    u.displacement2.value = cascades[2].displacement;
    syncOceanDisplacementUniforms(u, oceanMaterial.uniforms);
    u.sampleXZ.value.set(x, z);

    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, 1, 1, this._pixel);
    this.renderer.setRenderTarget(prev);

    this.last.set(this._pixel[0], this._pixel[1], this._pixel[2]);
    return this.last;
  }

  /**
   * One-time QA: compare GPU probe vs legacy CPU composition.
   * @param {THREE.Vector3} gpu
   * @param {THREE.Vector3} cpu
   */
  recordAlignment(gpu, cpu) {
    const deltaY = Math.abs(gpu.y - cpu.y);
    if (!this.alignment) {
      this.alignment = { maxDeltaY: deltaY, samples: 1 };
    } else {
      this.alignment.maxDeltaY = Math.max(this.alignment.maxDeltaY, deltaY);
      this.alignment.samples += 1;
    }
    return deltaY;
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

export { OCEAN_DISPLACEMENT_UNIFORM_KEYS, syncOceanDisplacementUniforms };

/**
 * @param {{ maxDeltaY: number, samples: number }} alignment
 */
export function logBuoyAlignment(alignment, label = '[mavericks] buoy GPU/CPU alignment') {
  console.log(label, alignment);
}
