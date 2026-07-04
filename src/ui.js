// ============================================================
// UI MANAGER - HUD, toasts, panels (inventory / build / trader /
// vehicle / storage), start + death screens, mobile button setup.
// All DOM lives in index.html; this file only fills and wires it.
// To expand: add a crafting panel the same way as the build panel.
// ============================================================
import { ITEMS } from './items.js';
import { PIECES } from './building.js';
import { TRADER_STOCK } from './trader.js';

// bump when shipping notable changes; included in feedback reports
export const GAME_VERSION = '0.6.0';

// Short survival tips shown on death so a loss teaches something (issue #15).
// Keep every line factually true to the mechanics — players learn from these.
const DEATH_TIPS = [
  '🧟 At night zombies move faster and see you from 18m (12m by day). Be behind walls or in the plaza before dark.',
  '🏰 The fenced plaza is a true safe zone — zombies can’t follow you in. Run there when you’re low.',
  '🩹 A bandage restores 25 HP. Buy them from the trader or loot downed infected — carry a spare.',
  '🥫 Canned food and 🧴 water stop the starve/thirst drain (2 HP/s at empty). Top up before either hits zero.',
  '❤️ You only heal when hunger and thirst are both above 60. Stay fed and hydrated to regenerate.',
  '🔨 A wall, a wall, and a door make a safe corner anywhere. Gather 🪵 and 🪨 early so you can build before night.',
  '🚗 A repaired car can run over zombies and outrun them. Find fuel, battery, and wheels to fix one.',
];

export class UI {
  constructor(game) {
    this.game = game;
    this.$ = id => document.getElementById(id);
    this.toastTimer = null;
    this.activeStorage = null;
    this.selectedSlot = -1;

    // show touch controls only on touch devices
    if (game.input.isTouch) {
      this.$('joystick').style.display = 'block';
      for (const el of document.querySelectorAll('.abtn')) el.style.display = 'flex';
    }

    // menu buttons
    this.$('mb-inv').addEventListener('click', () => this.togglePanel('inv'));
    this.$('mb-build').addEventListener('click', () => this.togglePanel('build'));
    this.$('mb-cam').addEventListener('click', () => game.camCtl.toggleMode());
    this.$('mb-save').addEventListener('click', () => game.save.save());
    this.$('mb-fb').addEventListener('click', () => this.openFeedback());

    // start screen
    this.$('start-help').textContent = game.input.isTouch
      ? 'Left stick: move (push to edge = sprint). Drag right side: look. USE: interact. HIT: attack/chop. Survive, scavenge, build. The fenced plaza is safe.'
      : 'WASD move, Shift sprint, mouse look (click to lock), click attack/chop, E interact, I inventory, B build, V camera, Space jump. The fenced plaza is safe.';
    // one clear danger cue so first deaths feel learnable, not random (issue #15)
    this.$('start-tip').textContent =
      '⚠️ Zombies get faster and spot you from farther at night. Build walls or get back to the fenced plaza before dark — they can’t enter it.';
    this.$('start-btn').addEventListener('click', () => {
      this.$('start-screen').style.display = 'none';
      game.started = true;
    });

    // death screen
    this.$('respawn-btn').addEventListener('click', () => {
      this.$('death-screen').style.display = 'none';
      game.player.respawn();
    });

    game.inventory.onChange = () => {
      if (this._open === 'inv') this.renderInventory();
      if (this._open === 'storage') this.renderStorage();
      if (this._open === 'trader') this.renderTrader();
      if (this._open === 'vehicle') {
        const v = this.game.vehicles.list.find(v => v.repaired && !v.driving);
        if (v) this.renderVehicle(v);
      }
    };
    this._open = null;
  }

  // ---------- generic panel helpers ----------
  closeAll() {
    for (const id of ['inv-panel', 'build-panel', 'trader-panel', 'vehicle-panel', 'fb-panel']) this.$(id).style.display = 'none';
    this._open = null;
    this.activeStorage = null;
  }

