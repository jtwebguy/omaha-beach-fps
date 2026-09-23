// Particle effects: impact puffs, blood, water splashes, muzzle flashes, artillery.
import * as THREE from 'three';

function makeSoftSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const SURFACE_COLORS = {
  sand: 0xb8a878, water: 0xdfe8e8, metal: 0xffcc66, wood: 0x6a5238,
  concrete: 0xaaaaaa, flesh: 0x7a0a0a,
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeSoftSprite();
    this.particles = [];
    this.pool = [];
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 12);
    scene.add(this.flashLight);
    this.flashTime = 0;
  }

  spawn({ pos, vel, color, size, life, gravity = 0, grow = 1, opacity = 1 }) {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
      this.scene.add(s);
    }
    s.visible = true;
    s.material.color.setHex(color);
    s.material.opacity = opacity;
    s.position.copy(pos);
    s.scale.setScalar(size);
    this.particles.push({ s, vel: vel.clone(), life, maxLife: life, gravity, grow, size, opacity });
  }

  impact(point, normal, surface = 'sand') {
    const color = SURFACE_COLORS[surface] ?? 0xaaaaaa;
    const n = surface === 'water' ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const v = normal.clone().multiplyScalar(1.5 + Math.random() * 2)
        .add(new THREE.Vector3((Math.random() - .5) * 2, Math.random() * (surface === 'water' ? 5 : 2), (Math.random() - .5) * 2));
      this.spawn({ pos: point, vel: v, color, size: 0.15 + Math.random() * 0.2, life: 0.5 + Math.random() * 0.4, gravity: 8, grow: 2.5, opacity: 0.8 });
    }
  }

  blood(point) {
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3);
      this.spawn({ pos: point, vel: v, color: SURFACE_COLORS.flesh, size: 0.12 + Math.random() * 0.12, life: 0.4, gravity: 9, grow: 1.5 });
    }
  }

  muzzleFlash(pos, strength = 1) {
    this.spawn({ pos, vel: new THREE.Vector3(), color: 0xffcc66, size: 0.35 * strength, life: 0.05, grow: 1 });
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 6 * strength;
    this.flashTime = 0.05;
  }

  enemyFlash(pos) {
    this.spawn({ pos, vel: new THREE.Vector3(), color: 0xffbb55, size: 0.6, life: 0.06 });
  }

  // Artillery / mortar explosion — tall plume of sand or water
  explosion(pos, inWater) {
    const color = inWater ? 0xe8eeee : 0x8a7a5a;
    for (let i = 0; i < 40; i++) {
      const v = new THREE.Vector3((Math.random() - .5) * 6, 8 + Math.random() * 14, (Math.random() - .5) * 6);
      this.spawn({ pos, vel: v, color, size: 1 + Math.random() * 1.5, life: 1.5 + Math.random(), gravity: 12, grow: 3, opacity: 0.9 });
    }
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3((Math.random() - .5) * 3, 2 + Math.random() * 2, (Math.random() - .5) * 3);
      this.spawn({ pos, vel: v, color: 0x333330, size: 3, life: 3, gravity: -0.5, grow: 3, opacity: 0.6 });
    }
    if (!inWater) this.spawn({ pos, vel: new THREE.Vector3(), color: 0xff8833, size: 5, life: 0.15 });
  }

  update(dt) {
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flashLight.intensity = 0;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        this.pool.push(p.s);
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.s.position.addScaledVector(p.vel, dt);
      const t = 1 - p.life / p.maxLife;
      p.s.scale.setScalar(p.size * (1 + (p.grow - 1) * t));
      p.s.material.opacity = p.opacity * (1 - t);
    }
  }
}
