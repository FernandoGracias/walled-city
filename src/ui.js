export class UI {
  constructor() {
    this.prompt = document.getElementById('prompt');
    this.crosshair = document.getElementById('crosshair');
    this._bindEvents();
  }

  _bindEvents() {
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) {
        this.prompt.classList.add('hidden');
        this.crosshair.classList.add('visible');
      } else {
        this.prompt.textContent = 'Click to resume';
        this.prompt.classList.remove('hidden');
        this.crosshair.classList.remove('visible');
      }
    });
  }

  showInitialPrompt() {
    this.prompt.textContent = 'Click to enter The Pile';
    this.prompt.classList.remove('hidden');
    this.crosshair.classList.remove('visible');
  }
}
