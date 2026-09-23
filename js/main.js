// Entry point: sets up renderer, wires modules together, runs the game loop.
import * as THREE from 'three';
import { WEAPON, WORLD } from './config.js';
import { World, getHeight } from './world.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Weapon } from './weapon.js';
import { EnemyManager } from './enemies.js';
import { Effects } from './effects.js';
import { AudioSystem } from './audio.js';
import { HUD } from './hud.js';

// ---------- Renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.55;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(WEAPON.fovHip, innerWidth / innerHeight, 0.02, 3000);
scene.add(camera); // needed so the weapon viewmodel (a camera child) renders

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Modules ----------
const world = new World(scene);
world.build();
const input = new Input(renderer.domElement);
const audio = new AudioSystem();
const effects = new Effects(scene);
const hud = new HUD();
const player = new Player(camera, input, world);
const weapon = new Weapon(camera, scene, audio, effects);
const enemies = new EnemyManager(scene, world, audio, effects);

// Handy for debugging in the browser console
window.__game = { scene, camera, world, player, weapon, enemies, effects };

// ---------- Menu / loading ----------
const menu = document.getElementById('menu');
const playBtn = document.getElementById('play');
const loadingText = document.getElementById('loading');

let state = 'menu';     // menu | playing | paused | dead | won
let artilleryTimer = 3;

await enemies.load(p => (loadingText.textContent = `Loading soldiers… ${Math.round(p * 100)}%`));
loadingText.textContent = enemies.template ? 'Ready.' : 'Soldier model unavailable — using fallback soldiers.';
enemies.spawnAll();
playBtn.disabled = false;

function startGame() {
  audio.init();
  if (state === 'dead' || state === 'won' || state === 'menu') {
    player.reset();
    weapon.reset();
    enemies.spawnAll();
    hud.say('Get off the beach!<br><small>Eliminate the defenders on the bluff</small>', 4);
  }
  state = 'playing';
  menu.classList.add('hidden');
  hud.show(true);
  input.lock();
}

playBtn.addEventListener('click', startGame);
input.onUnlock = () => {
  if (state === 'playing') {
    state = 'paused';
    playBtn.textContent = 'RESUME';
    menu.classList.remove('hidden');
  }
};

function endGame(won) {
  state = won ? 'won' : 'dead';
  hud.say(won ? 'SECTOR CLEARED' : 'K.I.A.', 0);
  setTimeout(() => {
    document.exitPointerLock();
    playBtn.textContent = won ? 'PLAY AGAIN' : 'REDEPLOY';
    menu.classList.remove('hidden');
    hud.say('', 0);
  }, 2500);
}

// ---------- Firing ----------
function handleFire() {
  if (!input.consumeFire()) return;
  const hit = weapon.tryFire([...enemies.hitboxes, ...world.hitMeshes], player);
  if (!hit) return;
  const enemy = hit.object.userData.enemy;
  if (enemy) {
    const dmg = WEAPON.damage * (hit.object.userData.head ? WEAPON.headshotMultiplier : 1);
    const killed = enemies.damage(enemy, dmg, hit.point);
    audio.hit();
    hud.hit(killed);
    if (killed && enemies.aliveCount === 0) endGame(true);
  } else {
    const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
    let surface = hit.object.userData.surface || 'sand';
    if (surface === 'sand' && hit.point.y < WORLD.waterLevel) surface = 'water';
    effects.impact(hit.point, normal, surface);
  }
}

// ---------- Ambient artillery for atmosphere ----------
function updateArtillery(dt) {
  artilleryTimer -= dt;
  if (artilleryTimer > 0) return;
  artilleryTimer = 4 + Math.random() * 7;
  const x = player.position.x + (Math.random() - 0.5) * 120;
  const z = THREE.MathUtils.clamp(player.position.z + (Math.random() - 0.3) * 80, -40, 120);
  const y = Math.max(getHeight(x, z), WORLD.waterLevel);
  const pos = new THREE.Vector3(x, y, z);
  const dist = pos.distanceTo(player.position);
  if (dist < 15) return; // never right on top of the player
  effects.explosion(pos, getHeight(x, z) < WORLD.waterLevel);
  audio.explosion(dist);
  player.shake = Math.max(player.shake, Math.max(0, 0.5 - dist / 150));
}

// ---------- Loop ----------
const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  world.update(dt, time);
  effects.update(dt);

  weapon.model.visible = state !== 'menu';
  if (state === 'paused') {
    // frozen: just render
  } else if (state === 'playing' || state === 'dead' || state === 'won') {
    weapon.update(dt, input);            // reads mouse delta for sway before player consumes it
    player.update(dt, time, weapon.aimFactor);
    if (state === 'playing') {
      handleFire();
      enemies.update(dt, player, time);
      updateArtillery(dt);
      if (!player.alive) endGame(false);
    }
    hud.update(player, weapon, enemies.aliveCount);
  } else {
    // Menu camera: slow pan over the beach
    camera.position.set(Math.sin(time * 0.05) * 30, 8, 90);
    camera.lookAt(0, 5, -60);
    enemies.update(dt, { camera, alive: false, position: camera.position }, time);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
