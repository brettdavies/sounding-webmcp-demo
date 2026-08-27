/**
 * Pillar Point land + Mavericks bathymetry — one locked group.
 *
 * Layout from `.context/pictures/wave-energy.jpeg` (shaded-relief map):
 *   - Hook peninsula tip (tan headland) → thin neck → harbor side
 *   - Finger reef ridges west/SW of tip, roughly NW–SE, focusing swell
 *   - Steep fallaway into deeper Pacific west of the ridge field
 *
 * Heights (world meters):
 *   Tip cliffs ≈ 40 m (CoastView ~130 ft)
 *   Radome ≈ 12 m Ø on ~7 m pedestal; sheds ≈ 3.5 m
 *   Reef crests ≈ −8…−16 m; troughs ≈ −25…−35 m; deep shelf ≈ −45 m
 *
 * Buildings are children of the land root — never float independently.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export const PILLAR_METERS = Object.freeze({
  cliffFaceM: 40,
  radomeDiameterM: 12,
  radomePedestalH: 7,
  shedH: 3.5,
  dishDiameterM: 6,
  /** World origin ≈ tip of Pillar Point at waterline. */
  originX: 0,
  originZ: 0,
});

/**
 * Land-only camera set — cliffs, reef fingers, fallaway, station.
 * Coordinates match the heightfield in this module.
 */
export const LAND_VIEWS = Object.freeze({
  shore: {
    position: { x: -120, y: 55, z: 160 },
    lookAt: { x: 20, y: 15, z: -40 },
    fov: 42,
  },
  cliff: {
    position: { x: -90, y: 28, z: 70 },
    lookAt: { x: 10, y: 18, z: -20 },
    fov: 40,
  },
  reef: {
    position: { x: -180, y: 90, z: 40 },
    lookAt: { x: -40, y: -5, z: -30 },
    fov: 48,
  },
  fallaway: {
    position: { x: -260, y: 70, z: 120 },
    lookAt: { x: -80, y: -10, z: -20 },
    fov: 45,
  },
  aerial: {
    position: { x: -40, y: 220, z: 180 },
    lookAt: { x: -20, y: 0, z: -40 },
    fov: 50,
  },
  station: {
    position: { x: 40, y: 70, z: 90 },
    lookAt: { x: 15, y: 35, z: -15 },
    fov: 38,
  },
});

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 */
export async function loadEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const hdr = await new RGBELoader().loadAsync(
      '/hdri/salt_rock_beach_cloudy_2k.hdr',
    );
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const rt = pmrem.fromEquirectangular(hdr);
    scene.environment = rt.texture;
    hdr.dispose();
  } catch (error) {
    console.warn('[sounding] HDRI load failed', error);
  }
  pmrem.dispose();
}

/**
 * @returns {Promise<THREE.Group>}
 */
export async function loadLand() {
  const root = new THREE.Group();
  root.name = 'pillarPointLand';

  const [landMat, asphaltMat] = await Promise.all([
    loadTiledMaterial('/textures/ground/aerial_grass_rock', {
      repeat: 14,
      color: 0xc4a574,
    }),
    loadTiledMaterial('/textures/asphalt/asphalt_02', {
      repeat: 3,
      useRough: true,
    }),
  ]);

  // Continuous terrain: land (y≥0) + undersea (y<0) from wave-energy map.
  const terrain = buildWaveEnergyTerrain(landMat);
  root.add(terrain);

  // Detail cliff meshes seated into the tip face (photo texture read).
  try {
    const cliffs = await loadCliffDetail();
    root.add(cliffs);
  } catch (error) {
    console.warn('[sounding] cliff detail failed', error);
  }

  const plateau = samplePlateauAnchor();
  const station = await buildStation(plateau, asphaltMat);
  root.add(station);

  root.userData.plateau = plateau;
  return root;
}

/**
 * Pillar Point tip plateau — where station sits (matches map headland).
 * @returns {THREE.Vector3}
 */
