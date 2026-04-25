import * as THREE from 'three';
import { pipeMat, recessMat } from '../materials.js';

/**
 * Generate props for a corridor segment.
 * Each prop is positioned relative to the segment (0.0–1.0 along length).
 *
 * @param {Object[]} props - Array of prop definitions from JSON
 * @param {Object} seg - Parent segment data { length, width, height }
 * @param {THREE.Group} parent - Group to add props to (already positioned/rotated)
 */
export function generateProps(props, seg, parent) {
  if (!props) return;
  const { length, width, height } = seg;
  const hw = width / 2;

  for (const prop of props) {
    switch (prop.type) {
      case 'door_recess':
        addDoorRecess(prop, length, hw, height, parent);
        break;
      case 'conduit_box':
        addConduitBox(prop, length, hw, parent);
        break;
      case 'ceiling_pipe':
        addCeilingPipe(prop, length, height, parent);
        break;
    }
  }
}

function addDoorRecess(prop, length, hw, height, parent) {
  const z = -prop.position * length;
  const x = prop.wall === 'left' ? -hw + 0.05 : hw - 0.05;
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // Back wall of recess
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), recessMat);
  back.position.set(prop.wall === 'left' ? 0.2 : -0.2, 1.1, 0);
  back.rotation.y = prop.wall === 'left' ? Math.PI / 2 : -Math.PI / 2;
  group.add(back);

  // Door frame top
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.9), pipeMat);
  top.position.set(prop.wall === 'left' ? 0.1 : -0.1, 2.2, 0);
  group.add(top);

  parent.add(group);
}

function addConduitBox(prop, length, hw, parent) {
  const z = -prop.position * length;
  const x = prop.wall === 'right' ? hw - 0.08 : -hw + 0.08;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.15), pipeMat);
  box.position.set(x, 2.5, z);
  parent.add(box);
}

function addCeilingPipe(prop, length, height, parent) {
  const offset = prop.offset || 0.8;
  const pipeLen = (prop.length || 1.0) * length;
  const startZ = -prop.position * length;
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, pipeLen, 8),
    pipeMat
  );
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(offset, height - 0.15, startZ - pipeLen / 2);
  parent.add(pipe);
}
