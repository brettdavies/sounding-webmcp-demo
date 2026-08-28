/**
 * Ocean mesh segment tier swaps during quality ramp.
 */
import * as THREE from 'three';
import { SpectralOceanSystem } from '../ocean/ocean-system.js';
import { OCEAN_SIZE } from './sea-state.js';

/**
 * @param {THREE.Mesh} mesh
 * @param {number} segments
 */
export function setOceanSegmentTier(mesh, segments) {
  const previous = mesh.geometry;
  const geometry = new THREE.PlaneGeometry(
    OCEAN_SIZE,
    OCEAN_SIZE,
    segments,
    segments,
  );
  geometry.rotateX(-Math.PI / 2);
  mesh.geometry = geometry;
  previous.dispose();
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {typeof import('./sea-state.js').MAVERICKS_SEA} seaConfig
 * @param {number} resolution
 */
export function createOceanSystemAtResolution(renderer, seaConfig, resolution) {
  return new SpectralOceanSystem(renderer, {
    ...seaConfig,
    resolution,
  });
}
