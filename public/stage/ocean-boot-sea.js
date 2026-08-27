/**
 * Full sea stage on USGS DEM land: spectral ocean at MSL, heat faces at break peak.
 * Loaded with ?focus=sea. Optional ?view=spectators|fallaway|reef|…
 */
import * as THREE from 'three';
import { SpectralOceanSystem } from '../ocean/ocean-system.js';
import {
  createOceanMaterial,
  createSkyMaterial,
  updateOceanMaterialTextures,
} from '../ocean/ocean-material.js';
import { createOceanDetailTexture } from '../ocean/detail-texture.js';
import { loadBuoy } from './buoy.js';
import { HeightProbe } from './height-probe.js';
import {
  ambientSwellAt,
  applyHeatUniforms,
  buildHeatSchedule,
  fallbackReading,
  heatDisplacementAt,
  sampleHeat,
} from './heat.js';
import { loadEnvironment } from './land.js';
import {
  MAVERICKS_VIEWS,
  loadMavericksTerrain,
} from './mavericks-terrain.js';
import {
  BUOY_XZ,
  DESIGN_CAMERA,
  MAVERICKS_SEA,
  MSL_Y,
  OCEAN_SEGMENTS,
  OCEAN_SIZE,
  SUN_DIRECTION,
} from './sea-state.js';

/**
 * @param {HTMLElement} mount
 * @param {URLSearchParams} params
 */
