// Enemy soldiers: Mixamo-rigged GLB with Idle/Walk/Run clips, simple patrol + shoot AI.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ASSETS, ENEMY } from './config.js';
import { getHeight, mulberry32 } from './world.js';

const FIELD_GREY = new THREE.Color(0x6b6f5a);

export class EnemyManager {
  constructor(scene, world, audio, effects) {
    this.scene = scene;
    this.world = world;
    this.audio = audio;
    this.effects = effects;
    this.enemies = [];
    this.template = null;
    this.clips = [];
    this.hitboxes = [];
    this.raycaster = new THREE.Raycaster();
  }

  async load(onProgress) {
    try {
      const gltf = await new GLTFLoader().loadAsync(ASSETS.soldier, e => {
        if (e.total) onProgress?.(e.loaded / e.total);
      });
      this.template = gltf.scene;
      this.clips = gltf.animations;
      this.template.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.material = o.material.clone();
          o.material.color.multiply(FIELD_GREY).multiplyScalar(1.6); // tint toward Wehrmacht field grey
        }
      });
    } catch (err) {
      console.warn('Soldier model failed to load, using fallback soldiers.', err);
      this.template = null;
    }
  }

  makeFallbackSoldier() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5a5e4a });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), mat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc9a27e }));
    head.position.y = 1.62;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a4e40 }));
    helmet.position.y = 1.66;
    [body, head, helmet].forEach(m => { m.castShadow = true; g.add(m); });
    return g;
  }

  spawnAll() {
    this.clear();
    const rng = mulberry32(6061944);
    for (let i = 0; i < ENEMY.count; i++) {
      // Spread along the shingle and bluff line, some near bunkers
      const x = (rng() - 0.5) * 300;
      const z = -52 - rng() * 45;
      this.spawn(x, z, rng);
    }
  }

  spawn(x, z, rng) {
    const root = new THREE.Group();
    let model, mixer = null, actions = {};
    if (this.template) {
      model = SkeletonUtils.clone(this.template);
      mixer = new THREE.AnimationMixer(model);
      for (const clip of this.clips) actions[clip.name] = mixer.clipAction(clip);
      actions.Idle?.play();
    } else {
      model = this.makeFallbackSoldier();
    }
    model.rotation.y = ASSETS.soldierYawOffset;
    root.add(model);

    // Invisible hitboxes (cheaper and more reliable than raycasting a skinned mesh)
    const hbMat = new THREE.MeshBasicMaterial({ visible: false });
    const bodyBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.45, 0.4), hbMat);
    bodyBox.position.y = 0.75;
    const headBox = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), hbMat);
    headBox.position.y = 1.62;
    root.add(bodyBox, headBox);

    root.position.set(x, getHeight(x, z), z);
    this.scene.add(root);

    const enemy = {
      root, model, mixer, actions,
      health: ENEMY.health,
      alive: true,
      state: 'idle',
      current: 'Idle',
      home: new THREE.Vector3(x, 0, z),
      target: new THREE.Vector3(x, 0, z),
      fireTimer: 2 + rng() * 3,
      stateTimer: rng() * 4,
      deathT: 0,
      bodyBox, headBox,
    };
    bodyBox.userData.enemy = enemy;
    headBox.userData.enemy = enemy; headBox.userData.head = true;
    this.hitboxes.push(bodyBox, headBox);
    this.enemies.push(enemy);
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.root);
    this.enemies = [];
    this.hitboxes = [];
  }

  get aliveCount() { return this.enemies.filter(e => e.alive).length; }

  setAnim(e, name, fade = 0.3) {
    if (!e.mixer || e.current === name || !e.actions[name]) return;
    const next = e.actions[name];
    next.reset().play();
    e.actions[e.current]?.crossFadeTo(next, fade, false);
    e.current = name;
  }

  /** Apply damage from the player. Returns true if the hit killed the enemy. */
  damage(enemy, amount, point) {
    if (!enemy.alive) return false;
    enemy.health -= amount;
    this.effects.blood(point);
    enemy.state = 'alert';
    if (enemy.health <= 0) {
      enemy.alive = false;
      enemy.deathT = 0;
      enemy.deathDir = Math.random() < 0.5 ? -1 : 1;
      enemy.mixer?.stopAllAction();
      this.hitboxes = this.hitboxes.filter(h => h.userData.enemy !== enemy);
      return true;
    }
    return false;
  }

  hasLineOfSight(from, to) {
    const dir = to.clone().sub(from);
    const dist = dir.length();
    this.raycaster.set(from, dir.normalize());
    this.raycaster.far = dist;
    return this.raycaster.intersectObjects(this.world.hitMeshes.filter(m => m !== this.world.water), false).length === 0;
  }

  update(dt, player, time) {
    const playerEye = player.camera.position;
    for (const e of this.enemies) {
      e.mixer?.update(dt);

      if (!e.alive) {
        // Procedural death fall (Soldier.glb has no death clip)
        if (e.deathT < 1) {
          e.deathT = Math.min(1, e.deathT + dt * 2.2);
          const t = e.deathT * e.deathT;
          e.model.rotation.x = -t * Math.PI / 2 * 0.95;
          e.model.position.y = t * 0.15;
        }
        continue;
      }

      const pos = e.root.position;
      const toPlayer = new THREE.Vector3(playerEye.x - pos.x, 0, playerEye.z - pos.z);
      const dist = toPlayer.length();

      // Awareness
      const eye = pos.clone(); eye.y += 1.6;
      // Line-of-sight raycasts are throttled to ~4/sec per enemy
      e.losTimer = (e.losTimer ?? Math.random() * 0.25) - dt;
      if (e.losTimer <= 0) {
        e.losTimer = 0.25;
        e.canSee = player.alive && dist < ENEMY.fireRange && this.hasLineOfSight(eye, playerEye);
      }
      const canSee = e.canSee && player.alive;
      if (canSee) e.state = 'alert';
      else if (e.state === 'alert' && dist > ENEMY.fireRange * 1.3) e.state = 'idle';

      if (e.state === 'alert' && canSee) {
        this.setAnim(e, 'Idle');
        e.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          const [a, b] = ENEMY.fireInterval;
          e.fireTimer = a + Math.random() * (b - a);
          this.shootAt(e, eye, player, dist, time);
        }
      } else {
        // Patrol around home position
        e.stateTimer -= dt;
        const toTarget = new THREE.Vector3(e.target.x - pos.x, 0, e.target.z - pos.z);
        if (toTarget.length() < 0.5 || e.stateTimer <= 0) {
          if (e.state === 'walk') {
            e.state = 'idle'; e.stateTimer = 2 + Math.random() * 4; this.setAnim(e, 'Idle');
          } else {
            e.state = 'walk'; e.stateTimer = 6;
            e.target.set(e.home.x + (Math.random() - 0.5) * 16, 0, e.home.z + (Math.random() - 0.5) * 8);
            this.setAnim(e, 'Walk');
          }
        }
        if (e.state === 'walk' && toTarget.lengthSq() > 0.01) {
          toTarget.normalize();
          pos.x += toTarget.x * 1.3 * dt;
          pos.z += toTarget.z * 1.3 * dt;
          e.root.rotation.y = Math.atan2(toTarget.x, toTarget.z);
        }
      }
      pos.y = getHeight(pos.x, pos.z);
    }
  }

  shootAt(e, eye, player, dist, time) {
    const muzzle = eye.clone().add(new THREE.Vector3(Math.sin(e.root.rotation.y) * 0.6, -0.2, Math.cos(e.root.rotation.y) * 0.6));
    this.effects.enemyFlash(muzzle);
    this.audio.distantShot(dist);

    // Harder to hit a crouching, moving or distant player
    let chance = ENEMY.accuracy * (1 - dist / (ENEMY.fireRange * 1.4));
    if (player.crouching) chance *= 0.6;
    if (player.moving) chance *= 0.7;
    if (Math.random() < chance) {
      const [a, b] = ENEMY.damage;
      player.damage(a + Math.random() * (b - a), time);
      this.audio.hurt();
    } else {
      this.audio.bulletWhiz();
      // Kick up sand near the player
      const p = player.position.clone().add(new THREE.Vector3((Math.random() - .5) * 4, 0, (Math.random() - .5) * 4));
      p.y = getHeight(p.x, p.z);
      this.effects.impact(p, new THREE.Vector3(0, 1, 0), p.y < 0 ? 'water' : 'sand');
    }
  }
}
