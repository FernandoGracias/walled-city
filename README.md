# Walled City

A first-person mystery game set in a cyberpunk megastructure. Built with Three.js.

## Running

```bash
cd walled-city
python3 -m http.server 8888
```

Open http://localhost:8888 in your browser.

## Controls

- **WASD** — Move
- **Mouse** — Look
- **Shift** — Sprint
- **C** — Crouch
- **Escape** — Release pointer lock

## Structure

```
src/
  main.js    — Bootstrap, game loop
  world.js   — Corridor geometry, lighting, neon signs
  player.js  — First-person controller, collision
  audio.js   — Ambient hum, drips, footsteps
  ui.js      — HUD overlay
```
