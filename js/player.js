// First-person player controller: mouse look, movement, collisions, health.
import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { getHeight } from './world.js';

export class Player {
  constructor(camera, input, world) {
    this.camera = camera;
    this.input = input;
    this.world = world;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.sensitivity = 0.0022;
    this.onGround = true;
    this.crouching = false;
    this.eyeHeight = PLAYER.height;
    this.bobTime = 0;
    this.shake = 0;
    this.reset();
  }

  reset() {
    const [x, , z] = WORLD.playerStart;
    this.position.set(x, getHeight(x, z), z);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;            // looking toward -Z (the beach)
    this.pitch = 0;
    this.health = PLAYER.maxHealth;
    this.lastDamage = -99;
    this.alive = true;
  }

  get inWater() { return this.position.y < WORLD.waterLevel - 0.2; }
  get moving() { return this.velocity.x ** 2 + this.velocity.z ** 2 > 0.5; }

  damage(amount, time) {
    if (!this.alive) return;
    this.health -= amount;
    this.lastDamage = time;
    this.shake = Math.max(this.shake, 0.15);
    if (this.health <= 0) { this.health = 0; this.alive = false; }
  }

  addRecoil(amount) {
    this.recoilPitch += amount;
    this.yaw += (Math.random() - 0.5) * amount * 0.5;
  }

  update(dt, time, aimFactor) {
    const inp = this.input;

    // --- look ---
    const [dx, dy] = inp.consumeMouse();
    const sens = this.sensitivity * (1 - aimFactor * 0.45);
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    // recoil climbs then recovers
    const rec = this.recoilPitch * Math.min(1, dt * 18);
    this.pitch += rec;
    this.recoilPitch -= rec;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);

    if (!this.alive) { this.applyCamera(dt, time); return; }

    // --- movement ---
    this.crouching = inp.down('KeyC') || inp.down('ControlLeft');
    const sprint = inp.down('ShiftLeft') && !this.crouching && aimFactor < 0.5;
    let speed = this.crouching ? PLAYER.crouchSpeed : sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    if (this.inWater) speed *= PLAYER.waterSpeedFactor;
    if (aimFactor > 0.5) speed *= 0.6;

    const f = (inp.down('KeyW') ? 1 : 0) - (inp.down('KeyS') ? 1 : 0);
    const s = (inp.down('KeyD') ? 1 : 0) - (inp.down('KeyA') ? 1 : 0);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = forward.multiplyScalar(f).add(right.multiplyScalar(s));
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    const accel = this.onGround ? 12 : 3;
    this.velocity.x += (wish.x - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (wish.z - this.velocity.z) * Math.min(1, accel * dt);

    if (inp.down('Space') && this.onGround && !this.crouching) {
      this.velocity.y = PLAYER.jumpVelocity * (this.inWater ? 0.6 : 1);
      this.onGround = false;
    }
    this.velocity.y -= PLAYER.gravity * dt;

    // Horizontal move with slope limit (bluffs are climbable but slow)
    const next = this.position.clone().addScaledVector(this.velocity, dt);
    const hNow = getHeight(this.position.x, this.position.z);
    const hNext = getHeight(next.x, next.z);
    const horiz = Math.hypot(next.x - this.position.x, next.z - this.position.z);
    if (horiz > 0 && (hNext - hNow) / horiz > 1.4) {
      next.x = this.position.x; next.z = this.position.z;
    }

    // Circle colliders
    for (const c of this.world.colliders) {
      const ddx = next.x - c.x, ddz = next.z - c.z;
      const min = c.r + PLAYER.radius;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        next.x = c.x + (ddx / d) * min;
        next.z = c.z + (ddz / d) * min;
      }
    }

    // Map bounds: can't swim back out to sea or leave the sector
    next.x = THREE.MathUtils.clamp(next.x, -190, 190);
    next.z = THREE.MathUtils.clamp(next.z, -125, WORLD.playerStart[2] + 2);

    const ground = getHeight(next.x, next.z);
    if (next.y <= ground) { next.y = ground; this.velocity.y = 0; this.onGround = true; }
    else if (next.y - ground > 0.05) this.onGround = false;
    this.position.copy(next);

    // Health regen
    if (time - this.lastDamage > PLAYER.regenDelay) {
      this.health = Math.min(PLAYER.maxHealth, this.health + PLAYER.regenRate * dt);
    }

    this.applyCamera(dt, time, sprint);
  }

  applyCamera(dt, time, sprint = false) {
    const targetEye = !this.alive ? 0.3 : this.crouching ? PLAYER.crouchHeight : PLAYER.height;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 10);

    let bob = 0;
    if (this.moving && this.onGround && this.alive) {
      this.bobTime += dt * (sprint ? 13 : 9);
      bob = Math.sin(this.bobTime) * (sprint ? 0.06 : 0.035);
    }
    this.shake = Math.max(0, this.shake - dt);
    const sx = (Math.random() - 0.5) * this.shake * 0.6;
    const sy = (Math.random() - 0.5) * this.shake * 0.6;

    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight + bob, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + sy, this.yaw + sx, !this.alive ? 0.6 : 0);
  }
}
