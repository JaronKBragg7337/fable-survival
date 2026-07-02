// ============================================================
// INPUT MANAGER - one place for desktop + mobile input.
// Exposes:
//   .move   {x, z}  normalized movement intent (camera-relative applied by player)
//   .sprint boolean
//   .consumeLook() -> {x, y} accumulated look delta since last frame
//   .on(event, fn) for: 'interact' | 'attack' | 'jump' | 'toggleBuild' | 'toggleInv'
//   .isTouch  - true when touch controls are active
// To add a new action: bind a key below + a button in index.html/ui.js
// and fire this.emit('yourAction').
// ============================================================
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, z: 0 };
    this.sprint = false;
    this.lookX = 0; this.lookY = 0;
    this.listeners = {};
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.pointerLocked = false;

    this._initKeyboard();
    this._initMouse();
    this._initTouch();
  }

  on(ev, fn) { (this.listeners[ev] ??= []).push(fn); }
  emit(ev) { (this.listeners[ev] || []).forEach(f => f()); }

  consumeLook() {
    const d = { x: this.lookX, y: this.lookY };
    this.lookX = 0; this.lookY = 0;
    return d;
  }

  // ---------- Desktop ----------
  _initKeyboard() {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.emit('interact');
      if (e.code === 'Space') this.emit('jump');
      if (e.code === 'KeyB') this.emit('toggleBuild');
      if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); this.emit('toggleInv'); }
      if (e.code === 'KeyV') this.emit('toggleCam');
      if (e.code === 'Escape') this.emit('closeAll');
      this._updateMoveFromKeys();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); this._updateMoveFromKeys(); });
  }

  _updateMoveFromKeys() {
    const k = this.keys;
    let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let z = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    // Touch joystick wins if it's active
    if (!this._joyActive) { this.move.x = x; this.move.z = z; }
    this.sprint = k.has('ShiftLeft') || k.has('ShiftRight') || this._joySprint;
  }

  _initMouse() {
    this.canvas.addEventListener('click', () => {
      if (this.isTouch) return;
      if (!this.pointerLocked) this.canvas.requestPointerLock?.();
      else this.emit('attack');
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    window.addEventListener('mousemove', e => {
      if (this.pointerLocked) { this.lookX += e.movementX * 0.0022; this.lookY += e.movementY * 0.0022; }
    });
  }

  // ---------- Mobile: virtual joystick (left) + look drag (right) ----------
  _initTouch() {
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joyknob');
    if (!joy) return;
    this._joyActive = false; this._joySprint = false;
    let joyId = null, lookId = null, lookLast = null;
    const joyRect = () => joy.getBoundingClientRect();

    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };

    window.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        const r = joyRect();
        const inJoy = t.clientX >= r.left - 30 && t.clientX <= r.right + 30 && t.clientY >= r.top - 30 && t.clientY <= r.bottom + 30;
        if (inJoy && joyId === null) { joyId = t.identifier; this._joyActive = true; }
        else if (lookId === null && t.clientX > window.innerWidth * 0.4 && !this._onUI(t)) {
          lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          const r = joyRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          let dx = t.clientX - cx, dy = t.clientY - cy;
          const max = r.width / 2, len = Math.hypot(dx, dy);
          if (len > max) { dx = dx / len * max; dy = dy / len * max; }
          setKnob(dx, dy);
          this.move.x = dx / max; this.move.z = dy / max;
          this._joySprint = len / max > 0.92;   // push to edge = sprint
          this.sprint = this._joySprint;
        } else if (t.identifier === lookId && lookLast) {
          this.lookX += (t.clientX - lookLast.x) * 0.006;
          this.lookY += (t.clientY - lookLast.y) * 0.006;
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      if (this._joyActive || lookId !== null) e.preventDefault();
    }, { passive: false });

    const endTouch = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null; this._joyActive = false; this._joySprint = false;
          this.move.x = 0; this.move.z = 0; this.sprint = false;
          setKnob(0, 0);
        }
        if (t.identifier === lookId) { lookId = null; lookLast = null; }
      }
    };
    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);

    // Action buttons (shown by ui.js only on touch devices)
    const bind = (id, ev) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); this.emit(ev); }, { passive: false });
    };
    bind('btn-act', 'interact');
    bind('btn-atk', 'attack');
    bind('btn-jump', 'jump');
  }

  _onUI(t) {
    const el = document.elementFromPoint(t.clientX, t.clientY);
    return el && (el.closest('.abtn') || el.closest('.mbtn') || el.closest('.panel'));
  }
}
