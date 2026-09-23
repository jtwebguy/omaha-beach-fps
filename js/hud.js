// DOM-based HUD: health, ammo, hitmarkers, objective, messages.
import { PLAYER } from './config.js';

const $ = id => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.healthFill = $('healthFill');
    this.mag = $('ammoMag');
    this.reserve = $('ammoReserve');
    this.enemyCount = $('enemyCount');
    this.hitmarker = $('hitmarker');
    this.crosshair = $('crosshair');
    this.damage = $('damage');
    this.message = $('message');
    this.hitTimer = null;
    this.msgTimer = null;
  }

  show(v) { this.el.classList.toggle('hidden', !v); }

  update(player, weapon, enemiesLeft) {
    const hp = player.health / PLAYER.maxHealth;
    this.healthFill.style.width = `${hp * 100}%`;
    this.healthFill.style.background = hp > 0.5 ? '#8a9a3a' : hp > 0.25 ? '#c9a13a' : '#b33';
    this.damage.style.boxShadow = `inset 0 0 180px rgba(160,0,0,${(1 - hp) * 0.85})`;
    this.mag.textContent = weapon.reloading > 0 ? '—' : weapon.mag;
    this.reserve.textContent = weapon.reserve;
    this.enemyCount.textContent = enemiesLeft;
    this.crosshair.classList.toggle('ads', weapon.aimFactor > 0.5);
  }

  hit(kill) {
    this.hitmarker.classList.add('show');
    this.hitmarker.classList.toggle('kill', kill);
    clearTimeout(this.hitTimer);
    this.hitTimer = setTimeout(() => this.hitmarker.classList.remove('show'), 90);
  }

  say(text, seconds = 3) {
    this.message.innerHTML = text;
    clearTimeout(this.msgTimer);
    if (seconds > 0) this.msgTimer = setTimeout(() => (this.message.textContent = ''), seconds * 1000);
  }
}
