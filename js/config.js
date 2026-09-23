// Central tuning values and asset URLs.
// All third-party assets are loaded from free CDNs — see CREDITS.md.

export const ASSETS = {
  // Mixamo-rigged soldier with Idle / Walk / Run clips, MIT-licensed as part of the three.js repo.
  // To use your own Mixamo animations: export as FBX → convert to GLB (e.g. Blender) → put in /assets
  // and change this path to './assets/your-soldier.glb'.
  soldier: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb',
  // The Soldier model faces -Z, so add PI when orienting it toward a direction.
  soldierYawOffset: Math.PI,
  waterNormals: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/waternormals.jpg',
};

export const PLAYER = {
  height: 1.7,
  crouchHeight: 1.1,
  radius: 0.4,
  walkSpeed: 4.2,
  sprintSpeed: 7.0,
  crouchSpeed: 2.0,
  waterSpeedFactor: 0.5,
  jumpVelocity: 5.0,
  gravity: 18,
  maxHealth: 100,
  regenDelay: 4,     // seconds without damage before regen
  regenRate: 12,     // hp per second
};

export const WEAPON = {
  name: 'M1 Garand',
  magSize: 8,
  reserve: 48,
  fireInterval: 0.18,  // seconds between shots (semi-auto)
  reloadTime: 2.2,
  damage: 60,
  headshotMultiplier: 2.5,
  range: 400,
  spreadHip: 0.02,
  spreadAds: 0.002,
  recoil: 0.035,
  fovHip: 75,
  fovAds: 45,
};

export const ENEMY = {
  count: 12,
  health: 100,
  fireRange: 90,
  fireInterval: [1.8, 3.5],   // random range, seconds
  accuracy: 0.18,             // base hit chance per shot at range
  damage: [8, 16],
};

export const WORLD = {
  beachLength: 400,     // along X
  shoreDepth: 260,      // along Z (sea at +Z, bluffs at -Z)
  waterLevel: 0,
  playerStart: [0, 0, 70],
};
