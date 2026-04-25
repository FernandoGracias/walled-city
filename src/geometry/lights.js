import * as THREE from 'three';
import { pipeMat, frameMat, fluorescentMat } from '../materials.js';

/**
 * Generate light fixtures for a corridor segment.
 * Returns arrays of Three.js objects and flicker metadata.
 *
 * @param {Object[]} lights - Light definitions from JSON
 * @param {Object} seg - Parent segment { length, width, height }
 * @param {THREE.Group} parent - Group to add fixtures to
 * @returns {{ flickerLights: Object[] }} - Flicker metadata for update loop
 */
export function generateLightFixtures(lights, seg, parent) {
  if (!lights) return { flickerLights: [] };
  const flickerLights = [];

  for (const def of lights) {
    switch (def.type) {
      case 'fluorescent': {
        const fl = addFluorescent(def, seg, parent);
        if (fl) flickerLights.push(fl);
        break;
      }
    }
  }
  return { flickerLights };
}

/**
 * Generate neon signs for a corridor segment.
 * @param {Object[]} signs - Sign definitions from JSON
 * @param {Object} seg - Parent segment { length, width, height }
 * @param {THREE.Group} parent - Group to add signs to
 */
export function generateSigns(signs, seg, parent) {
  if (!signs) return;
  const { length, width } = seg;
  const hw = width / 2;

  for (const sign of signs) {
    const z = -sign.position * length;
    const color = new THREE.Color(sign.color);
    const w = sign.width || 1.0;
    const h = sign.height || 0.3;
    const wallOffset = sign.wall === 'right' ? hw - 0.02 : -hw + 0.02;
    const rotY = sign.wall === 'right' ? -Math.PI / 2 : Math.PI / 2;

    const group = new THREE.Group();
    group.position.set(wallOffset, 2.5, z);
    group.rotation.y = rotY;

    // Glowing panel
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    group.add(panel);

    // Frame
    const ft = 0.03;
    group.add(makeFrame(w + 0.06, ft, ft, 0, h / 2, 0.01));
    group.add(makeFrame(w + 0.06, ft, ft, 0, -h / 2, 0.01));
    group.add(makeFrame(ft, h, ft, -w / 2, 0, 0.01));
    group.add(makeFrame(ft, h, ft, w / 2, 0, 0.01));

    // Point light for glow
    const light = new THREE.PointLight(color, 2, 6, 2);
    light.position.set(0, 0, 0.3);
    group.add(light);

    parent.add(group);
  }
}

function addFluorescent(def, seg, parent) {
  const z = -def.position * seg.length;
  const group = new THREE.Group();
  group.position.set(0, seg.height - 0.2, z);

  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6),
    fluorescentMat.clone()
  );
  tube.rotation.z = Math.PI / 2;
  group.add(tube);

  // Mounting bracket
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), pipeMat);
  bracket.position.set(0, 0.04, 0);
  group.add(bracket);

  const light = new THREE.PointLight(0xffeedd, 1.5, 8, 2);
  light.position.set(0, -0.1, 0);
  group.add(light);

  parent.add(group);

  if (def.flicker) {
    return { light, tube: tube.material, baseIntensity: 1.5, time: Math.random() * 100 };
  }
  return null;
}

function makeFrame(w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
  mesh.position.set(x, y, z);
  return mesh;
}
