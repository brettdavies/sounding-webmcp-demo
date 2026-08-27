/**
 * Mavericks / Pillar Point terrain from USGS DS 684 DEM_1 (2 m → 4 m crop).
 * Albedo: NAIP 2022 ortho + Poly Haven cliff/rock bake. Cliff normals on steep faces.
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
 *   break_line?: {
 *     peak: { x: number, z: number },
 *     rocks: { x: number, z: number },
 *     polyline: { x: number, z: number }[],
 *     swell_from_deg?: number,
 *     depth_band_m?: number[],
 *   },
 *   spectators?: {
 *     x: number,
 *     z: number,
 *     ground_y: number,
 *     eye_height_m: number,
 *     look_at: { x: number, y: number, z: number },
 *   },
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
  /** Harbor-facing spectator beach; eye ~2.5 m, looking at break peak. */
  spectators: {
    position: { x: 160, y: 3.9, z: -80 },
    lookAt: { x: -440, y: 5, z: -20 },
    fov: 50,
  },
});

/**
 * @param {string} url
 * @param {{ repeat?: number, colorSpace?: string }} [opts]
 */
async function loadTex(url, opts = {}) {
  const tex = await new THREE.TextureLoader().loadAsync(url);
  if (opts.colorSpace === 'srgb') tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const r = opts.repeat ?? 1;
  tex.repeat.set(r, r);
  return tex;
}

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

  const [albedo, masks, cliffDiff, cliffNor, seaDiff, seaNor] =
    await Promise.all([
      loadTex('/land/mavericks/albedo.png', { colorSpace: 'srgb' }),
      loadTex('/land/mavericks/masks.png'),
      loadTex('/textures/cliff/rock_face_03_diff_2k.jpg', {
        colorSpace: 'srgb',
        repeat: 48,
      }),
      loadTex('/textures/cliff/rock_face_03_nor_gl_2k.jpg', { repeat: 48 }),
      loadTex('/textures/seafloor/gray_rocks_diff_2k.jpg', {
        colorSpace: 'srgb',
        repeat: 36,
      }),
      loadTex('/textures/seafloor/gray_rocks_nor_gl_2k.jpg', { repeat: 36 }),
    ]);
  albedo.wrapS = albedo.wrapT = THREE.ClampToEdgeWrapping;
  albedo.repeat.set(1, 1);
  masks.wrapS = masks.wrapT = THREE.ClampToEdgeWrapping;
  masks.repeat.set(1, 1);
  masks.colorSpace = THREE.NoColorSpace;

  const widthM = (cols - 1) * pixelM;
  const depthM = (rows - 1) * pixelM;
  const geo = new THREE.PlaneGeometry(widthM, depthM, cols - 1, rows - 1);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const col = i % cols;
    const row = (i / cols) | 0;
    pos.setY(i, heights[row * cols + col]);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: albedo,
    normalMap: cliffNor,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.88,
    metalness: 0.02,
  });

  // Soft cliff/seafloor overlay from baked masks + tiled Poly Haven maps.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.cliffMap = { value: cliffDiff };
    shader.uniforms.seaMap = { value: seaDiff };
    shader.uniforms.maskMap = { value: masks };
    shader.uniforms.detailScale = { value: 0.045 };

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      /* glsl */ `
      #include <common>
      uniform sampler2D cliffMap;
      uniform sampler2D seaMap;
      uniform sampler2D maskMap;
      uniform float detailScale;
      `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
      #include <map_fragment>
      vec2 wuv = vMapUv * 48.0;
      // Prefer world-ish tiling via map UV scaled (plane UVs track XZ).
      vec4 masksS = texture2D(maskMap, vMapUv);
      float cliffW = masksS.r;
      float underW = masksS.g;
      vec3 cliffC = texture2D(cliffMap, wuv).rgb * vec3(1.1, 1.0, 0.88);
      vec3 seaC = texture2D(seaMap, wuv * 0.7).rgb * 0.55;
      diffuseColor.rgb = mix(diffuseColor.rgb, cliffC, cliffW * 0.65);
      diffuseColor.rgb = mix(diffuseColor.rgb, seaC, underW * 0.5);
      `,
    );
  };
  mat.customProgramCacheKey = () => 'mavericks-cliff-detail-v2';
  mat.needsUpdate = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'mavericksDem';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.name = 'mavericksLand';
  group.add(mesh);

  const station = buildStation(meta.station_local);
  group.add(station);

  return {
    group,
    meta,
    dispose() {
      geo.dispose();
      mat.dispose();
      for (const t of [albedo, masks, cliffDiff, cliffNor, seaDiff, seaNor]) {
        t.dispose();
      }
    },
  };
}

/**
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
