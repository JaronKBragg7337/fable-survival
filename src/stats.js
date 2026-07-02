// ============================================================
// SURVIVAL STATS - health / stamina / hunger / thirst.
// Rates are per real second. Tune the constants below.
// To expand: add temperature, sickness, or blood the same way -
// a value, a drain rate, and an effect when it hits 0.
// ============================================================
const HUNGER_RATE = 100 / 480;   // empty in ~8 min
const THIRST_RATE = 100 / 360;   // empty in ~6 min
const STARVE_DPS  = 2;           // hp/s when hunger or thirst is 0
const STAM_DRAIN  = 14;          // sprint stamina/s
const STAM_REGEN  = 10;
const REGEN_HP    = 1.2;         // hp/s when well fed + hydrated

export class Stats {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.health = 100; this.stamina = 100;
    this.hunger = 100; this.thirst = 100;
    this.dead = false;
  }

  update(dt, sprinting) {
    if (this.dead) return;
    this.hunger = Math.max(0, this.hunger - HUNGER_RATE * dt);
    this.thirst = Math.max(0, this.thirst - THIRST_RATE * dt);

    if (sprinting) this.stamina = Math.max(0, this.stamina - STAM_DRAIN * dt);
    else this.stamina = Math.min(100, this.stamina + STAM_REGEN * dt);

    if (this.hunger <= 0) this.damage(STARVE_DPS * dt, 'You starved.');
    if (this.thirst <= 0) this.damage(STARVE_DPS * dt, 'You died of thirst.');

    // passive regen when healthy supplies
    if (this.hunger > 60 && this.thirst > 60 && this.health < 100)
      this.health = Math.min(100, this.health + REGEN_HP * dt);
  }

  damage(n, reason = 'You died.') {
    if (this.dead) return;
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0) {
      this.dead = true;
      this.game.ui.showDeath(reason);
    }
  }

  consume(use) { // { health?, hunger?, thirst? }
    if (use.health) this.health = Math.min(100, this.health + use.health);
    if (use.hunger) this.hunger = Math.min(100, this.hunger + use.hunger);
    if (use.thirst) this.thirst = Math.min(100, this.thirst + use.thirst);
  }

  toJSON() { const { health, stamina, hunger, thirst } = this; return { health, stamina, hunger, thirst }; }
  fromJSON(d) { Object.assign(this, d); this.dead = false; }
}
