/**
 * Full sea stage on USGS DEM land: spectral ocean at MHHW, set waves at break peak.
 * Default boot path (bare URL). Legacy alias: ?focus=sea. Land-only: ?focus=land.
 */
import * as THREE from 'three';
import { createBootBudget, createPerfMonitor, verifyBootBudget } from './boot-budget.js';
import {
  verifyPlaceholderBoot,
} from './boot-placeholder.js';
import { createBootPlaceholder } from './boot-placeholder-stage.js';
import { createLayerPanel, verifyLayerControls } from './layer-controls.js';
import {
  sampleQualityRamp,
  verifyQualityRamp,
  SEGMENT_TIERS,
} from './quality-ramp.js';
import {
  createOceanSystemAtResolution,
  setOceanSegmentTier,
} from './quality-ramp-ocean.js';
import {
  createPerfGate,
  effectiveOceanSegments,
  effectiveDpr,
  shouldUpdateOceanFft,
  verifyPerfGate,
} from './perf-gate.js';
import { SpectralOceanSystem } from '../ocean/ocean-system.js';
import {
  createOceanMaterial,
  createSkyMaterial,
  updateOceanMaterialTextures,
} from '../ocean/ocean-material.js';
import { createOceanDetailTexture } from '../ocean/detail-texture.js';
import { loadBuoy } from './buoy.js';
import {
  attachBuoySpray,
  updateSprayLevel,
  verifyBuoySpray,
} from './buoy-spray.js';
import { verifyFoamQa } from './foam-qa.js';
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
import { auditHeroViews } from './hero-views-runtime.js';
import { auditFpsSettle } from './fps-settle-verify.js';
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
  OCEAN_SIZE,
  SUN_DIRECTION,
} from './sea-state.js';

/**
 * @param {HTMLElement} mount
 * @param {URLSearchParams} params
 */
