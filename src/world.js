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

      const glbRoot = rootNodes[0];

      // GLB root nodes have scaling.z = -1 (glTF right→left hand conversion).
      // Rotating that node directly doesn't work because the Z-flip interferes.
      // Fix: wrap in a parent TransformNode, move position/rotation there,
      // and leave the GLB root as a child with only its Z-flip.
      const wrapper = new BABYLON.TransformNode(`wrapper_${i}`, this.scene);
      wrapper.position = new BABYLON.Vector3(obj.x || 0, obj.y || 0, obj.z || 0);
      if (obj.rotation != null) wrapper.rotation.y = obj.rotation * Math.PI / 180;
      if (obj.scale) wrapper.scaling = new BABYLON.Vector3(obj.scale, obj.scale, obj.scale);

      glbRoot.position = BABYLON.Vector3.Zero();
      glbRoot.rotation = BABYLON.Vector3.Zero();
      if (glbRoot.rotationQuaternion) glbRoot.rotationQuaternion = null;
      glbRoot.parent = wrapper;

      // Enable collisions on all child meshes
      const collision = obj.collision !== false;
      if (collision) {
        this._enableCollisions(wrapper);
      }

      // For stairs, replace mesh collision with an invisible ramp
      if (obj.asset && obj.asset.includes('stairs') && collision) {
        this._addStairRamp(wrapper);
      }
    }
  }

  _enableCollisions(node) {
    if (node.getChildMeshes) {
      for (const mesh of node.getChildMeshes()) {
        mesh.checkCollisions = true;
        try {
          new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.MESH, { mass: 0 }, this.scene);
        } catch (e) {
          try {
            new BABYLON.PhysicsAggregate(mesh, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, this.scene);
          } catch (e2) { /* skip */ }
        }
      }
    }
  }

  /** Replace stair mesh collision with an invisible ramp the camera can walk up. */
  _addStairRamp(wrapper) {
    // Disable collision and physics on the visual stair meshes
    for (const mesh of wrapper.getChildMeshes()) {
      if (mesh.name.includes('stair')) {
        mesh.checkCollisions = false;
        if (mesh.physicsBody) {
          mesh.physicsBody.dispose();
          mesh.physicsBody = null;
        }
      }
    }

    // Create a tilted box as a ramp. Stairs go from y=0 at -Z to y=4 at position Z.
    // A box tilted ~45° creates a walkable slope.
    // The box is thin (0.2) so it acts as a surface, not a solid block.
    const rampLength = 5.6; // diagonal length for 4 rise over 4 run
    const ramp = BABYLON.MeshBuilder.CreateBox('stairRamp', {
      width: 4,       // X width (covers stair width)
      height: 0.2,    // thin surface
      depth: rampLength
    }, this.scene);

    // Tilt the box so it slopes upward from -Z to +Z
    ramp.rotation.x = -Math.atan2(4, 4); // ~45 degrees
    ramp.position.y = 2;   // center height
    ramp.position.z = -2;  // center depth
    ramp.isVisible = false;
    ramp.checkCollisions = true;
    ramp.parent = wrapper;
  }

  /** Set up interactive doors. Call after load(). */
  setupDoors() {
    this._doors = [];
    for (const mesh of this.scene.meshes) {
      if (!mesh.name.includes('doorway_door')) continue;

      // Remove physics body so we can animate the door
      if (mesh.physicsBody) {
        mesh.physicsBody.dispose();
        mesh.physicsBody = null;
      }

      // Convert quaternion to euler so rotation animation works
      if (mesh.rotationQuaternion) {
        mesh.rotation = mesh.rotationQuaternion.toEulerAngles();
        mesh.rotationQuaternion = null;
      }

      const door = {
        mesh,
        open: false,
        animating: false,
        closedRotY: mesh.rotation.y
      };

      mesh.isPickable = true;
      mesh._doorRef = door;

      // Tag frame and all related meshes so clicking anywhere on the doorway works
      let node = mesh.parent;
      while (node) {
        if (node.getChildMeshes) {
          for (const m of node.getChildMeshes()) {
            m.isPickable = true;
            if (!m._doorRef) m._doorRef = door;
          }
        }
        node = node.parent;
      }

      this._doors.push(door);
    }
  }

  /** Interact with door the player is looking at. Call on E key press. */
  interactDoor() {
    const engine = this.scene.getEngine();
    const cx = engine.getRenderWidth() / 2;
    const cy = engine.getRenderHeight() / 2;
    const hit = this.scene.pick(cx, cy);

    if (!hit || !hit.pickedMesh || !hit.pickedMesh._doorRef) return false;
    if (hit.distance > 5) return false;

    const door = hit.pickedMesh._doorRef;
    if (door.animating) return false;

    door.animating = true;
    const openAngle = door.closedRotY + Math.PI / 2;
    const from = door.open ? openAngle : door.closedRotY;
    const to = door.open ? door.closedRotY : openAngle;

    if (!door.open) door.mesh.checkCollisions = false;

    const anim = new BABYLON.Animation(
      'doorSwing', 'rotation.y', 30,
      BABYLON.Animation.ANIMATIONTYPE_FLOAT,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    anim.setKeys([{ frame: 0, value: from }, { frame: 20, value: to }]);
    door.mesh.animations = [anim];

    this.scene.beginAnimation(door.mesh, 0, 20, false, 1, () => {
      door.open = !door.open;
      door.animating = false;
      if (!door.open) door.mesh.checkCollisions = true;
    });

    return true;
  }
}
