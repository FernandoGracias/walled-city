import * as THREE from 'three';

const WALK_SPEED = 3;
const SPRINT_SPEED = 5;
const CROUCH_SPEED = 1.5;
const STAND_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.2;
const COLLISION_DIST = 0.35;
const HEAD_BOB_AMP = 0.02;
const HEAD_BOB_FREQ = 8;
const STEP_DISTANCE = 0.7;

export class Player {
  constructor(camera, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.position = new THREE.Vector3(0, STAND_HEIGHT, -1);
    this.yaw = 0;
    this.pitch = 0;
    this.height = STAND_HEIGHT;
    this.targetHeight = STAND_HEIGHT;
    this.crouching = false;
    this.sprinting = false;
    this.locked = false;
    this.keys = {};
    this.bobPhase = 0;
    this.distanceTraveled = 0;
    this.lastStepDist = 0;
    this.onStep = null; // callback for footstep audio

    this._raycaster = new THREE.Raycaster();
    this._moveDir = new THREE.Vector3();

    this._bindEvents();
    this._updateCamera();
  }

  _bindEvents() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyC') {
        this.crouching = !this.crouching;
        this.targetHeight = this.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.002;
      this.pitch -= e.movementY * 0.002;
      this.pitch = Math.max(-Math.PI * 85 / 180, Math.min(Math.PI * 85 / 180, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
    });
  }

  requestLock() {
    document.body.requestPointerLock();
  }

  update(dt) {
    if (!this.locked) return;

    // Smooth height transition
    this.height += (this.targetHeight - this.height) * Math.min(1, dt * 10);

    this.sprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    let speed = this.crouching ? CROUCH_SPEED : (this.sprinting ? SPRINT_SPEED : WALK_SPEED);

    // Movement direction from keys
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.keys['KeyW']) move.add(forward);
    if (this.keys['KeyS']) move.sub(forward);
    if (this.keys['KeyD']) move.add(right);
    if (this.keys['KeyA']) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);

      // Collision detection — try each axis independently
      const newPos = this.position.clone();

      // Try X movement
      const testX = this.position.clone();
      testX.x += move.x;
      if (!this._collides(testX)) {
        newPos.x = testX.x;
      }

      // Try Z movement
      const testZ = newPos.clone();
      testZ.z += move.z;
      if (!this._collides(testZ)) {
        newPos.z = testZ.z;
      }

      const actualMove = newPos.clone().sub(this.position);
      this.distanceTraveled += actualMove.length();
      this.position.copy(newPos);

      // Head bob
      const bobSpeed = this.sprinting ? HEAD_BOB_FREQ * 1.5 : HEAD_BOB_FREQ;
      this.bobPhase += dt * bobSpeed;

      // Footstep callback
      if (this.distanceTraveled - this.lastStepDist >= STEP_DISTANCE) {
        this.lastStepDist = this.distanceTraveled;
        if (this.onStep) {
          const stepSpeed = this.sprinting ? 1.3 : (this.crouching ? 0.3 : 1.0);
          this.onStep(stepSpeed);
        }
      }
    } else {
      this.bobPhase = 0;
    }

    this.position.y = this.height + Math.sin(this.bobPhase) * HEAD_BOB_AMP;
    this._updateCamera();
  }

  _collides(testPos) {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(testPos.x - 0.25, 0, testPos.z - 0.25),
      new THREE.Vector3(testPos.x + 0.25, this.height + 0.3, testPos.z + 0.25)
    );
    for (const box of this.colliders) {
      if (playerBox.intersectsBox(box)) return true;
    }
    return false;
  }

  _updateCamera() {
    this.camera.position.copy(this.position);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);
  }
}
