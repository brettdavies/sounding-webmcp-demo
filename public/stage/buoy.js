/**
 * MSM buoy (Gerard Llorach / ICATMAR).
 *
 * Pose model (moored discus / spar physics, dramatized for stage):
 *   - Large reserve buoyancy + mass → waterline on the hull barely moves
 *   - Heave tracks the free surface with heavy damping (never airborne)
 *   - Attitude (pitch / roll / yaw) dominates; surge/sway nearly locked by mooring
 *   - Draft deep enough that mainly the black stalk reads above the lip on crests
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Local Y of the still-water waterline on the model, as a fraction of height
 * from the mesh bottom. Higher = more of the yellow float stays submerged.
 * ~0.38 ≈ mid-float: heavy draft, stalk/mast dominate the silhouette.
 */
const WATERLINE_FROM_BOTTOM = 0.38;

/** Max submergence of waterline below local free surface (m). */
const MAX_DRAFT_SINK_M = 0.65;
/** Max waterline above free surface — hard clamp (never “flies”). */
const MAX_FREEBOARD_M = 0.02;

/**
 * Heave follow of free-surface η. Near 1 = waterline locked on hull
 * (heavy buoy rides the surface; draft handles “how much yellow shows”).
 */
const HEAVE_RAO = 0.94;
/** Exponential smoothing of heave toward target (1/s) — tight, little lag. */
const HEAVE_FOLLOW = 10;

/** Attitude gain from surface slope (rad per slope unit). */
const PITCH_GAIN = 0.85;
const ROLL_GAIN = 0.85;
/** Max tilt (rad) ≈ 22°. */
const MAX_TILT = 0.38;
/** Attitude smoothing (1/s). */
const ATTITUDE_FOLLOW = 5.5;

/** Yaw from horizontal orbital motion (rad per m of horiz displacement proxy). */
const YAW_GAIN = 0.45;
const MAX_YAW_RATE_CONTRIB = 0.25;
const YAW_FOLLOW = 2.8;

/** Mooring: almost no horizontal travel (m per m of surface horiz displace). */
const SURGE_GAIN = 0.012;

/**
 * @param {THREE.Object3D} root
 */
function prepareBuoy(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of mats) {
          if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.side = THREE.FrontSide;
        }
      }
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);

  const targetHeight = 3.2;
  const scale = targetHeight / Math.max(size.y, 1e-3);
  root.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(root);
  const size2 = box2.getSize(new THREE.Vector3());

  const waterlineY = box2.min.y + size2.y * WATERLINE_FROM_BOTTOM;
  root.position.y -= waterlineY;
  root.position.x -= (box2.min.x + box2.max.x) * 0.5;
  root.position.z -= (box2.min.z + box2.max.z) * 0.5;

  return { height: size2.y };
}

/**
 * Moored-buoy integrator — call sample() each frame with surface kinematics.
 */
export class BuoyDynamics {
  constructor() {
    /** @type {number} */
    this.heave = 0;
    /** @type {number} */
    this.pitch = 0;
    /** @type {number} */
    this.roll = 0;
    /** @type {number} */
    this.yaw = 0;
    /** @type {number} */
    this.x = 0;
    /** @type {number} */
    this.z = 0;
    /** Mean waterline offset (sink) under still water — heavy draft. */
    this.draftSink = 0.28;
  }

  /**
   * @param {{
   *   dt: number,
   *   eta: number,
   *   slopeX: number,
   *   slopeZ: number,
   *   dispX: number,
   *   dispZ: number,
   *   moorX: number,
   *   moorZ: number,
   * }} s
   */
  step(s) {
    const dt = Math.min(Math.max(s.dt, 1e-4), 0.05);

    // Target heave: mostly ride a attenuated free surface, sunk by draft.
    // Never allow the waterline above the free surface (airborne).
    const ride = s.eta * HEAVE_RAO;
    let targetY = ride - this.draftSink;
    const ceiling = s.eta + MAX_FREEBOARD_M;
    const floor = s.eta - MAX_DRAFT_SINK_M;
    targetY = THREE.MathUtils.clamp(targetY, floor, ceiling);

    const hAlpha = 1 - Math.exp(-HEAVE_FOLLOW * dt);
    this.heave += (targetY - this.heave) * hAlpha;
    // Hard safety: waterline must stay in [floor, ceiling] after smooth.
    this.heave = THREE.MathUtils.clamp(this.heave, floor, ceiling);

    // Attitude from surface slope (small-angle ≈ slope); heavily present.
    const pitchTarget = THREE.MathUtils.clamp(
      -s.slopeZ * PITCH_GAIN,
      -MAX_TILT,
      MAX_TILT,
    );
    const rollTarget = THREE.MathUtils.clamp(
      s.slopeX * ROLL_GAIN,
      -MAX_TILT,
      MAX_TILT,
    );
    const aAlpha = 1 - Math.exp(-ATTITUDE_FOLLOW * dt);
    this.pitch += (pitchTarget - this.pitch) * aAlpha;
    this.roll += (rollTarget - this.roll) * aAlpha;

    // Yaw: heading nods with horizontal orbital / face push (moored weathervane).
    const yawTarget = THREE.MathUtils.clamp(
      Math.atan2(s.dispX, Math.max(Math.abs(s.dispZ), 0.15)) * YAW_GAIN,
      -MAX_YAW_RATE_CONTRIB,
      MAX_YAW_RATE_CONTRIB,
    );
    const yAlpha = 1 - Math.exp(-YAW_FOLLOW * dt);
    this.yaw += (yawTarget - this.yaw) * yAlpha;

    // Mooring: tiny surge/sway around anchor.
    this.x = s.moorX + s.dispX * SURGE_GAIN;
    this.z = s.moorZ + s.dispZ * SURGE_GAIN;
  }
}

/**
 * @returns {Promise<{
 *   group: THREE.Group,
 *   dynamics: BuoyDynamics,
 *   setPose: (x: number, y: number, z: number, pitch?: number, roll?: number, yaw?: number) => void,
 *   applyDynamics: () => void,
 *   dispose: () => void,
 * }>}
 */
export async function loadBuoy() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/models/buoy.glb');
  const group = new THREE.Group();
  group.name = 'buoy';
  const model = gltf.scene;
  prepareBuoy(model);
  group.add(model);

  const dynamics = new BuoyDynamics();

  return {
    group,
    dynamics,
    setPose(x, y, z, pitch = 0, roll = 0, yaw = 0) {
      group.position.set(x, y, z);
      group.rotation.order = 'YXZ';
      group.rotation.y = yaw;
      group.rotation.x = pitch;
      group.rotation.z = roll;
    },
    applyDynamics() {
      group.position.set(dynamics.x, dynamics.heave, dynamics.z);
      group.rotation.order = 'YXZ';
      group.rotation.y = dynamics.yaw;
      group.rotation.x = dynamics.pitch;
      group.rotation.z = dynamics.roll;
    },
    dispose() {
      group.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const mat of mats) mat?.dispose?.();
        }
      });
    },
  };
}