function samplePlateauAnchor() {
  // Tip mound center on the heightfield (see peninsulaMask).
  return new THREE.Vector3(18, PILLAR_METERS.cliffFaceM - 1.5, -22);
}

/**
 * Heightfield matching wave-energy.jpeg:
 *   +X ≈ east (harbor), −X ≈ west (Pacific), −Z ≈ northish tip axis.
 * @param {THREE.Material} landMat
 */
function buildWaveEnergyTerrain(landMat) {
  const group = new THREE.Group();
  group.name = 'waveEnergyTerrain';

  const width = 700;
  const depth = 700;
  const segs = 220;
  const geo = new THREE.PlaneGeometry(width, depth, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const landColor = new THREE.Color(0xc4a574);
  const rockColor = new THREE.Color(0x5c5850);
  const deepColor = new THREE.Color(0x3a3834);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);

    const c = y >= -0.5 ? landColor : y > -18 ? rockColor : deepColor;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = landMat.clone();
  mat.vertexColors = true;
  mat.color.set(0xffffff);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'bathymetryTopo';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);

  return group;
}

/**
 * Elevation (m) at world XZ — wave-energy.jpeg silhouette.
 * @param {number} x
 * @param {number} z
 */
function heightAt(x, z) {
  const land = peninsulaHeight(x, z);
  if (land != null) return land;

  // Undersea: finger ridges + fallaway (west of tip).
  return seafloorHeight(x, z);
}

/**
 * Hook peninsula — elevated tip mound, thinner neck to NE.
 * @param {number} x
 * @param {number} z
 * @returns {number | null}
 */
function peninsulaHeight(x, z) {
  // Tip lobe (Pillar Point headland).
  const tip = ellipseMask(x, z, 22, -18, 95, 70, 0.35);
  // Neck toward harbor / mainland (east-northeast).
  const neck = ellipseMask(x, z, 110, 40, 160, 55, -0.4);
  // Mainland / harbor-side mass (east).
  const main = ellipseMask(x, z, 220, 80, 200, 140, 0.1);
  // Harbor breakwater spit (thin east arm) — low.
  const spit = ellipseMask(x, z, 90, 95, 110, 22, 0.2);

  const mask = Math.max(tip, neck * 0.85, main * 0.7, spit * 0.45);
  if (mask < 0.08) return null;

  const tipBoost = tip * PILLAR_METERS.cliffFaceM;
  const neckH = neck * 18;
  const mainH = main * 22;
  const spitH = spit * 6;
  let h = Math.max(tipBoost, neckH, mainH, spitH);

  // Steep seaward cliff: compress height near SW face of tip.
  const seaward = Math.exp(-(((x + 30) / 40) ** 2) - (((z + 10) / 55) ** 2));
  if (tip > 0.3) {
    h *= 0.55 + 0.45 * (1 - seaward * 0.5);
  }

  // Scrub micro-relief on plateau.
  h += Math.sin(x * 0.35) * Math.cos(z * 0.28) * 0.6 * tip;
  return h;
}

/**
 * Mavericks finger reefs + Pacific fallaway (wave-energy.jpeg).
 * @param {number} x
 * @param {number} z
 */
