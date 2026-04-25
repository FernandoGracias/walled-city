import * as THREE from 'three';

// Shared materials for the walled city
export const wallMat = new THREE.MeshStandardMaterial({
  color: 0x3a3a3a, roughness: 0.85, metalness: 0.1
});

export const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a, roughness: 0.4, metalness: 0.2
});

export const ceilingMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a, roughness: 0.9, metalness: 0.05
});

export const pipeMat = new THREE.MeshStandardMaterial({
  color: 0x555555, roughness: 0.6, metalness: 0.4
});

export const frameMat = new THREE.MeshStandardMaterial({
  color: 0x222222, metalness: 0.8, roughness: 0.3
});

export const recessMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a, roughness: 0.9
});

export const fluorescentMat = new THREE.MeshBasicMaterial({
  color: 0xffeedd
});
