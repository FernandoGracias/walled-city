export class WorldLoader {
  constructor(scene) {
    this.scene = scene;
    this.containers = {};
    this.spawnPoint = null;
  }

  async _loadMaterials() {
    this.materials = {};
    try {
      const resp = await fetch('data/materials.json');
      if (!resp.ok) { console.warn('No materials.json found, skipping materials'); return; }
      const registry = await resp.json();
      for (const [name, maps] of Object.entries(registry)) {
        const mat = new BABYLON.PBRMaterial(name, this.scene);
        if (maps.color) mat.albedoTexture = new BABYLON.Texture(maps.color, this.scene);
        if (maps.normal) mat.bumpTexture = new BABYLON.Texture(maps.normal, this.scene);
        if (maps.roughness) {
          mat.metallicTexture = new BABYLON.Texture(maps.roughness, this.scene);
          mat.useRoughnessFromMetallicTextureGreen = true;
          mat.useMetallnessFromMetallicTextureBlue = false;
        }
        if (maps.metalness) {
          mat.metallic = 1.0;
        } else {
          mat.metallic = 0.0;
        }
        if (maps.ao) {
          mat.ambientTexture = new BABYLON.Texture(maps.ao, this.scene);
        }
        if (maps.opacity) {
          mat.opacityTexture = new BABYLON.Texture(maps.opacity, this.scene);
        }
        this.materials[name] = mat;
      }
      console.log(`Loaded ${Object.keys(this.materials).length} PBR materials`);
    } catch (e) {
      console.error('Failed to load materials:', e);
    }
  }

  async load(mapPath) {
    await this._loadMaterials();
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
      if (obj.scaleY != null) wrapper.scaling.y = obj.scaleY;

      glbRoot.position = BABYLON.Vector3.Zero();
      glbRoot.rotation = BABYLON.Vector3.Zero();
      if (glbRoot.rotationQuaternion) glbRoot.rotationQuaternion = null;
      glbRoot.parent = wrapper;

      // Apply PBR material override if specified
      if (obj.material && this.materials[obj.material]) {
        for (const mesh of wrapper.getChildMeshes()) {
          mesh.material = this.materials[obj.material];
        }
      }

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

  /** Set up stair zones and disable blocking collision at stair exits. */
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

    // Store stair info for later (floor tiles may not exist yet)
    if (!this._stairZones) this._stairZones = [];
    if (!this._stairTops) this._stairTops = [];

    this._stairTops.push(wrapper.position.clone());

    const pos = wrapper.position;
    const rotY = wrapper.rotation.y;

    // Stairs in local space go from z=-4 (bottom, y=0) to z=0 (top, y=4).
    // Transform the four corners to world space based on wrapper rotation.
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);

    // Local stair zone: x=-2 to 2, z=-4 to 0
    // Progress along stairs: t = (localZ + 4) / 4, where t=0 is bottom, t=1 is top
    this._stairZones.push({
      pos, rotY, cos, sin,
      localMinX: -3, localMaxX: 3,
      // Stairs go from localZ=-4 (bottom, y=0) to localZ=0 (top, y=rise).
      // Upper floor tile edge is now at localZ=0, so minimal extension needed.
      stairStartZ: -4,  // where climb begins (bottom of stairs)
      stairEndZ: 0,     // where climb ends (top of stairs = floor edge)
      localMinZ: -5,    // zone entry (slightly before bottom step)
      localMaxZ: 3,     // zone exit (well past top, onto floor tile)
      rise: 4
    });
  }

  /**
   * Call every frame to handle stair climbing. Adjusts camera Y when
   * the player is within a stair zone based on their position along the stairs.
   */
  /** Call after load() to disable collision on floor tiles at stair exits. */
  fixStairExits() {
    if (!this._stairTops) return;
    // Disable collision on ALL upper floor tiles. The stair zone Y adjustment
    // and gravity handle keeping the player at the correct height. Floor tile
    // edges act as walls that block horizontal movement.
    for (const mesh of this.scene.meshes) {
      if (!mesh.name.includes('floor')) continue;
      const p = mesh.getAbsolutePosition();
      if (p.y < 3) continue; // only upper floor tiles
      mesh.checkCollisions = false;
      if (mesh.physicsBody) {
        mesh.physicsBody.dispose();
        mesh.physicsBody = null;
      }
    }
  }

  updateStairs(camera) {
    if (!this._stairZones || this._stairZones.length === 0) return;

    const cx = camera.position.x;
    const cz = camera.position.z;
    const eyeHeight = 1.8;

    for (const zone of this._stairZones) {
      // Transform camera position into stair local space
      const dx = cx - zone.pos.x;
      const dz = cz - zone.pos.z;
      const localX = dx * zone.cos + dz * zone.sin;
      const localZ = -dx * zone.sin + dz * zone.cos;

      // Check if camera is within the stair zone
      if (localX < zone.localMinX || localX > zone.localMaxX) continue;
      if (localZ < zone.localMinZ || localZ > zone.localMaxZ) continue;

      // Calculate height based on position along the actual stair geometry
      let targetY;
      if (localZ <= zone.stairStartZ) {
        // Before the stairs — ground level
        targetY = zone.pos.y + eyeHeight;
      } else if (localZ >= zone.stairEndZ) {
        // Past the top of stairs — hold at full height (bridges gap to upper floor)
        targetY = zone.pos.y + zone.rise + eyeHeight;
      } else {
        // On the stairs — interpolate
        const t = (localZ - zone.stairStartZ) / (zone.stairEndZ - zone.stairStartZ);
        targetY = zone.pos.y + t * zone.rise + eyeHeight;
      }

      // Only push camera UP (gravity handles falling)
      if (camera.position.y < targetY) {
        camera.position.y = targetY;
      }
    }
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
