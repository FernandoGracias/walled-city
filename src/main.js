import { WorldLoader } from './world.js';

async function main() {
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true);

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.04, 0.04, 0.1);
  scene.collisionsEnabled = true;

  // Havok physics
  const havokInstance = await HavokPhysics();
  const havokPlugin = new BABYLON.HavokPlugin(true, havokInstance);
  scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), havokPlugin);

  // Lights
  const hemiLight = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.4;
  const dirLight = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, 1), scene);
  dirLight.intensity = 0.6;

  // Safety ground plane
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 200, height: 200 }, scene);
  ground.position.y = -0.05;
  ground.checkCollisions = true;
  ground.isVisible = false;
  new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);

  // FPS Camera
  const camera = new BABYLON.UniversalCamera('fps', new BABYLON.Vector3(0, 1.8, 0), scene);
  camera.attachControl(canvas, true);
  camera.applyGravity = true;
  camera.checkCollisions = true;
  camera.ellipsoid = new BABYLON.Vector3(0.5, 0.9, 0.5);
  camera.minZ = 0.1;
  camera.speed = 0.3;
  camera.angularSensibility = 2000;
  camera.inertia = 0.7;

  // WASD keys
  camera.keysUp = [87];    // W
  camera.keysDown = [83];  // S
  camera.keysLeft = [65];  // A
  camera.keysRight = [68]; // D

  // Apply gravity even when not moving
  camera._needMoveForGravity = true;

  // Gravity vector for camera
  scene.gravity = new BABYLON.Vector3(0, -0.4, 0);

  // Pointer lock on click
  canvas.addEventListener('click', () => {
    canvas.requestPointerLock();
  });

  // Measure assets if ?measure is in URL
  if (window.location.search.includes('measure')) {
    await measureAssets(scene);
  }

  // Load world
  const worldLoader = new WorldLoader(scene);
  await worldLoader.load('data/maps/test-level.json');
  worldLoader.setupDoors();

  // Set camera to spawn point
  if (worldLoader.spawnPoint) {
    camera.position = worldLoader.spawnPoint.position.clone();
    camera.rotation.y = worldLoader.spawnPoint.rotation;
  }

  // E key to interact with doors
  scene.onKeyboardObservable.add((kbInfo) => {
    if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'e') {
      worldLoader.interactDoor();
    }
  });

  engine.runRenderLoop(() => {
    worldLoader.updateStairs(camera);
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());
}

async function measureAssets(scene) {
  const assets = [
    'wall.gltf.glb',
    'floor_tile_large.gltf.glb',
    'floor_tile_small.gltf.glb',
    'wall_corner.gltf.glb',
    'stairs.gltf.glb',
    'wall_doorway.glb',
    'column.gltf.glb',
  ];
  const root = 'assets/models/dungeon-kit/';

  window._measurements = {};
  console.log('=== ASSET MEASUREMENTS ===');
  for (const file of assets) {
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', root, file, scene, null, '.glb');

      let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
      let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);
      result.meshes.forEach(m => {
        if (m.getBoundingInfo) {
          const bi = m.getBoundingInfo();
          min = BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld);
          max = BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld);
        }
      });
      const size = max.subtract(min);
      const entry = `size=(${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}) min=(${min.x.toFixed(3)}, ${min.y.toFixed(3)}, ${min.z.toFixed(3)}) max=(${max.x.toFixed(3)}, ${max.y.toFixed(3)}, ${max.z.toFixed(3)})`;
      console.log(`${file}: ${entry}`);
      window._measurements[file] = entry;

      result.meshes.forEach(m => m.dispose());
    } catch (e) {
      console.log(`${file}: FAILED - ${e.message}`);
      window._measurements[file] = `FAILED: ${e.message}`;
    }
  }
  console.log('=== END MEASUREMENTS ===');
}

main().catch(e => console.error('Init failed:', e));
