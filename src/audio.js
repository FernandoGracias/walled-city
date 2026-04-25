import * as THREE from 'three';

export class AudioManager {
  constructor(camera) {
    this.camera = camera;
    this.ctx = null;
    this.listener = null;
    this.masterGain = null;
    this.initialized = false;
    this._dripTimeout = null;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.ctx = this.listener.context;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    this._startAmbientHum();
    this._scheduleDrip();
  }

  _startAmbientHum() {
    // 60Hz electrical hum with harmonics
    const fundamental = 60;
    const harmonics = [
      { freq: fundamental, gain: 0.15 },
      { freq: fundamental * 2, gain: 0.08 },
      { freq: fundamental * 3, gain: 0.04 },
      { freq: fundamental * 5, gain: 0.02 },
    ];

    for (const h of harmonics) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = h.freq;

      const gain = this.ctx.createGain();
      gain.gain.value = h.gain;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      osc.connect(gain);
      gain.connect(filter);
      filter.connect(this.masterGain);
      osc.start();
    }
  }

  _scheduleDrip() {
    const delay = 2000 + Math.random() * 6000;
    this._dripTimeout = setTimeout(() => {
      this._playDrip();
      this._scheduleDrip();
    }, delay);
  }

  _playDrip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Short noise burst through bandpass with fast decay
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2000 + Math.random() * 2000;
    bandpass.Q.value = 5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3 + Math.random() * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 0.2);
  }

  playFootstep(volume) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.08));
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    // Slight pitch variation
    source.playbackRate.value = 0.8 + Math.random() * 0.4;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 800 + Math.random() * 400;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15 * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 0.15);
  }

  dispose() {
    if (this._dripTimeout) clearTimeout(this._dripTimeout);
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
  }
}
