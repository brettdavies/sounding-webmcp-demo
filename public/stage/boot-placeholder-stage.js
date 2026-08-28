/**
 * Progressive boot placeholder meshes — flat terrain/ocean before async assets.
 */
import * as THREE from 'three';
import { OCEAN_SIZE } from './sea-state.js';

/**
 * @param {{ mslY: number }} options
 */
export function createBootPlaceholder(options) {
  const group = new THREE.Group();
  group.name = 'boot-placeholder';

  const oceanGeometry = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, 2, 2);
  oceanGeometry.rotateX(-Math.PI / 2);
  const oceanMaterial = new THREE.MeshBasicMaterial({ color: 0x143848 });
  const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
  ocean.name = 'placeholder-ocean';
  ocean.position.y = options.mslY;
  ocean.frustumCulled = false;
  group.add(ocean);

  const terrainGeometry = new THREE.PlaneGeometry(1700, 1300, 1, 1);
  terrainGeometry.rotateX(-Math.PI / 2);
  const terrainMaterial = new THREE.MeshBasicMaterial({ color: 0x7a6d58 });
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.name = 'placeholder-terrain';
  terrain.position.set(-180, options.mslY + 14, 210);
  terrain.frustumCulled = false;
  group.add(terrain);

  return {
    group,
    ocean,
    terrain,
    /** @param {THREE.Scene} scene */
    attach(scene) {
      scene.add(group);
    },
    /** @param {THREE.Scene} scene */
    detach(scene) {
      scene.remove(group);
    },
    dispose() {
      oceanGeometry.dispose();
      oceanMaterial.dispose();
      terrainGeometry.dispose();
      terrainMaterial.dispose();
    },
  };
}
