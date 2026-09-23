# Omaha Beach 1944 — WW2 FPS Prototype

A browser-based first-person shooter prototype set on Omaha Beach (Dog Green sector), June 6, 1944.
Built with [three.js](https://threejs.org) as plain ES modules — no build step.

**Play:** https://jtwebguy.github.io/omaha-beach-fps/

## Controls
| Key | Action |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Left click | Fire (semi-auto M1 Garand) |
| Right click | Aim down sights |
| R | Reload (ejects the en-bloc clip) |
| Shift | Sprint |
| C / Ctrl | Crouch |
| Space | Jump |

## Project structure
```
index.html        page + import map (three.js from jsDelivr)
css/style.css     menu + HUD styling
js/config.js      tuning values and asset URLs
js/main.js        renderer, game state, main loop
js/world.js       terrain, sea, sky, hedgehogs, seawall, bunkers, landing craft
js/input.js       keyboard / mouse / pointer lock
js/player.js      first-person controller, collisions, health
js/weapon.js      M1 Garand viewmodel, hitscan, recoil, reload, ADS
js/enemies.js     Mixamo-rigged soldiers, animation mixer, patrol/shoot AI
js/effects.js     impacts, blood, muzzle flash, artillery plumes
js/audio.js       procedural Web Audio SFX (no audio files)
js/hud.js         health, ammo, hitmarker, messages
```

## Using your own Mixamo animations
1. Download a character + animations from [mixamo.com](https://www.mixamo.com) (free Adobe account) as FBX.
2. Import into Blender, combine clips on one armature, export as **glTF Binary (.glb)**.
3. Put it in `assets/` and set `ASSETS.soldier` in `js/config.js` to `./assets/your-file.glb`.
4. Name clips `Idle`, `Walk`, `Run` (and optionally add a `Death` clip).

Note: Mixamo's terms allow use in your game but not redistribution of the raw files on their own,
so prefer committing only the combined, converted GLB used by the game.

## Run locally
Any static server works, e.g. `npx serve .` or `python3 -m http.server`, then open http://localhost:8000.

See [CREDITS.md](CREDITS.md) for asset licenses.