export async function bootSeaStage(mount, params) {
  const bootBudget = createBootBudget({ mode: 'sea' });
  const perfMonitor = createPerfMonitor();
  const perfGate = createPerfGate();
  const perfDebug = params.get('debug') === 'perf';
  const viewName = params.get('view') || 'fallaway';
  let mslY = MSL_Y;
  const view = MAVERICKS_VIEWS[viewName] || {
    position: DESIGN_CAMERA.position,
    lookAt: {
      x: BREAK_PEAK.x,
      y: DESIGN_CAMERA.lookAt.y,
      z: BREAK_PEAK.z,
    },
    fov: DESIGN_CAMERA.fov,
  };

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(
    effectiveDpr(0, window.devicePixelRatio || 1),
  );
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.replaceChildren(renderer.domElement);
  bootBudget.mark('rendererReady');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a5b9c);

  const camera = new THREE.PerspectiveCamera(
    view.fov,
    mount.clientWidth / Math.max(mount.clientHeight, 1),
    DESIGN_CAMERA.near,
    DESIGN_CAMERA.far,
  );
  camera.position.set(view.position.x, view.position.y, view.position.z);
  camera.lookAt(view.lookAt.x, view.lookAt.y, view.lookAt.z);

  const placeholder = createBootPlaceholder({ mslY });

  renderer.render(scene, camera);
  bootBudget.mark('firstFrame');

  placeholder.attach(scene);
  renderer.render(scene, camera);
  bootBudget.mark('placeholderReady');
  console.info('[mavericks] placeholder boot', verifyPlaceholderBoot(bootBudget.snapshot()));

  const sunDirection = new THREE.Vector3(
    SUN_DIRECTION.x,
    SUN_DIRECTION.y,
    SUN_DIRECTION.z,
  ).normalize();

  scene.add(new THREE.AmbientLight(0xb8c4d0, 0.45));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.copy(sunDirection).multiplyScalar(400);
  scene.add(sun);

  const skyMaterial = createSkyMaterial({ sunDirection });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 32, 16),
    skyMaterial,
  );
  sky.frustumCulled = false;
  scene.add(sky);
  scene.background = null;

  let placeholderSpinId = 0;
  let placeholderActive = true;
  const spinPlaceholder = () => {
    if (!placeholderActive) return;
    renderer.render(scene, camera);
    placeholderSpinId = requestAnimationFrame(spinPlaceholder);
  };
  placeholderSpinId = requestAnimationFrame(spinPlaceholder);

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
  mslY = pins.mslY;
  placeholder.ocean.position.y = mslY;
  placeholder.terrain.position.y = mslY + 14;

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

  const oceanSystem = new SpectralOceanSystem(renderer, {
    ...MAVERICKS_SEA,
    resolution: 64,
  });
  let activeOceanSystem = oceanSystem;
  let currentFftResolution = 64;
  let fftUpgradeDone = false;

  const detailTexture = createOceanDetailTexture(512, MAVERICKS_SEA.seed);
  const shoreCenter = pins.spectators ?? { x: -100, z: 100 };
  const reefPeak = pins.breakPeak ?? { x: -440, z: -20 };
  const oceanMaterial = createOceanMaterial(activeOceanSystem.cascades, {
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
  const targetFoamScale = 0.7;
  const targetDetailStrength = 0.006;
  oceanMaterial.uniforms.foamScale.value = 0;
  oceanMaterial.uniforms.foamThreshold.value = 0.2;
  oceanMaterial.uniforms.detailStrength.value = 0;
  oceanMaterial.uniforms.fogDensity.value = 0.00125;
  oceanMaterial.uniforms.scatterColor.value.set(0x3aa0a0);

  const bootSegments = SEGMENT_TIERS[0];
  const oceanGeometry = new THREE.PlaneGeometry(
    OCEAN_SIZE,
    OCEAN_SIZE,
    bootSegments,
    bootSegments,
  );
  oceanGeometry.rotateX(-Math.PI / 2);
  const oceanMesh = new THREE.Mesh(oceanGeometry, oceanMaterial);
  oceanMesh.position.y = mslY;
  oceanMesh.frustumCulled = false;
  scene.add(oceanMesh);
  placeholder.ocean.visible = false;

  oceanMaterial.uniforms.sunDirection.value.copy(sunDirection);
  skyMaterial.uniforms.sunDirection.value.copy(sunDirection);
  bootBudget.mark('sceneReady');
  placeholder.detach(scene);
  placeholder.dispose();
  bootBudget.mark('placeholderSwap');

  const surfaceProbe = new SurfaceProbe(renderer, MAVERICKS_SEA.patchLengths);
  /** @deprecated cascade-only probe kept for regression compare during alignment QA */
  const heightProbe = new HeightProbe(renderer, MAVERICKS_SEA.patchLengths);

  /** @type {Awaited<ReturnType<typeof loadBuoy>> | null} */
  let buoy = null;
  /** @type {import('./buoy-spray.js').BuoySpray | null} */
  let buoySpray = null;
  try {
    buoy = await loadBuoy();
    scene.add(buoy.group);
    buoySpray = attachBuoySpray(buoy.group);
    bootBudget.mark('buoyReady');
  } catch (error) {
    console.warn('[sounding] buoy load failed', error);
  }

  try {
    await loadEnvironment(renderer, scene);
  } catch (error) {
    console.warn('[sounding] environment failed', error);
  }
  const hdriEnv = scene.environment;

  /** @type {Awaited<ReturnType<typeof loadMavericksTerrain>> | null} */
  let terrain = null;
  try {
    terrain = await loadMavericksTerrain(metaBundle?.meta, demHeights ?? undefined);
    scene.add(terrain.group);
    bootBudget.mark('terrainReady');
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
  const buoySprayVerify = verifyBuoySpray();
  console.info('[mavericks] buoy spray', buoySprayVerify);
  const foamQa = verifyFoamQa({
    spectators: shoreCenter,
    breakPeak: reefPeak,
  });
  console.info('[mavericks] foam QA', foamQa);
  const bootVerify = verifyBootBudget(bootBudget.snapshot());
  console.info('[mavericks] boot budget (pre-tick)', bootVerify);
  const layerVerify = verifyLayerControls();
  console.info('[mavericks] layer controls', layerVerify);
  const qualityRampVerify = verifyQualityRamp();
  console.info('[mavericks] quality ramp', qualityRampVerify);
  console.info(
    '[mavericks] perf gate',
    verifyPerfGate({ fps: 0, tier: 0, rampSettled: false, samples: 0 }),
  );

  const publishBootState = () => {
    const budget = bootBudget.snapshot();
    const verify = verifyBootBudget(budget);
    const perf = perfMonitor?.snapshot() ?? null;
    if (window.__soundingSea) {
      window.__soundingSea.budget = budget;
      window.__soundingSea.perf = perf;
      window.__soundingSea.bootVerify = verify;
      window.__soundingSea.ready = budget.fullyReadyMs != null;
    }
  };
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

  const debugParam = params.get('debug');
  if (debugParam != null && debugParam !== 'perf') {
    oceanMaterial.uniforms.debugMode.value = Number(debugParam) || 0;
  }

  const storedFoamScale = targetFoamScale;
  const storedDetailStrength = targetDetailStrength;
  const storedSwell1 = oceanMaterial.uniforms.swellAmplitude.value;
  const storedSwell2 = oceanMaterial.uniforms.swell2Amplitude.value;
  const layerFlags = { fft: true, setWave: true, spray: true };

  const layerPanel = createLayerPanel({
    params,
    onShaderMode: (mode) => {
      oceanMaterial.uniforms.debugMode.value = mode;
    },
    layers: [
      {
        id: 'terrain',
        label: 'Terrain mesh',
        group: 'stage',
        apply: (on) => {
          if (terrain) terrain.group.visible = on;
        },
      },
      {
        id: 'buoy',
        label: 'Buoy',
        group: 'stage',
        apply: (on) => {
          if (buoy) buoy.group.visible = on;
        },
      },
      {
        id: 'spray',
        label: 'Spray',
        group: 'stage',
        apply: (on) => {
          layerFlags.spray = on;
        },
      },
      {
        id: 'sky',
        label: 'Sky',
        group: 'stage',
        apply: (on) => {
          sky.visible = on;
        },
      },
      {
        id: 'hdri',
        label: 'HDRI IBL',
        group: 'stage',
        apply: (on) => {
          scene.environment = on ? hdriEnv : null;
        },
      },
      {
        id: 'sun',
        label: 'Sun',
        group: 'stage',
        apply: (on) => {
          sun.visible = on;
        },
      },
      {
        id: 'ocean',
        label: 'Ocean mesh',
        group: 'ocean',
        apply: (on) => {
          oceanMesh.visible = on;
        },
      },
      {
        id: 'fft',
        label: 'FFT cascade',
        group: 'ocean',
        apply: (on) => {
          layerFlags.fft = on;
        },
      },
      {
        id: 'swell',
        label: 'Background swell',
        group: 'ocean',
        apply: (on) => {
          oceanMaterial.uniforms.swellAmplitude.value = on ? storedSwell1 : 0;
          oceanMaterial.uniforms.swell2Amplitude.value = on ? storedSwell2 : 0;
        },
      },
      {
        id: 'set-wave',
        label: 'Set-wave overlay',
        group: 'ocean',
        apply: (on) => {
          layerFlags.setWave = on;
        },
      },
      {
        id: 'shoreline',
        label: 'Shoreline clip',
        group: 'ocean',
        apply: (on) => {
          oceanMaterial.uniforms.demClipEnabled.value = on && dem ? 1 : 0;
        },
      },
      {
        id: 'foam',
        label: 'Foam',
        group: 'ocean',
        apply: (on) => {
          oceanMaterial.uniforms.foamScale.value = on ? storedFoamScale : 0;
        },
      },
      {
        id: 'detail',
        label: 'Detail chop',
        group: 'ocean',
        apply: (on) => {
          oceanMaterial.uniforms.detailStrength.value = on ? storedDetailStrength : 0;
        },
      },
    ],
  });
  console.info('[mavericks] layer panel', layerPanel.snapshot());

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
    buoySpray: buoySprayVerify,
    foamQa,
    shoreWash: { level: 0, center: shoreCenter },
    reefWash: { level: 0, peak: reefPeak },
    spray: { level: 0 },
    budget: bootBudget.snapshot(),
    perf: perfMonitor.snapshot(),
    bootVerify,
    view: currentView,
    setWave: lastSetWave,
    mslY,
    buoyXz,
    ready: false,
    layers: layerPanel,
    placeholder: verifyPlaceholderBoot(bootBudget.snapshot()),
    qualityRamp: sampleQualityRamp(0),
    qualityRampVerify,
    perfGate: perfGate.snapshot(),
    heroViewsAudit: () => auditHeroViews(setView, () => window.__soundingSea),
    fpsSettleAudit: () => auditFpsSettle(() => window.__soundingSea),
  };
  window.__soundingBoot = window.__soundingSea;
  console.info('[mavericks] boot budget', window.__soundingBoot.budget);
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

  let alignmentChecks = 0;
  const maxAlignmentChecks = 120;
  const shoreWashState = { level: 0 };
  const reefWashState = { level: 0 };
  const sprayState = { level: 0 };
  let bootSettled = false;

  let rampElapsed = 0;
  let currentSegments = bootSegments;
  let rampSettled = false;
  let frameIndex = 0;
  let currentDpr = effectiveDpr(0, window.devicePixelRatio || 1);
  /** @type {THREE.Vector3 | null} */
  let cachedBuoyDisp = null;
  let buoyDispValid = false;

  const tick = (ts) => {
    if (disposed) return;
    if (placeholderActive) {
      placeholderActive = false;
      cancelAnimationFrame(placeholderSpinId);
    }
    frameId = requestAnimationFrame(tick);
    frameIndex += 1;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    elapsed += dt;
    rampElapsed += dt;
    const ramp = sampleQualityRamp(rampElapsed);

    perfMonitor.tick(dt);
    const perfSnap = perfMonitor.snapshot();
    const gateSnap = perfGate.tick({
      fps: perfSnap.fps,
      rampSettled: ramp.settled,
      samples: perfSnap.samples,
    });
    const perfProfile = gateSnap.profile;
    const targetSegments = effectiveOceanSegments(ramp, gateSnap.tier);
    const targetDpr = effectiveDpr(gateSnap.tier, window.devicePixelRatio || 1);

    if (targetDpr !== currentDpr) {
      currentDpr = targetDpr;
      renderer.setPixelRatio(currentDpr);
      onResize();
    }

    if (targetSegments !== currentSegments) {
      setOceanSegmentTier(oceanMesh, targetSegments);
      currentSegments = targetSegments;
    }
    if (ramp.fftResolution === 128 && currentFftResolution === 64 && !fftUpgradeDone) {
      fftUpgradeDone = true;
      activeOceanSystem = createOceanSystemAtResolution(renderer, MAVERICKS_SEA, 128);
      updateOceanMaterialTextures(oceanMaterial, activeOceanSystem.cascades);
      currentFftResolution = 128;
      bootBudget.mark('fftTier128');
    }
    oceanMaterial.uniforms.foamScale.value =
      storedFoamScale * ramp.fxScale * perfProfile.fxMul;
    oceanMaterial.uniforms.detailStrength.value =
      storedDetailStrength * ramp.fxScale * perfProfile.fxMul;

    if (ramp.settled && !rampSettled) {
      rampSettled = true;
      bootBudget.mark('qualityRampSettled');
      console.info('[mavericks] quality ramp settled', ramp);
    }
    if (window.__soundingSea) {
      window.__soundingSea.qualityRamp = ramp;
      window.__soundingSea.perf = perfSnap;
      window.__soundingSea.perfGate = gateSnap;
      if (perfDebug && gateSnap.gateArmed && frameIndex % 120 === 0) {
        console.info('[mavericks] perf gate', gateSnap);
      }
    }

    if (!bootSettled) {
      bootBudget.mark('fullyReady');
      bootSettled = true;
      publishBootState();
      console.info('[mavericks] boot budget (settled)', window.__soundingBoot?.bootVerify);
    }

    const setWave = sampleSetWave(setWaveSchedule, elapsed);
    if (layerFlags.setWave) {
      applySetWaveUniforms(oceanMaterial, setWave, setWaveSchedule);
    } else {
      applySetWaveUniforms(
        oceanMaterial,
        { ...setWave, active: 0, amplitude: 0 },
        setWaveSchedule,
      );
    }
    if (!layerFlags.fft) {
      oceanMaterial.uniforms.cascadeScale.value = 0;
    }
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

    if (layerFlags.fft && shouldUpdateOceanFft(frameIndex, perfProfile.fftSkip)) {
      activeOceanSystem.update(elapsed, dt);
      updateOceanMaterialTextures(oceanMaterial, activeOceanSystem.cascades);
    }
    oceanMaterial.uniforms.time.value = elapsed;

    const fftFrame = shouldUpdateOceanFft(frameIndex, perfProfile.fftSkip);
    if (!cachedBuoyDisp) {
      cachedBuoyDisp = new THREE.Vector3();
    }
    if (layerFlags.fft && (fftFrame || !buoyDispValid)) {
      cachedBuoyDisp.copy(
        surfaceProbe.sample(
          activeOceanSystem.cascades,
          oceanMaterial,
          buoyXz.x,
          buoyXz.z,
        ),
      );
      buoyDispValid = true;
    } else if (!layerFlags.fft) {
      cachedBuoyDisp.set(0, 0, 0);
      buoyDispValid = false;
    }
    const gpuDisp = cachedBuoyDisp;
    const eta = gpuDisp.y;
    const dispX = gpuDisp.x;
    const dispZ = gpuDisp.z;

    if (alignmentChecks < maxAlignmentChecks) {
      const cascade = heightProbe.sample(
        activeOceanSystem.cascades,
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

    const sprayLevel =
      layerFlags.spray && ramp.fxScale > 0.85 && perfProfile.spray
        ? updateSprayLevel(sprayState, setWave, dt, eta)
        : 0;
    if (buoySpray) {
      buoySpray.update({ level: sprayLevel, dt, camera });
    }
    if (window.__soundingSea) {
      window.__soundingSea.spray = { level: Number(sprayLevel.toFixed(4)) };
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
      delete window.__soundingBoot;
      layerPanel.dispose();
      oceanGeometry.dispose();
      oceanMaterial.dispose();
      sky.geometry.dispose();
      skyMaterial.dispose();
      detailTexture.dispose();
      surfaceProbe.dispose();
      heightProbe.dispose();
      buoy?.dispose();
      buoySpray?.dispose();
      dem?.dispose();
      terrain?.dispose();
      renderer.dispose();
      mount.replaceChildren();
    },
  };
}