function seafloorHeight(x, z) {
  // Base slope: shallow near tip, deep to the west.
  const offshore = THREE.MathUtils.clamp((-x - 20) / 280, 0, 1);
  let y = THREE.MathUtils.lerp(-4, -48, offshore ** 0.9);

  // Finger ridges — parallel bands, NW–SE (diag in XZ).
  // Axis along direction (0.75, 0.66) ≈ swell-facing fingers.
  const u = x * 0.75 + z * 0.66; // along ridge
  const v = -x * 0.66 + z * 0.75; // across ridges

  // Several sharp fingers west of tip (map: crumpled sheets).
  const ridgeField =
    ridge(v, 35, 14) * 11 +
    ridge(v - 42, 28, 11) * 9 +
    ridge(v + 38, 30, 12) * 8 +
    ridge(v - 78, 22, 9) * 6;

  // Gate ridges to the reef zone (west/SW of tip, not under land).
  const reefGate = smoothPulse(x, -220, -20) * smoothPulse(z, -120, 80);
  y += ridgeField * reefGate;

  // Deep troughs between fingers.
  const trough = Math.sin(v * 0.09) * 4 * reefGate;
  y -= Math.max(0, trough);

  // High-freq rock roughness.
  y +=
    Math.sin(x * 0.17 + z * 0.11) * 1.2 * reefGate +
    Math.sin(u * 0.4) * Math.cos(v * 0.35) * 0.8 * reefGate;

  // Near-shore shelf under tip cliffs.
  const near = Math.exp(-(x * x + (z + 10) * (z + 10)) / (70 * 70));
  y = THREE.MathUtils.lerp(y, -2.5, near * 0.35);

  return y;
}

/**
 * @param {number} v across-ridge coordinate
 * @param {number} center
 * @param {number} width
 */
function ridge(v, center, width) {
  const t = (v - center) / width;
  return Math.exp(-t * t);
}

/**
 * @param {number} x
 * @param {number} z
 * @param {number} cx
 * @param {number} cz
 * @param {number} rx
 * @param {number} rz
 * @param {number} rot
 */
function ellipseMask(x, z, cx, cz, rx, rz, rot) {
  const dx = x - cx;
  const dz = z - cz;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const lx = (dx * c + dz * s) / rx;
  const lz = (-dx * s + dz * c) / rz;
  const d = lx * lx + lz * lz;
  if (d > 1.2) return 0;
  return Math.max(0, 1 - d);
}

/**
 * @param {number} x
 * @param {number} a
 * @param {number} b
 */
function smoothPulse(x, a, b) {
  if (x < a || x > b) return 0;
  const t = (x - a) / (b - a);
  return Math.sin(t * Math.PI);
}

/**
 * Seat Poly Haven cliff scrapes onto the tip face for photo-matching texture.
 */
async function loadCliffDetail() {
  const loader = new GLTFLoader();
  const group = new THREE.Group();
  group.name = 'cliffDetail';

  const gltf = await loader.loadAsync(
    '/models/coastal_cliff_01/coastal_cliff_01_1k.gltf',
  );
  const placements = [
    { x: -15, y: 8, z: -5, s: 18 / 40, rotY: Math.PI * 0.55 },
    { x: 5, y: 6, z: 15, s: 14 / 40, rotY: Math.PI * 0.85 },
    { x: -35, y: 4, z: -25, s: 12 / 40, rotY: Math.PI * 0.4 },
  ];

  for (const p of placements) {
    const cliff = gltf.scene.clone(true);
    prepareCliff(cliff);
    // Normalize then scale so face ≈ target meters relative to asset.
    cliff.scale.setScalar(1);
    cliff.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cliff);
    const h = Math.max(box.getSize(new THREE.Vector3()).y, 0.001);
    cliff.scale.setScalar((PILLAR_METERS.cliffFaceM * p.s * 40) / h);
    cliff.rotation.y = p.rotY;
    cliff.position.set(p.x, p.y, p.z);
    // Bury into peninsula so they don't float as shelves.
    cliff.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(cliff);
    cliff.position.y -= b2.min.y + 8;
    group.add(cliff);
  }

  return group;
}

/**
 * @param {THREE.Object3D} root
 */
function prepareCliff(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.envMapIntensity = 0.85;
      if (mat.color) mat.color.offsetHSL(0.05, 0.15, 0.08);
      if (mat.roughness != null) mat.roughness = Math.min(mat.roughness, 0.95);
    }
  });
}

/**
 * Station locked to plateau — child of land root.
 * @param {THREE.Vector3} tip
 * @param {THREE.Material} asphaltMat
 */
