import * as THREE from 'three';
import { wallMat, floorMat, ceilingMat } from '../materials.js';

/**
 * Generate a 90° corner segment.
 * The corner connects the incoming corridor to a corridor turning left or right.
 * It occupies a width×width square at the cursor position.
 *
 * @param {Object} seg - Segment data { direction: "left"|"right", width, height }
 * @param {THREE.Vector3} cursor - Current world position (entry point of corner)
 * @param {number} angle - Current direction angle (radians, 0 = -Z)
 * @returns {{ meshes: THREE.Group, colliders: THREE.Box3[] }}
 */
export function generateCorner(seg, cursor, angle) {
  const width = seg.width || 2.5;
  const height = seg.height || 4;
  const hw = width / 2;
  const dir = seg.direction || 'right';
  const group = new THREE.Group();

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, width), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(dir === 'right' ? hw : -hw, 0, -hw);
  group.add(floor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, width), ceilingMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(dir === 'right' ? hw : -hw, height, -hw);
  group.add(ceil);

  // Build walls based on turn direction
  const walls = [];
  if (dir === 'right') {
    // Outer back wall (closes the straight we came from on the right side)
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    back.position.set(hw, height / 2, 0);
    walls.push(back);

    // Outer left wall (closes the turn on the left)
    const left = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(0, height / 2, -hw);
    walls.push(left);

    // Inner corner walls
    const innerRight = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    innerRight.rotation.y = -Math.PI / 2;
    innerRight.position.set(width, height / 2, -hw);
    walls.push(innerRight);

    const innerTop = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    innerTop.rotation.y = Math.PI;
    innerTop.position.set(hw, height / 2, -width);
    walls.push(innerTop);
  } else {
    // Left turn
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    back.position.set(-hw, height / 2, 0);
    back.rotation.y = Math.PI;
    walls.push(back);

    const right = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(0, height / 2, -hw);
    walls.push(right);

    const innerLeft = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    innerLeft.rotation.y = Math.PI / 2;
    innerLeft.position.set(-width, height / 2, -hw);
    walls.push(innerLeft);

    const innerTop = new THREE.Mesh(new THREE.PlaneGeometry(width, height), wallMat);
    innerTop.rotation.y = Math.PI;
    innerTop.position.set(-hw, height / 2, -width);
    walls.push(innerTop);
  }

  for (const w of walls) group.add(w);

  // Position in world
  group.position.copy(cursor);
  group.rotation.y = angle;
  group.updateMatrixWorld(true);

  // Colliders
  const colliders = walls.map(w => {
    const box = new THREE.Box3().setFromObject(w);
    box.expandByVector(new THREE.Vector3(0.15, 0, 0.15));
    return box;
  });

  return { meshes: group, colliders };
}
