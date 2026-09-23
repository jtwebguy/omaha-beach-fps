// Keyboard + mouse + pointer lock input state.
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.fire = false;
    this.firePressed = false;   // edge-triggered (semi-auto)
    this.aim = false;
    this.locked = false;
    this.onUnlock = null;

    addEventListener('keydown', e => { this.keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    addEventListener('mousedown', e => {
      if (!this.locked) return;
      if (e.button === 0) { this.fire = true; this.firePressed = true; }
      if (e.button === 2) this.aim = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.aim = false;
    });
    addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) { this.keys.clear(); this.fire = this.aim = false; this.onUnlock?.(); }
    });
  }

  // Falls back to "free mouse" mode if pointer lock is unavailable (iframes, some browsers).
  lock() {
    const fallback = () => { this.locked = true; this.fallback = true; };
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(fallback);
    } catch { fallback(); }
    if (!this.escBound) {
      this.escBound = true;
      addEventListener('keydown', e => {
        if (e.code === 'Escape' && this.fallback && this.locked) { this.locked = false; this.onUnlock?.(); }
      });
    }
  }
  down(code) { return this.keys.has(code); }

  consumeMouse() {
    const d = [this.mouseDX, this.mouseDY];
    this.mouseDX = this.mouseDY = 0;
    return d;
  }

  consumeFire() {
    const f = this.firePressed;
    this.firePressed = false;
    return f;
  }
}
