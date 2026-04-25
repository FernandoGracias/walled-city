import * as THREE from 'three';
import { wallMat, floorMat, ceilingMat } from '../materials.js';

/**
 * Generate a straight corridor segment.
 * @param {Object} seg - Segment data from JSON
 * @param {THREE.Vector3} cursor - Current world position
 * @param {number} angle - Current direction angle (radians, 0 = -Z)
 * @returns {{ meshes: THREE.Group, colliders: THREE.Box3[] }}
 */
export function generateStraight(seg, cursor, angle) {
  const { length, width, height } = seg;
  const hw = width / 2;
  const group = new THREE.Group();

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, length), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -length / 2);
  group.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, length), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, height, -length / 2);
  group.add(ceiling);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wallMat);
  leftWall.position.set(-hw, height / 2, -length / 2);
  leftWall.rotation.y = Math.PI / 2;
  group.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wallMat);
  rightWall.position.set(hw, height / 2, -length / 2);
  rightWall.rotation.y = -Math.PI / 2;
  group.add(rightWall);

  // Position and rotate the group to world space
  group.position.copy(cursor);
  group.rotation.y = angle;
  group.updateMatrixWorld(true);

  // Compute wall colliders in world space
  const colliders = [];
  for (const wall of [leftWall, rightWall]) {
    const box = new THREE.Box3().setFromObject(wall);
    box.expandByVector(new THREE.Vector3(0.15, 0, 0.15));
    colliders.push(box);
  }

  return { meshes: group, colliders };
}