async function buildStation(tip, asphaltMat) {
  const group = new THREE.Group();
  group.name = 'station';
  group.position.copy(tip);

  const loader = new GLTFLoader();
  const optional = [
    { path: '/models/radome.glb', x: 0, z: 0 },
    { path: '/models/satellite-dish.glb', x: 14, z: -4 },
    { path: '/models/station-building.glb', x: -10, z: 4 },
  ];
  let loaded = false;
  for (const item of optional) {
    try {
      const gltf = await loader.loadAsync(item.path);
      const obj = gltf.scene;
      obj.position.set(item.x, 0, item.z);
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      obj.position.y = -box.min.y - 0.05;
      group.add(obj);
      loaded = true;
    } catch {
      // optional
    }
  }
  if (loaded) return group;

  const bury = -0.05;
  const tan = new THREE.MeshStandardMaterial({
    color: 0xb9a78a,
    roughness: 0.9,
    metalness: 0.04,
  });
  const olive = new THREE.MeshStandardMaterial({
    color: 0x8a8c78,
    roughness: 0.82,
    metalness: 0.08,
  });
  const white = new THREE.MeshPhysicalMaterial({
    color: 0xf3f5f7,
    roughness: 0.28,
    metalness: 0.04,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
  });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 20), asphaltMat);
  pad.position.set(0, bury + 0.12, 0);
  pad.receiveShadow = true;
  group.add(pad);

  const shed = new THREE.Mesh(
    new THREE.BoxGeometry(18, PILLAR_METERS.shedH, 8),
    tan,
  );
  shed.position.set(-8, bury + PILLAR_METERS.shedH * 0.5, 6);
  shed.castShadow = true;
  group.add(shed);

  const shed2 = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 6), tan);
  shed2.position.set(8, bury + 1.6, 8);
  group.add(shed2);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.4, PILLAR_METERS.radomePedestalH, 24),
    olive,
  );
  pedestal.position.set(4, bury + PILLAR_METERS.radomePedestalH * 0.5, -3);
  group.add(pedestal);

  const sphereR = PILLAR_METERS.radomeDiameterM * 0.5;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(sphereR, 40, 28), white);
  dome.position.set(
    4,
    bury + PILLAR_METERS.radomePedestalH + sphereR * 0.82,
    -3,
  );
  group.add(dome);

  const dish = new THREE.Group();
  const dishMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    white,
  );
  dishMesh.scale.set(1, 0.35, 1);
  dishMesh.rotation.x = -0.55;
  dishMesh.position.y = 4.2;
  dish.add(dishMesh);
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 4.2, 10),
    olive,
  );
  mount.position.y = 2.1;
  dish.add(mount);
  dish.position.set(16, bury, -6);
  group.add(dish);

  return group;
}

/**
 * @param {string} basePath
 * @param {{ repeat?: number, useRough?: boolean, color?: number }} [opts]
 */
async function loadTiledMaterial(basePath, opts = {}) {
  const loader = new THREE.TextureLoader();
  const repeat = opts.repeat ?? 2;
  try {
    const loads = [
      loader.loadAsync(`${basePath}_diffuse_1k.jpg`),
      loader.loadAsync(`${basePath}_nor_gl_1k.jpg`),
    ];
    if (opts.useRough) loads.push(loader.loadAsync(`${basePath}_rough_1k.jpg`));
    const [map, normalMap, roughMap] = await Promise.all(loads);
    for (const tex of [map, normalMap, roughMap].filter(Boolean)) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat, repeat);
      tex.anisotropy = 8;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap: roughMap,
      color: opts.color ?? 0xffffff,
      roughness: 1,
      metalness: 0.02,
    });
  } catch {
    return new THREE.MeshStandardMaterial({
      color: opts.color ?? 0x6a6358,
      roughness: 0.92,
      metalness: 0.04,
    });
  }
}
