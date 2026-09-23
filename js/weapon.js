// M1 Garand: procedural viewmodel, semi-auto hitscan, 8-round en-bloc clip with "ping".
import * as THREE from 'three';
import { WEAPON } from './config.js';

function buildGarandModel() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 });

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.55), wood);
  stock.position.set(0, -0.02, 0.12);
  const butt = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 0.2), wood);
  butt.position.set(0, -0.06, 0.42); butt.rotation.x = -0.15;
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), wood);
  handguard.position.set(0, 0.03, -0.35);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.22), metal);
  receiver.position.set(0, 0.035, -0.05);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 8), metal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.045, -0.55);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.02), metal);
  rearSight.position.set(0, 0.085, 0.03);
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.01), metal);
  frontSight.position.set(0, 0.07, -0.9);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.05), metal);
  trigger.position.set(0, -0.06, 0.0);

  [stock, butt, handguard, receiver, barrel, rearSight, frontSight, trigger].forEach(m => g.add(m));

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.045, -0.95);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  // Keep the viewmodel from clipping into world geometry
  g.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.material.depthTest = true; } });
  return g;
}

export class Weapon {
  constructor(camera, scene, audio, effects) {
    this.camera = camera;
    this.audio = audio;
    this.effects = effects;
    this.model = buildGarandModel();
    camera.add(this.model);
    this.hipPos = new THREE.Vector3(0.22, -0.2, -0.45);
    this.adsPos = new THREE.Vector3(0, -0.085, -0.3);
    this.model.position.copy(this.hipPos);
    this.mag = WEAPON.magSize;
    this.reserve = WEAPON.reserve;
    this.cooldown = 0;
    this.reloading = 0;
    this.aimFactor = 0;
    this.kick = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = WEAPON.range;
    this.swayX = 0; this.swayY = 0;
  }

  reset() {
    this.mag = WEAPON.magSize;
    this.reserve = WEAPON.reserve;
    this.reloading = 0;
    this.cooldown = 0;
  }

  // M1 Garand can only be reloaded when the clip is empty (en-bloc clip) — authentic behaviour
  startReload() {
    if (this.reloading > 0 || this.reserve <= 0 || this.mag === WEAPON.magSize) return;
    if (this.mag > 0) {
      // Allow a tactical "clip eject": lose remaining rounds — the realistic trade-off
      this.mag = 0;
      this.audio.garandPing();
    }
    this.reloading = WEAPON.reloadTime;
    this.audio.reload();
  }

  /**
   * @returns {null | {object, point, normal}} what was hit
   */
  tryFire(targets, player) {
    if (this.cooldown > 0 || this.reloading > 0) return null;
    if (this.mag <= 0) { this.audio.dryFire(); this.cooldown = 0.3; return null; }

    this.mag--;
    this.cooldown = WEAPON.fireInterval;
    this.kick = 1;
    this.audio.rifleShot();
    player.addRecoil(WEAPON.recoil * (1 - this.aimFactor * 0.4));

    const muzzleWorld = new THREE.Vector3();
    this.model.userData.muzzle.getWorldPosition(muzzleWorld);
    this.effects.muzzleFlash(muzzleWorld);

    if (this.mag === 0) {
      this.audio.garandPing();
      if (this.reserve > 0) setTimeout(() => this.startReload(), 350);
    }

    // Hitscan with spread
    let spread = THREE.MathUtils.lerp(WEAPON.spreadHip, WEAPON.spreadAds, this.aimFactor);
    if (player.moving) spread *= 1.8;
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, -1
    ).normalize().applyQuaternion(this.camera.quaternion);
    this.raycaster.set(this.camera.getWorldPosition(new THREE.Vector3()), dir);
    const hits = this.raycaster.intersectObjects(targets, false);
    return hits.length ? hits[0] : null;
  }

  update(dt, input) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const n = Math.min(WEAPON.magSize, this.reserve);
        this.mag = n;
        this.reserve -= n;
        this.reloading = 0;
      }
    }
    if (input.down('KeyR')) this.startReload();

    const wantAim = input.aim && this.reloading <= 0;
    this.aimFactor += ((wantAim ? 1 : 0) - this.aimFactor) * Math.min(1, dt * 12);

    // FOV zoom
    const fov = THREE.MathUtils.lerp(WEAPON.fovHip, WEAPON.fovAds, this.aimFactor);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }

    // Sway from mouse movement
    this.swayX += (input.mouseDX * -0.0004 - this.swayX) * Math.min(1, dt * 8);
    this.swayY += (input.mouseDY * 0.0004 - this.swayY) * Math.min(1, dt * 8);

    // Position: hip ↔ ADS, recoil kick, reload dip
    this.kick = Math.max(0, this.kick - dt * 8);
    const pos = this.hipPos.clone().lerp(this.adsPos, this.aimFactor);
    const swayScale = 1 - this.aimFactor * 0.8;
    pos.x += this.swayX * swayScale;
    pos.y += this.swayY * swayScale;
    pos.z += this.kick * 0.08;
    let rotX = this.kick * 0.12;
    if (this.reloading > 0) {
      const t = 1 - this.reloading / WEAPON.reloadTime;
      const dip = Math.sin(t * Math.PI);
      pos.y -= dip * 0.15;
      rotX -= dip * 0.5;
    }
    this.model.position.copy(pos);
    this.model.rotation.set(rotX, 0, (1 - this.aimFactor) * 0.03);
  }
}
