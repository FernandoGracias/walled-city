export class WorldLoader {
  constructor(scene) {
    this.scene = scene;
    this.containers = {};
    this.spawnPoint = null;
  }

  async load(mapPath) {
    const resp = await fetch(mapPath);
    if (!resp.ok) { console.error('Failed to load map:', mapPath); return; }
    const map = await resp.json();

    // Fog
    if (map.lighting) {
      if (map.lighting.fogColor) {
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
        this.scene.fogDensity = map.lighting.fogDensity || 0.05;
        this.scene.fogColor = BABYLON.Color3.FromHexString(map.lighting.fogColor);
      }
      if (map.lighting.ambient) {
        this.scene.ambientColor = BABYLON.Color3.FromHexString(map.lighting.ambient);
      }
    }

    // Spawn
    if (map.spawn) {
      this.spawnPoint = {
        position: new BABYLON.Vector3(map.spawn.x, map.spawn.y, map.spawn.z),
        rotation: (map.spawn.rotation || 0) * Math.PI / 180,
      };
    }

    // Collect unique assets
    const assetSet = new Set();
    for (const obj of map.objects) {
      if (obj.asset) assetSet.add(obj.asset);
    }

    // Load each unique asset into a container
    const root = 'assets/models/dungeon-kit/';
    for (const asset of assetSet) {
      try {
        this.containers[asset] = await BABYLON.SceneLoader.LoadAssetContainerAsync(root, asset, this.scene, null, '.glb');
      } catch (e) {
        console.error(`Failed to load asset: ${asset}`, e);
      }
    }

    // Place objects
    for (let i = 0; i < map.objects.length; i++) {
      const obj = map.objects[i];
      if (!obj.asset) continue;
      const container = this.containers[obj.asset];
      if (!container) continue;

      const instance = container.instantiateModelsToScene(name => `${name}_${i}`);
      const rootNodes = instance.rootNodes;
      if (rootNodes.length === 0) continue;

      const root = rootNodes[0];

      // GLB root nodes have scaling.z = -1 (glTF right→left hand conversion).
      // Rotating that node directly doesn't work because the Z-flip interferes.
      // Fix: wrap in a parent TransformNode, move position/rotation there,
      // and leave the GLB root as a child with only its Z-flip.
      const wrapper = new BABYLON.TransformNode(`wrapper_${i}`, this.scene);
      wrapper.position = new BABYLON.Vector3(obj.x || 0, obj.y || 0, obj.z || 0);
      if (obj.rotation != null) wrapper.rotation.y = obj.rotation * Math.PI / 180;
      if (obj.scale) wrapper.scaling = new BABYLON.Vector3(obj.scale, obj.scale, obj.scale);

      root.position = BABYLON.Vector3.Zero();
      root.rotation = BABYLON.Vector3.Zero();
      if (root.rotationQuaternion) root.rotationQuaternion = null;
      root.parent = wrapper;

      // Enable collisions on all child meshes
      const collision = obj.collision !== false;
      if (collision) {
        this._enableCollisions(wrapper);
      }
    }
  }

  _enableCollisions(node) {
    if (node.getChildMeshes) {
      for (const mesh of node.getChildMeshes()) {
        // Skip door meshes inside doorways — they block the opening
        if (mesh.name.includes('doorway_door')) continue;

        mesh.checkCollisions = true;
        // Add static physics body for Havok
        try {
          new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, this.scene);
        } catch (e) {
          // Some meshes may not support mesh physics shape; use box fallback
          try {
            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
          } catch (e2) { /* skip */ }
        }
      }
    }
  }
}
