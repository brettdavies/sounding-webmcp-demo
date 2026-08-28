/**
 * Full sea stage on USGS DEM land: spectral ocean at MHHW, set waves at break peak.
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
  logBuoyAlignment,
  SurfaceProbe,
} from './surface-probe.js';
import {
  ambientSwellAt,
  applySetWaveUniforms,
  buildSetWaveSchedule,
  fallbackReading,
  sampleSetWave,
  setWaveDisplacementAt,
} from './set-wave.js';
import { verifyCurvedCrestOnPolyline } from './break-line-crest.js';
import {
  verifyBreakStyleDistribution,
  STAGE_BREAK_SEED,
} from './break-style.js';
import { lipFoamCompositeAt } from './lip-foam-jacobian.js';
import {
  applyOverlayReadout,
  overlayReadout,
} from './overlay-readout.js';
import {
  updateShoreWash,
  verifyShoreWhitewash,
  SHORE_RADIUS_M,
} from './shore-whitewash.js';
import {
  reefWhitewashComposite,
  updateReefWash,
  verifyReefWhitewash,
  REEF_RADIUS_M,
} from './reef-whitewash.js';
import { loadEnvironment } from './land.js';
import {
  MAVERICKS_VIEWS,
  loadMavericksTerrain,
  viewsForMeta,
  verifiedViewsForMeta,
} from './mavericks-terrain.js';
import { logViewVerification } from './mavericks-views-verify.js';
import {
  loadMavericksMeta,
  logPinSample,
} from './mavericks-pins.js';
import {
  createDemHeightTexture,
  logShorelineSamples,
} from './mavericks-dem-texture.js';
import {
  BREAK_PEAK,
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
  /** @type {Awaited<ReturnType<typeof loadMavericksMeta>> | null} */
  let metaBundle = null;
  try {
    metaBundle = await loadMavericksMeta();
    logPinSample(metaBundle.pins);
  } catch (error) {
    console.warn('[sounding] meta pins failed', error);
  }

  const pins = metaBundle?.pins ?? {
    mslY: MSL_Y,
    breakPeak: BREAK_PEAK,
    buoyXz: BUOY_XZ,
    swellFromDeg: MAVERICKS_SEA.swell.directionDegrees,
  };
  const viewBundle = metaBundle
    ? verifiedViewsForMeta(metaBundle.pins)
    : { views: MAVERICKS_VIEWS, report: null };
  const stageViews = viewBundle.views;
  if (viewBundle.report) {
    logViewVerification(viewBundle.report);
  }
  const mslY = pins.mslY;

  /** @type {ReturnType<typeof createDemHeightTexture> | null} */
  let dem = null;
  /** @type {Float32Array | null} */
  let demHeights = null;
  if (metaBundle?.meta) {
    try {
      const buf = await fetch('/land/mavericks/height.f32').then((r) =>
        r.arrayBuffer(),
      );
      demHeights = new Float32Array(buf);
      dem = createDemHeightTexture(demHeights, metaBundle.meta);
      logShorelineSamples(dem, mslY, [
        { name: 'spectators_beach', x: -100, z: 100 },
        { name: 'station_plateau', x: -182, z: 322 },
        { name: 'break_peak', x: pins.breakPeak.x, z: pins.breakPeak.z },
        { name: 'sail_rock', x: -338, z: -197 },
        { name: 'cliff_toe_west', x: -520, z: -80 },
      ]);
    } catch (error) {
      console.warn('[sounding] DEM shoreline clip failed', error);
    }
  }

  const viewName = params.get('view') || 'fallaway';
  const view = stageViews[viewName] || {
    position: DESIGN_CAMERA.position,
    lookAt: {
      x: pins.breakPeak.x,
      y: DESIGN_CAMERA.lookAt.y,
      z: pins.breakPeak.z,
    },
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
  const shoreCenter = pins.spectators ?? { x: -100, z: 100 };
  const reefPeak = pins.breakPeak ?? { x: -440, z: -20 };
  const oceanMaterial = createOceanMaterial(oceanSystem.cascades, {
    patchLengths: MAVERICKS_SEA.patchLengths,
    sunDirection,
    detailTexture,
    dem,
    shorelineBias: 0.08,
    shoreCenter,
    shoreRadius: SHORE_RADIUS_M,
    reefPeak,
    reefRadius: REEF_RADIUS_M,
    stillWaterY: mslY,
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
  oceanMesh.position.y = mslY;
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

  const surfaceProbe = new SurfaceProbe(renderer, MAVERICKS_SEA.patchLengths);
  /** @deprecated cascade-only probe kept for regression compare during alignment QA */
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
    terrain = await loadMavericksTerrain(metaBundle?.meta, demHeights ?? undefined);
    scene.add(terrain.group);
  } catch (error) {
    console.warn('[sounding] DEM terrain failed', error);
  }

  const peak = terrain?.pins?.breakPeak ?? pins.breakPeak ?? {
    x: BUOY_XZ.x,
    z: BUOY_XZ.z,
  };
  const buoyXz = { x: peak.x, z: peak.z };
  const swellFrom =
    terrain?.pins?.swellFromDeg ??
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
  const breakPolyline =
    terrain?.pins?.polyline ?? metaBundle?.pins?.polyline ?? [];
  const breakSeed = Number(params.get('seed')) || STAGE_BREAK_SEED;
  const setWaveSchedule = buildSetWaveSchedule(
    reading,
    buoyXz,
    breakPolyline,
    breakSeed,
  );
  const crestLine = verifyCurvedCrestOnPolyline(
    breakPolyline,
    setWaveSchedule.buoyAlong,
    setWaveSchedule.dir,
  );
  const breakStyles = verifyBreakStyleDistribution(
    setWaveSchedule.events,
    setWaveSchedule.seed,
  );
  console.info('[mavericks] curved crest line', crestLine);
  console.info('[mavericks] break styles', breakStyles);
  const shoreWhitewash = verifyShoreWhitewash(shoreCenter);
  console.info('[mavericks] shore whitewash', shoreWhitewash);
  const reefWhitewash = verifyReefWhitewash(reefPeak);
  console.info('[mavericks] reef whitewash', reefWhitewash);
  const openerPeak = sampleSetWave(setWaveSchedule, 4);
  const overlayVerify = {
    ok:
      openerPeak.active > 0.2 &&
      openerPeak.label === 'opener' &&
      openerPeak.breakStyle === 'spill' &&
      overlayReadout({
        setWave: openerPeak,
        viewName: 'reef',
        eta: 8,
        reading,
      }).heat === 'heat · opener · spill · reef',
    opener: {
      label: openerPeak.label,
      breakStyle: openerPeak.breakStyle,
      active: Number(openerPeak.active.toFixed(3)),
    },
  };
  console.info('[mavericks] overlay readout', overlayVerify);
  let currentView = viewName;

  let elapsed = 0;
  const loopParam = params.get('loop_t');
  if (loopParam != null) {
    const seek = Number(loopParam);
    if (Number.isFinite(seek)) {
      elapsed = ((seek % setWaveSchedule.loopSec) + setWaveSchedule.loopSec) %
        setWaveSchedule.loopSec;
    }
  }

  /** @param {string} name */
  const syncViewUrl = (name) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', name);
      window.history.replaceState(null, '', url);
    } catch (error) {
      console.warn('[sounding] view URL sync failed', error);
    }
  };

  /** @param {ReturnType<typeof sampleSetWave>} setWave */
  let lastSetWave = sampleSetWave(setWaveSchedule, elapsed);
  let lastEta = 0;

  const overlayElements = { waveEl, asOfEl };

  /** @param {ReturnType<typeof sampleSetWave>} setWave @param {number} eta */
  const refreshOverlay = (setWave, eta) => {
    lastSetWave = setWave;
    lastEta = eta;
    const readout = applyOverlayReadout(overlayElements, {
      setWave,
      viewName: currentView,
      eta,
      reading,
    });
    if (window.__soundingSea) {
      window.__soundingSea.overlay = readout;
      window.__soundingSea.view = currentView;
      window.__soundingSea.setWave = setWave;
    }
    return readout;
  };

  /** @param {string} name */
  const setView = (name) => {
    const v = stageViews[name];
    if (!v) return;
    currentView = name;
    camera.fov = v.fov;
    camera.updateProjectionMatrix();
    camera.position.set(v.position.x, v.position.y, v.position.z);
    camera.lookAt(v.lookAt.x, v.lookAt.y, v.lookAt.z);
    syncViewUrl(name);
    refreshOverlay(lastSetWave, lastEta);
  };

  window.__soundingSea = {
    setView,
    views: Object.keys(stageViews),
    camera,
    meta: terrain?.meta ?? metaBundle?.meta ?? null,
    pins: terrain?.pins ?? metaBundle?.pins ?? null,
    demClip: dem ? { enabled: true, shorelineBias: 0.08 } : null,
    viewVerify: viewBundle.report,
    demAudit: terrain?.demAudit ?? null,
    cliffQa: terrain?.cliffQa ?? null,
    crestLine,
    breakStyles,
    lipFoam: null,
    overlay: overlayReadout({
      setWave: lastSetWave,
      viewName: currentView,
      eta: lastEta,
      reading,
    }),
    overlayVerify,
    shoreWhitewash,
    reefWhitewash,
    shoreWash: { level: 0, center: shoreCenter },
    reefWash: { level: 0, peak: reefPeak },
    view: currentView,
    setWave: lastSetWave,
    mslY,
    buoyXz,
    ready: false,
  };
  window.__soundingBoot = window.__soundingSea;
  refreshOverlay(lastSetWave, 0);

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

  let alignmentChecks = 0;
  const maxAlignmentChecks = 120;
  const shoreWashState = { level: 0 };
  const reefWashState = { level: 0 };

  const tick = (ts) => {
    if (disposed) return;
    frameId = requestAnimationFrame(tick);
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    elapsed += dt;

    const setWave = sampleSetWave(setWaveSchedule, elapsed);
    applySetWaveUniforms(oceanMaterial, setWave, setWaveSchedule);
    const shoreLevel = updateShoreWash(shoreWashState, setWave, dt);
    const reefLevel = updateReefWash(reefWashState, setWave, dt);
    oceanMaterial.uniforms.shoreWash.value = shoreLevel;
    oceanMaterial.uniforms.reefWash.value = reefLevel;
    if (window.__soundingSea) {
      const lip = lipFoamCompositeAt(
        setWave,
        buoyXz.x,
        buoyXz.z,
        setWaveSchedule,
      );
      window.__soundingSea.lipFoam = lip;
      window.__soundingSea.shoreWash = {
        level: Number(shoreLevel.toFixed(4)),
        center: shoreCenter,
      };
      window.__soundingSea.reefWash = {
        level: Number(reefLevel.toFixed(4)),
        peak: reefPeak,
      };
      window.__soundingSea.reefFoam = reefWhitewashComposite(
        0.55,
        lip.lipJ,
        reefWhitewash.reefMask,
        reefLevel,
      );
    }

    oceanSystem.update(elapsed, dt);
    updateOceanMaterialTextures(oceanMaterial, oceanSystem.cascades);
    oceanMaterial.uniforms.time.value = elapsed;

    const gpuDisp = surfaceProbe.sample(
      oceanSystem.cascades,
      oceanMaterial,
      buoyXz.x,
      buoyXz.z,
    );
    const eta = gpuDisp.y;
    const dispX = gpuDisp.x;
    const dispZ = gpuDisp.z;

    if (alignmentChecks < maxAlignmentChecks) {
      const cascade = heightProbe.sample(
        oceanSystem.cascades,
        buoyXz.x,
        buoyXz.z,
      );
      const cascadeScale = oceanMaterial.uniforms.cascadeScale.value;
      const face = setWaveDisplacementAt(
        setWave,
        buoyXz.x,
        buoyXz.z,
        setWaveSchedule,
      );
      const swell = ambientSwellAt(setWaveSchedule, elapsed, buoyXz.x, buoyXz.z);
      const cpuEta = cascade.y * cascadeScale + face.y + swell.y;
      const cpuDisp = new THREE.Vector3(
        cascade.x * cascadeScale + face.x + swell.x,
        cpuEta,
        cascade.z * cascadeScale + face.z + swell.z,
      );
      surfaceProbe.recordAlignment(gpuDisp, cpuDisp);
      alignmentChecks += 1;
      if (alignmentChecks === maxAlignmentChecks) {
        logBuoyAlignment(surfaceProbe.alignment);
        if (window.__soundingSea) {
          window.__soundingSea.buoyAlignment = surfaceProbe.alignment;
        }
      }
    }

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
      buoy.group.position.y = mslY + buoy.dynamics.heave;
    }

    if (metersEl) {
      const display =
        setWave.active > 0.15
          ? Math.max(Math.abs(eta), setWave.face_m * setWave.active * 0.85)
          : Math.max(0.1, Math.abs(eta));
      metersEl.textContent = display.toFixed(1);
    }
    refreshOverlay(setWave, eta);

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
      surfaceProbe.dispose();
      heightProbe.dispose();
      buoy?.dispose();
      dem?.dispose();
      terrain?.dispose();
      renderer.dispose();
      mount.replaceChildren();
    },
  };
}