export async function bootSeaStage(mount, params) {
  const viewName = params.get('view') || 'fallaway';
  const view = MAVERICKS_VIEWS[viewName] || {
    position: DESIGN_CAMERA.position,
    lookAt: DESIGN_CAMERA.lookAt,
    fov: DESIGN_CAMERA.fov,
  };

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    view.fov,
    mount.clientWidth / Math.max(mount.clientHeight, 1),
    DESIGN_CAMERA.near,
    DESIGN_CAMERA.far,
  );
  camera.position.set(view.position.x, view.position.y, view.position.z);
  camera.lookAt(view.lookAt.x, view.lookAt.y, view.lookAt.z);

  const sunDirection = new THREE.Vector3(
    SUN_DIRECTION.x,
    SUN_DIRECTION.y,
    SUN_DIRECTION.z,
  ).normalize();

  scene.add(new THREE.AmbientLight(0xb8c4d0, 0.45));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.copy(sunDirection).multiplyScalar(400);
  scene.add(sun);

  const oceanSystem = new SpectralOceanSystem(renderer, {
    ...MAVERICKS_SEA,
  });

  const detailTexture = createOceanDetailTexture(512, MAVERICKS_SEA.seed);
  const oceanMaterial = createOceanMaterial(oceanSystem.cascades, {
    patchLengths: MAVERICKS_SEA.patchLengths,
    sunDirection,
    detailTexture,
  });
  oceanMaterial.uniforms.foamScale.value = 0.7;
  oceanMaterial.uniforms.foamThreshold.value = 0.2;
  oceanMaterial.uniforms.detailStrength.value = 0.006;
  oceanMaterial.uniforms.fogDensity.value = 0.00125;
  oceanMaterial.uniforms.scatterColor.value.set(0x3aa0a0);

  const oceanGeometry = new THREE.PlaneGeometry(
    OCEAN_SIZE,
    OCEAN_SIZE,
    OCEAN_SEGMENTS,
    OCEAN_SEGMENTS,
  );
  oceanGeometry.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
  oceanMesh.position.y = MSL_Y;
  oceanMesh.frustumCulled = false;
  scene.add(oceanMesh);

  const skyMaterial = createSkyMaterial({ sunDirection });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 32, 16),
    skyMaterial,
  );
  sky.frustumCulled = false;
  scene.add(sky);

  oceanMaterial.uniforms.sunDirection.value.copy(sunDirection);
  skyMaterial.uniforms.sunDirection.value.copy(sunDirection);

  const heightProbe = new HeightProbe(renderer, MAVERICKS_SEA.patchLengths);

  /** @type {Awaited<ReturnType<typeof loadBuoy>> | null} */
  let buoy = null;
  try {
    buoy = await loadBuoy();
    scene.add(buoy.group);
  } catch (error) {
    console.warn('[sounding] buoy load failed', error);
  }

  try {
    await loadEnvironment(renderer, scene);
  } catch (error) {
    console.warn('[sounding] environment failed', error);
  }

  /** @type {Awaited<ReturnType<typeof loadMavericksTerrain>> | null} */
  let terrain = null;
  try {
    terrain = await loadMavericksTerrain();
    scene.add(terrain.group);
  } catch (error) {
    console.warn('[sounding] DEM terrain failed', error);
  }

  const peak = terrain?.meta?.break_line?.peak ?? {
    x: BUOY_XZ.x,
    z: BUOY_XZ.z,
  };
  const buoyXz = { x: peak.x, z: peak.z };
  const swellFrom =
    terrain?.meta?.break_line?.swell_from_deg ??
    MAVERICKS_SEA.swell.directionDegrees;

  const metersEl = document.getElementById('meters');
  const waveEl = document.getElementById('wave');
  const asOfEl = document.getElementById('as-of');

  let reading = fallbackReading();
  try {
    const response = await fetch('/api/reading');
    if (response.ok) {
      reading = await response.json();
    }
  } catch (error) {
    console.warn('[sounding] heat reading fetch failed', error);
  }
  if (!reading.swell) reading.swell = {};
  reading.swell.direction_deg = reading.swell.direction_deg ?? swellFrom;
  const heatSchedule = buildHeatSchedule(reading, buoyXz);

  /** @param {string} name */
  const setView = (name) => {
    const v = MAVERICKS_VIEWS[name];
    if (!v) return;
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    camera.position.set(v.position.x, v.position.y, v.position.z);
    camera.lookAt(v.lookAt.x, v.lookAt.y, v.lookAt.z);
  };

  window.__soundingSea = {
    setView,
    views: Object.keys(MAVERICKS_VIEWS),
    camera,
    meta: terrain?.meta ?? null,
    mslY: MSL_Y,
    buoyXz,
  };

  let elapsed = 0;
  let lastTs = performance.now();
  let frameId = 0;
  let disposed = false;

  const onResize = () => {
    const width = mount.clientWidth;
    const height = Math.max(mount.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  window.addEventListener('resize', onResize);

  const debugParam = params.get('debug');
  if (debugParam != null) {
    oceanMaterial.uniforms.debugMode.value = Number(debugParam) || 0;
  }

  const tick = (ts) => {
    if (disposed) return;
    frameId = requestAnimationFrame(tick);
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    elapsed += dt;

    const heat = sampleHeat(heatSchedule, elapsed);
    applyHeatUniforms(oceanMaterial, heat, heatSchedule);

    oceanSystem.update(elapsed, dt);
    updateOceanMaterialTextures(oceanMaterial, oceanSystem.cascades);
    oceanMaterial.uniforms.time.value = elapsed;

    const cascade = heightProbe.sample(
      oceanSystem.cascades,
      buoyXz.x,
      buoyXz.z,
    );
    const cascadeScale = oceanMaterial.uniforms.cascadeScale.value;
    const face = heatDisplacementAt(heat, buoyXz.x, buoyXz.z);
    const swell = ambientSwellAt(heatSchedule, elapsed, buoyXz.x, buoyXz.z);

    // Free-surface kinematics relative to still water (MSL); world Y = MSL + η.
    const eta = cascade.y * cascadeScale + face.y + swell.y;
    const dispX = cascade.x * cascadeScale + face.x + swell.x;
    const dispZ = cascade.z * cascadeScale + face.z + swell.z;
    const slopeX = THREE.MathUtils.clamp(dispX * 0.045, -0.55, 0.55);
    const slopeZ = THREE.MathUtils.clamp(dispZ * 0.045, -0.55, 0.55);

    if (buoy) {
      buoy.dynamics.step({
        dt,
        eta,
        slopeX,
        slopeZ,
        dispX,
        dispZ,
        moorX: buoyXz.x,
        moorZ: buoyXz.z,
      });
      buoy.applyDynamics();
      buoy.group.position.y = MSL_Y + buoy.dynamics.heave;
    }

    if (metersEl) {
      const display =
        heat.active > 0.15
          ? Math.max(Math.abs(eta), heat.face_m * heat.active * 0.85)
          : Math.max(0.1, Math.abs(eta));
      metersEl.textContent = display.toFixed(1);
    }
    if (waveEl) {
      const faceM =
        heat.active > 0.08
          ? heat.face_m.toFixed(1)
          : Math.abs(eta).toFixed(1);
      const tag =
        heat.active > 0.08
          ? heat.kind === 'tween'
            ? 'tween'
            : heat.label || 'face'
          : 'swell';
      waveEl.textContent = `${tag} ${faceM} m · ${heat.periodS} s · ${heat.directionDeg}° · ${viewName}`;
    }
    if (asOfEl && heat.active > 0.2 && heat.kind === 'set') {
      asOfEl.textContent = `heat · ${heat.label} · rolling`;
    } else if (asOfEl && heat.active > 0.2 && heat.kind === 'tween') {
      asOfEl.textContent = `heat · smaller between`;
    } else if (asOfEl && reading.as_of_local) {
      asOfEl.textContent = reading.as_of_local;
    }

    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      delete window.__soundingSea;
      oceanGeometry.dispose();
      oceanMaterial.dispose();
      sky.geometry.dispose();
      skyMaterial.dispose();
      detailTexture.dispose();
      heightProbe.dispose();
      buoy?.dispose();
      terrain?.dispose();
      renderer.dispose();
      mount.replaceChildren();
    },
  };
}
