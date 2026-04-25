import * as THREE from 'three';
import { generateStraight } from './geometry/straight.js';
import { generateCorner } from './geometry/corner.js';
import { generateTJunction } from './geometry/t-junction.js';
import { generateProps } from './geometry/props.js';
import { generateLightFixtures, generateSigns } from './geometry/lights.js';

/**
 * Data-driven world loader.
 * Reads room JSON, walks segments with a cursor, calls geometry generators.
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];       // Box3[] for player collision
    this.flickerLights = [];   // { light, tube, baseIntensity, time }[]
    this.dripPositions = [];   // Vector3[] for audio system
    this.spawnPoint = null;    // { x, y, z, yaw }
    this._segmentOrigins = []; // Track each segment's world origin for drip point resolution
  }

  /**
   * Load a room from a JSON file and build the 3D environment.
   * @param {string} roomPath - Path to the room JSON file
   */
  async load(roomPath) {
    const res = await fetch(roomPath);
    if (!res.ok) throw new Error(`Failed to load room: ${roomPath} (${res.status})`);
    const room = await res.json();

    // Ambient setup
    this._setupAmbient(room.ambient);

    // Spawn point
    if (room.spawn) {
      this.spawnPoint = room.spawn;
    }

    // Walk segments with a cursor
    const cursor = new THREE.Vector3(0, 0, 0);
    let angle = 0; // radians, 0 = facing -Z

    for (let i = 0; i < room.segments.length; i++) {
      const seg = room.segments[i];

      // Record this segment's origin for drip point resolution
      this._segmentOrigins.push({ cursor: cursor.clone(), angle, length: seg.length || seg.width || 2.5 });

      switch (seg.type) {
        case 'straight':
          this._buildStraight(seg, cursor, angle);
          // Advance cursor forward by segment length
          cursor.x += Math.sin(angle) * seg.length;
          cursor.z -= Math.cos(angle) * seg.length;
          break;

        case 'corner':
          this._buildCorner(seg, cursor, angle);
          // Corner occupies a width×width square, then turns
          {
            const w = seg.width || 2.5;
            const dir = seg.direction || 'right';
            // Move cursor through the corner
            cursor.x += Math.sin(angle) * w;
            cursor.z -= Math.cos(angle) * w;
            // Rotate
            angle += dir === 'right' ? Math.PI / 2 : -Math.PI / 2;
          }
          break;

        case 't_junction':
          this._buildTJunction(seg, cursor, angle);
          // T-junction occupies width along the main direction
          {
            const w = seg.width || 2.5;
            cursor.x += Math.sin(angle) * w;
            cursor.z -= Math.cos(angle) * w;
          }
          break;

        default:
          console.warn(`Unknown segment type: ${seg.type}`);
      }
    }

    // Resolve drip points from segment-relative to world coordinates
    this._resolveDripPoints(room.audio?.drip_points);

    console.log(`[world] Loaded "${room.name}" — ${room.segments.length} segments, ${this.colliders.length} colliders`);
  }

  /**
   * Build a straight corridor segment with props, lights, and signs.
   */
  _buildStraight(seg, cursor, angle) {
    const { meshes, colliders } = generateStraight(seg, cursor, angle);
    this.scene.add(meshes);
    this.colliders.push(...colliders);

    // Add props, lights, signs to the same group
    generateProps(seg.props, seg, meshes);
    const { flickerLights } = generateLightFixtures(seg.lights, seg, meshes);
    this.flickerLights.push(...flickerLights.filter(Boolean));
    generateSigns(seg.signs, seg, meshes);
  }

  /**
   * Build a corner segment.
   */
  _buildCorner(seg, cursor, angle) {
    const { meshes, colliders } = generateCorner(seg, cursor, angle);
    this.scene.add(meshes);
    this.colliders.push(...colliders);
  }

  /**
   * Build a T-junction segment.
   */
  _buildTJunction(seg, cursor, angle) {
    const { meshes, colliders } = generateTJunction(seg, cursor, angle);
    this.scene.add(meshes);
    this.colliders.push(...colliders);

    // T-junctions can have lights too
    if (seg.lights) {
      const { flickerLights } = generateLightFixtures(seg.lights, seg, meshes);
      this.flickerLights.push(...flickerLights.filter(Boolean));
    }
  }

  /**
   * Set up fog and ambient light from room data.
   */
  _setupAmbient(ambient) {
    if (!ambient) return;
    const fogColor = new THREE.Color(ambient.fog_color || '#0a0a1a');
    this.scene.fog = new THREE.FogExp2(fogColor, ambient.fog_density || 0.06);
    const ambientColor = new THREE.Color(ambient.ambient_light_color || '#111122');
    this.scene.add(new THREE.AmbientLight(ambientColor, ambient.ambient_light_intensity || 0.3));
  }

  /**
   * Convert segment-relative drip points to world coordinates.
   */
  _resolveDripPoints(drips) {
    if (!drips) return;
    for (const drip of drips) {
      const origin = this._segmentOrigins[drip.segment];
      if (!origin) continue;

      const { cursor: segCursor, angle, length: segLen } = origin;
      const lateral = drip.lateral || 0;
      const dist = (drip.position || 0) * segLen;

      const pos = new THREE.Vector3(
        segCursor.x + Math.sin(angle) * dist + Math.cos(angle) * lateral,
        drip.height || 3.5,
        segCursor.z - Math.cos(angle) * dist - Math.sin(angle) * lateral
      );
      this.dripPositions.push(pos);
    }
  }

  /**
   * Update loop — handles flickering lights.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    for (const fl of this.flickerLights) {
      fl.time += dt;
      const flick = Math.sin(fl.time * 12) * 0.3
                   + Math.sin(fl.time * 37) * 0.2
                   + (Math.random() - 0.5) * 0.3;
      const intensity = Math.max(0.1, fl.baseIntensity + flick);
      fl.light.intensity = intensity;
      fl.tube.opacity = Math.min(1, intensity / fl.baseIntensity);
      fl.tube.transparent = true;
    }
  }
}
