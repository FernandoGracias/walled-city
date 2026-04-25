import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { AudioManager } from './audio.js';
import { UI } from './ui.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

// Scene & Camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

const ui = new UI();
ui.showInitialPrompt();

async function init() {
  // Load world from JSON
  const world = new World(scene);
  await world.load('data/rooms/neon-belt-entry.json');

  // Player — use spawn point from room data
  const player = new Player(camera, world.colliders);
  if (world.spawnPoint) {
    player.position.set(world.spawnPoint.x, world.spawnPoint.y, world.spawnPoint.z);
    player.yaw = world.spawnPoint.yaw || 0;
  }

  // Audio
  const audio = new AudioManager(camera);
  audio.dripPositions = world.dripPositions;

  // Wire footstep audio
  player.onStep = (volume) => audio.playFootstep(volume);

  // Click handler — pointer lock + audio init
  document.addEventListener('click', () => {
    audio.init();
    player.requestLock();
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Game loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    player.update(dt);
    world.update(dt);
    renderer.render(scene, camera);
  }
  animate();
}

init().catch(err => {
  console.error('[init] Failed to start:', err);
  document.getElementById('prompt').textContent = 'Failed to load world';
});
