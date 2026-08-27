/**
 * Mavericks / Pillar Point terrain from USGS DS 684 DEM_1 (2 m → 4 m crop).
 * Land-only asset: coast, point, undersea bathymetry. No ocean / buoy.
 */
import * as THREE from 'three';

/**
 * @typedef {{
 *   pixel_m: number,
 *   rows: number,
 *   cols: number,
 *   z_min: number,
 *   z_max: number,
 *   station_local?: { x: number, y: number, z: number },
 *   pillar_elev_m?: number,
 *   source?: string,
 * }} MavericksMeta
 */

export const MAVERICKS_VIEWS = Object.freeze({
  aerial: {
    position: { x: -200, y: 520, z: 680 },
    lookAt: { x: -100, y: 10, z: -200 },
    fov: 48,
  },
  shore: {
    position: { x: -520, y: 55, z: 280 },
    lookAt: { x: -180, y: 25, z: -280 },
    fov: 42,
  },
  cliff: {
    position: { x: -380, y: 22, z: -40 },
    lookAt: { x: -180, y: 30, z: -300 },
    fov: 40,
  },
  reef: {
    position: { x: -620, y: 90, z: 120 },
    lookAt: { x: -280, y: -5, z: -200 },
    fov: 46,
  },
  fallaway: {
    position: { x: -900, y: 80, z: 200 },
    lookAt: { x: -400, y: -15, z: -100 },
    fov: 44,
  },
  station: {
    position: { x: -40, y: 95, z: -80 },
    lookAt: { x: -180, y: 50, z: -320 },
    fov: 40,
  },
  tip: {
    position: { x: -280, y: 35, z: 80 },
    lookAt: { x: -200, y: 20, z: -280 },
    fov: 38,
  },
});

/**
 * @returns {Promise<{
 *   group: THREE.Group,
 *   meta: MavericksMeta,
 *   dispose: () => void,
 * }>}
 */
export async function loadMavericksTerrain() {
  const meta = /** @type {MavericksMeta} */ (
    await fetch('/land/mavericks/meta.json').then((r) => r.json())
  );
  const buf = await fetch('/land/mavericks/height.f32').then((r) =>
    r.arrayBuffer(),
  );
  const heights = new Float32Array(buf);
  const { rows, cols, pixel_m: pixelM } = meta;
  if (heights.length !== rows * cols) {
    throw new Error(
      `[mavericks] height size ${heights.length} ≠ ${rows * cols}`,
    );
  }

  const albedo = await new THREE.TextureLoader().loadAsync(
    '/land/mavericks/albedo.png',
  );
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = 8;
  albedo.wrapS = albedo.wrapT = THREE.ClampToEdgeWrapping;

  // Width/depth in meters (cell centers span (n-1)*pixel).
  const widthM = (cols - 1) * pixelM;
  const depthM = (rows - 1) * pixelM;
  const geo = new THREE.PlaneGeometry(widthM, depthM, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const land = new THREE.Color(0xc4a574);
  const scrub = new THREE.Color(0x8a9a5c);
  const rock = new THREE.Color(0x5a564e);
  const deep = new THREE.Color(0x2e322e);

  for (let i = 0; i < pos.count; i++) {
    // PlaneGeometry grid: i = row-major from -width/2..+width/2, -depth/2..+depth/2
    // after rotateX, Y is up; Z maps from former Y (v).
    const col = i % cols;
    const row = (i / cols) | 0;
    const h = heights[row * cols + col];
    pos.setY(i, h);

    let c;
    if (h >= 8) c = scrub.clone().lerp(land, 0.45);
    else if (h >= 0.2) c = land;
    else if (h >= -8) c = rock;
    else c = deep;
    // Slight darken with depth underwater.
    if (h < 0) c.multiplyScalar(1 + h / 80);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: albedo,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  // Soften albedo so DEM form + vertex colors dominate.
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'mavericksDem';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.name = 'mavericksLand';
  group.add(mesh);

  // Station locked to DEM plateau (child of land group).
  const station = buildStation(meta.station_local);
  group.add(station);

  // Sea-level reference ring (thin) so fallaway reads vs 0 m NAVD88.
  const waterline = new THREE.Mesh(
    new THREE.RingGeometry(8, 12, 48),
    new THREE.MeshBasicMaterial({
      color: 0x4a90a8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  waterline.rotation.x = -Math.PI / 2;
  waterline.position.set(
    meta.station_local?.x ?? 0,
    0.05,
    (meta.station_local?.z ?? 0) + 180,
  );
  group.add(waterline);

  return {
    group,
    meta,
    dispose() {
      geo.dispose();
      mat.dispose();
      albedo.dispose();
    },
  };
}

/**
 * Utilitarian Pillar Point AFS stand-in — parented to DEM plateau.
 * @param {{ x: number, y: number, z: number } | undefined} anchor
 */
function buildStation(anchor) {
  const group = new THREE.Group();
  group.name = 'station';
  if (!anchor) return group;
  group.position.set(anchor.x, anchor.y, anchor.z);

  const bury = -0.08;
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
    clearcoat: 0.5,
    clearcoatRoughness: 0.35,
  });
  const asphalt = new THREE.MeshStandardMaterial({
    color: 0x3a3c3a,
    roughness: 0.95,
    metalness: 0.02,
  });

  const pad = new THREE.Mesh(new THREE.BoxGeometry(36, 0.35, 28), asphalt);
  pad.position.set(0, bury + 0.12, 0);
  pad.receiveShadow = true;
  group.add(pad);

  const shed = new THREE.Mesh(new THREE.BoxGeometry(18, 3.5, 9), tan);
  shed.position.set(-9, bury + 1.75, 6);
  shed.castShadow = true;
  group.add(shed);

  const shed2 = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 7), tan);
  shed2.position.set(10, bury + 1.6, 8);
  group.add(shed2);

  const pedestalH = 7;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 3.4, pedestalH, 24),
    olive,
  );
  pedestal.position.set(2, bury + pedestalH * 0.5, -4);
  group.add(pedestal);

  const sphereR = 6;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(sphereR, 40, 28), white);
  dome.position.set(2, bury + pedestalH + sphereR * 0.82, -4);
  group.add(dome);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    white,
  );
  dish.scale.set(1, 0.35, 1);
  dish.rotation.x = -0.55;
  dish.position.set(16, bury + 4.2, -6);
  group.add(dish);
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 4.2, 10),
    olive,
  );
  mount.position.set(16, bury + 2.1, -6);
  group.add(mount);

  return group;
}