  _show(id) {
    this.closeAll();
    this.$(id + '-panel').style.display = 'block';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  togglePanel(which) {
    if (this._open === which) { this.closeAll(); return; }
    if (which === 'inv') { this._open = 'inv'; this._show('inv'); this.renderInventory(); }
    if (which === 'build') { this._open = 'build'; this._show('build'); this.renderBuild(); }
  }

  _panelHeader(title) {
    return `<button class="close">✕</button><h3>${title}</h3>`;
  }

  _wireClose(panel) {
    panel.querySelector('.close').addEventListener('click', () => this.closeAll());
  }

  // ---------- inventory ----------
  renderInventory() {
    const p = this.$('inv-panel');
    const inv = this.game.inventory;
    let html = this._panelHeader('🎒 Inventory') + '<div class="slotgrid">';
    inv.slots.forEach((s, i) => {
      if (s) {
        const d = ITEMS[s.id];
        const sel = i === this.selectedSlot ? 'style="border-color:#ffd75e"' : '';
        html += `<div class="slot" data-i="${i}" ${sel}><span class="icon">${d.icon}</span>${d.name}<span class="cnt">${s.count}</span></div>`;
      } else html += `<div class="slot" style="opacity:.35"></div>`;
    });
    html += '</div>';
    const s = inv.slots[this.selectedSlot];
    if (s) {
      const d = ITEMS[s.id];
      html += `<div class="rowbtns">`;
      if (d.use) html += `<button data-act="use">Use ${d.icon}</button>`;
      html += `<button data-act="drop">Drop 1</button><button data-act="dropall">Drop all</button></div>`;
    } else {
      html += `<div style="font-size:10px;opacity:.6;margin-top:8px;text-align:center">Tap an item to use or drop it.</div>`;
    }
    p.innerHTML = html;
    this._wireClose(p);
    p.querySelectorAll('.slot[data-i]').forEach(el => el.addEventListener('click', () => {
      this.selectedSlot = this.selectedSlot === +el.dataset.i ? -1 : +el.dataset.i;
      this.renderInventory();
    }));
    p.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', () => {
      const slot = inv.slots[this.selectedSlot];
      if (!slot) return;
      const d = ITEMS[slot.id];
      if (el.dataset.act === 'use' && d.use) {
        this.game.stats.consume(d.use);
        inv.removeSlot(this.selectedSlot, 1);
        this.toast(`Used ${d.icon} ${d.name}`);
      } else if (el.dataset.act === 'drop') {
        if (this.game.pickups.dropFromPlayer(slot.id, 1)) inv.removeSlot(this.selectedSlot, 1);
      } else if (el.dataset.act === 'dropall') {
        if (this.game.pickups.dropFromPlayer(slot.id, slot.count)) inv.removeSlot(this.selectedSlot, slot.count);
      }
      if (!inv.slots[this.selectedSlot]) this.selectedSlot = -1;
      this.renderInventory();
    }));
  }

  // ---------- build menu ----------
  renderBuild() {
    const p = this.$('build-panel');
    let html = this._panelHeader('🔨 Build');
    for (const [id, def] of Object.entries(PIECES)) {
      const afford = this.game.buildings.canAfford(id);
      html += `<div class="traderow"><span>${def.icon} ${def.name} <small style="opacity:.7">${this.game.buildings.costText(id)}</small></span>
        <button data-piece="${id}" ${afford ? '' : 'disabled'}>Place</button></div>`;
    }
    html += `<div style="font-size:10px;opacity:.6;margin-top:8px">Gather 🪵 from trees and 🪨 from rocks (HIT / click them). Can't build inside the safe zone.</div>`;
    p.innerHTML = html;
    this._wireClose(p);
    p.querySelectorAll('[data-piece]').forEach(el => el.addEventListener('click', () => {
      this.closeAll();
      this.game.buildings.enterMode(el.dataset.piece);
    }));
  }

  // ---------- trader ----------
  openTrader() { this._open = 'trader'; this._show('trader'); this.renderTrader(); }

  renderTrader() {
    const p = this.$('trader-panel');
    const t = this.game.trader, inv = this.game.inventory;
    let html = this._panelHeader(`🧑‍🌾 Trader — you have ${this.game.coins} 🪙`);
    html += `<div style="font-size:11px;opacity:.75;margin-bottom:6px">BUY</div>`;
    for (const id of TRADER_STOCK) {
      const d = ITEMS[id];
      html += `<div class="traderow"><span>${d.icon} ${d.name}</span>
        <button data-buy="${id}" ${this.game.coins >= t.buyPrice(id) ? '' : 'disabled'}>${t.buyPrice(id)} 🪙</button></div>`;
    }
    const owned = [...new Set(inv.slots.filter(Boolean).map(s => s.id))];
    if (owned.length) {
      html += `<div style="font-size:11px;opacity:.75;margin:8px 0 6px">SELL (you have)</div>`;
      for (const id of owned) {
        const d = ITEMS[id];
        html += `<div class="traderow"><span>${d.icon} ${d.name} ×${inv.count(id)}</span>
          <button class="sellb" data-sell="${id}">+${t.sellPrice(id)} 🪙</button></div>`;
      }
    }
    p.innerHTML = html;
    this._wireClose(p);
    p.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => { t.buy(el.dataset.buy); this.renderTrader(); }));
    p.querySelectorAll('[data-sell]').forEach(el => el.addEventListener('click', () => { t.sell(el.dataset.sell); this.renderTrader(); }));
  }

  // ---------- storage box ----------
  openStorage(storageInv) {
    this._open = 'storage';
    this.activeStorage = storageInv;
    storageInv.onChange = () => { if (this._open === 'storage') this.renderStorage(); };
    this._show('inv');
    this.renderStorage();
  }

  renderStorage() {
    const p = this.$('inv-panel');
    const st = this.activeStorage, inv = this.game.inventory;
    if (!st) return;
    const grid = (inventory, tag) => {
      let h = '<div class="slotgrid">';
      inventory.slots.forEach((s, i) => {
        if (s) {
          const d = ITEMS[s.id];
          h += `<div class="slot" data-${tag}="${i}"><span class="icon">${d.icon}</span>${d.name}<span class="cnt">${s.count}</span></div>`;
        } else h += `<div class="slot" style="opacity:.35"></div>`;
      });
      return h + '</div>';
    };
    p.innerHTML = this._panelHeader('📦 Storage — tap items to move them')
      + `<div style="font-size:11px;opacity:.7;margin-bottom:4px">BOX</div>` + grid(st, 'st')
      + `<div style="font-size:11px;opacity:.7;margin:8px 0 4px">YOUR BAG</div>` + grid(inv, 'inv');
    this._wireClose(p);
    p.querySelectorAll('[data-st]').forEach(el => el.addEventListener('click', () => {
      const s = st.slots[+el.dataset.st];
      if (!s) return;
      const moved = s.count - inv.add(s.id, s.count);
      st.remove(s.id, moved);
      this.renderStorage();
    }));
    p.querySelectorAll('[data-inv]').forEach(el => el.addEventListener('click', () => {
      const s = inv.slots[+el.dataset.inv];
      if (!s) return;
      const moved = s.count - st.add(s.id, s.count);
      inv.remove(s.id, moved);
      this.renderStorage();
    }));
  }

  // ---------- vehicle ----------
  openVehicle(v) { this._open = 'vehicle'; this._show('vehicle'); this.renderVehicle(v); }

  renderVehicle(v) {
    const p = this.$('vehicle-panel');
    const req = this.game.vehicles.required();
    let html = this._panelHeader(v.repaired ? (v.driving ? '🚗 Driving' : '🚗 Repaired Car') : '🚗 Broken Car');
    if (v.repaired) {
      if (v.driving) {
        html += `<div style="font-size:12px">WASD / stick to drive. E / USE to exit.</div>`;
        html += `<div class="rowbtns"><button data-exit>Exit car</button></div>`;
      } else {
        html += `<div style="font-size:12px">The engine is running! E / USE to enter and drive.</div>`;
        html += `<div class="rowbtns"><button data-drive>Drive car</button></div>`;
      }
    } else {
      html += `<div style="font-size:11px;opacity:.75;margin-bottom:6px">Install parts to repair (find them in crates or buy from the trader):</div>`;
      for (const [part, need] of Object.entries(req)) {
        const d = ITEMS[part];
        const have = this.game.inventory.count(part);
        const done = v.installed[part] >= need;
        html += `<div class="traderow"><span>${d.icon} ${d.name} ${v.installed[part]}/${need} <small style="opacity:.6">(bag: ${have})</small></span>
          <button data-part="${part}" ${done || have === 0 ? 'disabled' : ''}>${done ? '✓' : 'Install'}</button></div>`;
      }
    }
    p.innerHTML = html;
    this._wireClose(p);
    p.querySelectorAll('[data-part]').forEach(el => el.addEventListener('click', () => this.game.vehicles.install(v, el.dataset.part)));
    p.querySelectorAll('[data-drive]').forEach(el => el.addEventListener('click', () => this.game.vehicles.enterVehicle(v)));
    p.querySelectorAll('[data-exit]').forEach(el => el.addEventListener('click', () => this.game.vehicles.exitVehicle(v)));
  }

  // ---------- feedback (goes to GitHub issues via /api/feedback) ----------
  openFeedback() {
    this._open = 'fb';
    this._show('fb');
    const p = this.$('fb-panel');
    const savedHandle = (localStorage.getItem('fable_fb_handle') || '').replace(/"/g, '&quot;');
    p.innerHTML = this._panelHeader('💬 Message the Dev Team')
      + `<div style="font-size:11px;opacity:.75;margin-bottom:8px">Found a bug? Got an idea? It goes straight to the devs.
         <b>Use a made-up nickname — not your real name.</b></div>`
      + `<input type="text" id="fb-handle" maxlength="24" placeholder="Your nickname (made-up!)" value="${savedHandle}">`
      + `<select id="fb-cat" style="width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#fff;padding:8px;font-size:13px;margin-bottom:8px">
           <option value="Bug">🐛 Bug — something broke</option>
           <option value="Idea">💡 Idea — add this!</option>
           <option value="Balance">⚖️ Balance — too hard / too easy</option>
           <option value="Controls">🎮 Controls</option>
           <option value="Graphics">🎨 Graphics / looks</option>
           <option value="Other">💬 Other</option>
         </select>`
      + `<textarea id="fb-msg" maxlength="500" rows="4" placeholder="What happened? What would make the game better?"></textarea>`
      + `<input type="text" id="fb-web" style="display:none" tabindex="-1" autocomplete="off">`
      + `<div class="rowbtns"><button id="fb-send">Send 📨</button></div>`
      + `<div id="fb-status" style="font-size:11px;margin-top:6px;text-align:center;opacity:.85"></div>`;
    this._wireClose(p);
    p.querySelector('#fb-send').addEventListener('click', () => this._sendFeedback());
  }

  async _sendFeedback() {
    const status = this.$('fb-status');
    const last = +localStorage.getItem('fable_fb_last') || 0;
    if (Date.now() - last < 60000) { status.textContent = 'Please wait a minute between messages.'; return; }
    const handle = this.$('fb-handle').value.trim();
    const message = this.$('fb-msg').value.trim();
    if (message.length < 3) { status.textContent = 'Write a little more first :)'; return; }
    localStorage.setItem('fable_fb_handle', handle);
    status.textContent = 'Sending…';
    try {
      // context that helps debugging, with nothing personal in it
      const g = this.game;
      const meta = {
        version: GAME_VERSION,
        device: (this.game.input.isTouch ? 'touch ' : 'desktop ') + `${screen.width}x${screen.height}`,
        ua: navigator.userAgent.slice(0, 80),
        pos: `${Math.round(g.player.pos.x)},${Math.round(g.player.pos.z)}`,
        day: g.dayNight.clockText(),
        driving: g.player.inVehicle ? 'yes' : 'no'
      };
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, message, category: this.$('fb-cat').value, meta, website: this.$('fb-web').value })
      });
      if (r.ok) {
        localStorage.setItem('fable_fb_last', String(Date.now()));
        status.textContent = '✅ Sent! The dev team will see it. Thanks!';
        this.$('fb-msg').value = '';
      } else {
        const d = await r.json().catch(() => ({}));
        status.textContent = d.error === 'not-configured'
          ? 'Feedback inbox is not hooked up yet — tell the dev in person!'
          : 'Could not send — try again later.';
      }
    } catch {
      status.textContent = 'No connection — try again later.';
    }
  }

  // ---------- HUD ----------
  updateHUD() {
    const s = this.game.stats;
    this.$('hp-fill').style.width = s.health + '%';
    this.$('st-fill').style.width = s.stamina + '%';
    this.$('hu-fill').style.width = s.hunger + '%';
    this.$('th-fill').style.width = s.thirst + '%';
    this.$('coins').textContent = `🪙 ${this.game.coins}`;
    this.$('clock').textContent = this.game.dayNight.clockText();
    const t = this.game.nearInteractable;
    const pr = this.$('prompt');
    if (t && !this._open && !this.game.buildings.mode) {
      pr.style.display = 'block';
      const label = typeof t.label === 'function' ? t.label() : t.label;
      pr.textContent = `${label} — ${this.game.input.isTouch ? 'tap USE' : 'press E'}`;
    } else pr.style.display = 'none';
  }

  toast(msg) {
    const el = this.$('toast');
    el.textContent = msg;
    el.style.opacity = 1;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = 0; }, 2200);
  }

  showDeath(reason) {
    this.$('death-reason').textContent = reason;
    this.$('death-tip').textContent = '💡 ' + DEATH_TIPS[Math.floor(Math.random() * DEATH_TIPS.length)];
    this.$('death-screen').style.display = 'flex';
    this.closeAll();
  }
}
