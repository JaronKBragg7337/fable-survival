// ============================================================
// TRADER - safe zone NPC economy. Buy at 2x item value, sell at 1x.
// Currency is game.coins (earned from killing infected + selling).
// To expand: multiple traders with different stock lists, rotating
// stock, or reputation-based discounts (multiply price here).
// ============================================================
import { ITEMS } from './items.js';

export const TRADER_STOCK = ['can', 'water', 'bandage', 'axe', 'pickaxe', 'fuel', 'battery', 'wheel'];

export class Trader {
  constructor(game) { this.game = game; }

  buyPrice(id) { return ITEMS[id].value * 2; }
  sellPrice(id) { return ITEMS[id].value; }

  buy(id) {
    const price = this.buyPrice(id);
    if (this.game.coins < price) { this.game.ui.toast('Not enough coins.'); return false; }
    const left = this.game.inventory.add(id, 1);
    if (left > 0) { this.game.ui.toast('Inventory full!'); return false; }
    this.game.coins -= price;
    this.game.ui.toast(`Bought ${ITEMS[id].icon} ${ITEMS[id].name}`);
    return true;
  }

  sell(id) {
    if (!this.game.inventory.remove(id, 1)) return false;
    this.game.coins += this.sellPrice(id);
    this.game.ui.toast(`Sold ${ITEMS[id].icon} for ${this.sellPrice(id)} 🪙`);
    return true;
  }
}
