/**
 * Buoy spray — instanced billboards at the mast on set-wave impact; off in lulls.
 */
import * as THREE from 'three';
import { updateSprayLevel } from './buoy-spray-level.js';

export { sprayPulse, updateSprayLevel, verifyBuoySpray, SPRAY_DECAY } from './buoy-spray-level.js';

export const SPRAY_PARTICLE_COUNT = 28;

export class BuoySpray {
  /**
   * @param {{ originY?: number }} [options]
   */
  constructor(options = {}) {
    this.originY = options.originY ?? 2.75;
    this.group = new THREE.Group();
    this.group.name = 'buoy-spray';
    this.level = 0;

    const geometry = new THREE.PlaneGeometry(0.28, 0.28);
    const material = new THREE.MeshBasicMaterial({
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(
      geometry,
      material,
      SPRAY_PARTICLE_COUNT,
    );
    this.mesh.frustumCulled = false;

    /** @type {Array<{ x: number, y: number, z: number, age: number, life: number }>} */
    this.particles = Array.from({ length: SPRAY_PARTICLE_COUNT }, (_, i) => ({
      x: (Math.random() - 0.5) * 0.4,
      y: this.originY + Math.random() * 0.2,
      z: (Math.random() - 0.5) * 0.4,
      age: i / SPRAY_PARTICLE_COUNT,
      life: 0.35 + Math.random() * 0.45,
    }));

    this._matrix = new THREE.Matrix4();
    this._position = new THREE.Vector3();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._identity = new THREE.Quaternion();
    this.group.add(this.mesh);
    this.mesh.visible = false;
  }

  /**
   * @param {{
   *   level: number,
   *   dt: number,
   *   camera: THREE.Camera,
   *   windX?: number,
   *   windZ?: number,
   * }} args
   */
  update({ level, dt, camera, windX = 0.35, windZ = -0.15 }) {
    this.level = level;
    this.mesh.visible = level > 0.025;
    if (!this.mesh.visible) return;

    this.group.lookAt(camera.position);
    const step = Math.min(dt, 0.05);

    for (let i = 0; i < SPRAY_PARTICLE_COUNT; i += 1) {
      const p = this.particles[i];
      p.age += step;
      if (p.age >= p.life || level > 0.55) {
        p.age = 0;
        p.life = 0.28 + Math.random() * 0.42;
        p.x = (Math.random() - 0.5) * 0.35;
        p.y = this.originY + Math.random() * 0.15;
        p.z = (Math.random() - 0.5) * 0.35;
      }

      p.y += step * (1.8 + level * 2.4);
      p.x += step * (windX + (Math.random() - 0.5) * 0.25);
      p.z += step * (windZ + (Math.random() - 0.5) * 0.25);

      const t = 1 - p.age / p.life;
      const alpha = level * t * t;
      const size = 0.15 + alpha * 0.55;

      this._position.set(p.x, p.y, p.z);
      this._scale.set(size, size * (0.8 + alpha * 0.5), 1);
      this._matrix.compose(this._position, this._identity, this._scale);
      this.mesh.setMatrixAt(i, this._matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.material.opacity = Math.min(0.95, 0.25 + level * 0.7);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.group.remove(this.mesh);
  }
}

/**
 * @param {THREE.Group} buoyGroup
 * @param {{ originY?: number }} [options]
 */
export function attachBuoySpray(buoyGroup, options = {}) {
  const spray = new BuoySpray(options);
  buoyGroup.add(spray.group);
  return spray;
}
