import * as THREE from 'three';
import { wallMat, floorMat, ceilingMat } from '../materials.js';

/**
 * Generate a T-junction segment.
 * The main corridor continues forward, with a branch extending to one side.
 * The junction occupies a width×width area, and the branch extends branch_length further.
 *
 * @param {Object} seg - { width, height, branch_length, branch_direction: "left"|"right" }
 * @param {THREE.Vector3} cursor - Current world position
 * @param {number} angle - Current direction angle (radians)
 * @returns {{ meshes: THREE.Group, colliders: THREE.Box3[] }}
 */
export function generateTJunction(seg, cursor, angle) {
  const width = seg.width || 2.5;
  const height = seg.height || 4;
  const hw = width / 2;
  const branchLen = seg.branch_length || 4;
  const branchDir = seg.branch_direction || 'left';
  const branchSign = branchDir === 'left' ? -1 : 1;

  const group = new THREE.Group();

  // Main junction floor (width × width)
  const jFloor = new THREE.Mesh(new THREE.PlaneGeometry(width, width), floorMat);
  jFloor.rotation.x = -Math.PI / 2;
  jFloor.position.set(0, 0, -hw);
  group.add(jFloor);

  // Main junction ceiling
  const jCeil = new THREE.Mesh(new THREE.PlaneGeometry(width, width), ceilingMat);
  jCeil.rotation.x = Math.PI / 2;
  jCeil.position.set(0, height, -hw);
  group.add(jCeil);

  // Wall on the side opposite the branch
  const solidWall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  solidWall.rotation.y = branchSign === -1 ? -Math.PI / 2 : Math.PI / 2;
  solidWall.position.set(-branchSign * hw, height / 2, -hw);
  group.add(solidWall);

  // Branch floor
  const bFloor = new THREE.Mesh(new THREE.PlaneGeometry(width, branchLen), floorMat);
  bFloor.rotation.x = -Math.PI / 2;
  bFloor.position.set(branchSign * (hw + branchLen / 2), 0, -hw);
  group.add(bFloor);

  // Branch ceiling
  const bCeil = new THREE.Mesh(new THREE.PlaneGeometry(width, branchLen), ceilingMat);
  bCeil.rotation.x = Math.PI / 2;
  bCeil.position.set(branchSign * (hw + branchLen / 2), height, -hw);
  group.add(bCeil);

  // Branch walls (two side walls along the branch)
  const bWallFront = new THREE.Mesh(new THREE.PlaneGeometry(branchLen, height), wallMat);
  bWallFront.position.set(branchSign * (hw + branchLen / 2), height / 2, -hw - hw);
  bWallFront.rotation.y = Math.PI;
  group.add(bWallFront);

  const bWallBack = new THREE.Mesh(new THREE.PlaneGeometry(branchLen, height), wallMat);
  bWallBack.position.set(branchSign * (hw + branchLen / 2), height / 2, 0);
  group.add(bWallBack);

  // Branch end wall
  const bEnd = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
  bEnd.rotation.y = branchSign === 1 ? -Math.PI / 2 : Math.PI / 2;
  bEnd.position.set(branchSign * (hw + branchLen), height / 2, -hw);
  group.add(bEnd);

  // Position in world
  group.position.copy(cursor);
  group.rotation.y = angle;
  group.updateMatrixWorld(true);

  // Colliders for all walls
  const colliderWalls = [solidWall, bWallFront, bWallBack, bEnd];
  const colliders = colliderWalls.map(w => {
    const box = new THREE.Box3().setFromObject(w);
    box.expandByVector(new THREE.Vector3(0.15, 0, 0.15));
    return box;
  });

  return { meshes: group, colliders };
}
