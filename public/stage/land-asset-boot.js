/**
 * Land-only Mavericks asset viewer — DEM terrain, no ocean / buoy / heat.
 */
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import {
  MAVERICKS_VIEWS,
  loadMavericksTerrain,
} from './mavericks-terrain.js';
import { logPinSample } from './mavericks-pins.js';
import { logViewVerification } from './mavericks-views-verify.js';
import { landOverlayReadout } from './overlay-readout.js';

/**
 * @param {HTMLElement} mount
 * @param {URLSearchParams} params
 */
export async function bootLandAsset(mount, params) {
  // Default: fallaway — offshore hero (undersea + tip + radome).
  const viewName = params.get('view') || 'fallaway';
  const view = MAVERICKS_VIEWS[viewName] || MAVERICKS_VIEWS.fallaway;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87a0b8);
  scene.fog = new THREE.Fog(0x87a0b8, 800, 4200);

  const camera = new THREE.PerspectiveCamera(
    view.fov,
    mount.clientWidth / Math.max(mount.clientHeight, 1),
    1,
    8000,
  );
  camera.position.set(view.position.x, view.position.y, view.position.z);
  camera.lookAt(view.lookAt.x, view.lookAt.y, view.lookAt.z);

  scene.add(new THREE.AmbientLight(0xd0d8e0, 0.55));
  scene.add(new THREE.HemisphereLight(0xb8c8d8, 0x6a5a48, 0.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(400, 600, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 2000;
  sun.shadow.camera.left = -800;
  sun.shadow.camera.right = 800;
  sun.shadow.camera.top = 800;
  sun.shadow.camera.bottom = -800;
  scene.add(sun);

  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const hdr = await new RGBELoader().loadAsync(
      '/hdri/salt_rock_beach_cloudy_2k.hdr',
    );
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pmrem.dispose();
  } catch (error) {
    console.warn('[sounding] HDRI skipped', error);
  }

  const terrain = await loadMavericksTerrain();
  scene.add(terrain.group);
  logPinSample(terrain.pins);
  logViewVerification(terrain.viewVerify);
  const stageViews = terrain.views;

  const metersEl = document.getElementById('meters');
  const waveEl = document.getElementById('wave');
  const asOfEl = document.getElementById('as-of');
  let currentView = viewName;
  if (metersEl) {
    metersEl.textContent = (terrain.meta.station_local?.y ?? 40).toFixed(0);
  }
  const landReadout = landOverlayReadout(currentView);
  if (waveEl) waveEl.textContent = landReadout.wave;
  if (asOfEl) asOfEl.textContent = landReadout.heat;

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
    const readout = landOverlayReadout(name);
    if (waveEl) waveEl.textContent = readout.wave;
    if (asOfEl) asOfEl.textContent = readout.heat;
    if (window.__soundingLand) {
      window.__soundingLand.overlay = readout;
      window.__soundingLand.view = name;
    }
  };

  window.__soundingLand = {
    setView,
    views: Object.keys(stageViews),
    camera,
    meta: terrain.meta,
    pins: terrain.pins,
    overlay: landReadout,
    view: currentView,
  };

  let frameId = 0;
  let disposed = false;
  const onResize = () => {
    const w = mount.clientWidth;
    const h = Math.max(mount.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', onResize);

  const tick = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(tick);
    renderer.render(scene, camera);
  };
  requestAnimationFrame(tick);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      delete window.__soundingLand;
      terrain.dispose();
      renderer.dispose();
      mount.replaceChildren();
    },
  };
}
