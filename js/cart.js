// ---------- /js/cart.js ----------
const CART_KEY = 'ecolife_cart';

const Cart = {
  // Normaliza un item para que siempre tengan los campos y tipos correctos
  _normalize(it = {}) {
    return {
      id: String(it.id || '').trim(),
      title: String(it.title || ''),
      price: Number(it.price ?? 0),                           // precio final (con oferta)
      priceOld: (it.priceOld != null ? Number(it.priceOld) : null), // precio original (si hay)
      onSale: !!it.onSale,                                    // bandera de oferta
      thumbnail: it.thumbnail || '',
      qty: Math.max(1, (it.qty | 0) || 1),
    };
  },

  _read() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY)) || [];
      return Array.isArray(raw) ? raw.map(it => this._normalize(it)) : [];
    } catch {
      return [];
    }
  },

  _write(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
  },

  getItems() { return this._read(); },

  /**
   * addItem(payload, qty)
   * payload puede traer: id, title, price (final), priceOld (original), onSale, thumbnail
   */
  addItem(payload, qty = 1) {
    const incoming = this._normalize({ ...payload, qty: Math.max(1, qty | 0) });
    if (!incoming.id) return;

    const items = this._read();
    const i = items.findIndex(x => x.id === incoming.id);

    if (i >= 0) {
      // Sumar cantidad y ACTUALIZAR precios/flags con lo último (por si cambió la oferta)
      items[i].qty       += incoming.qty;
      items[i].price      = incoming.price;
      items[i].priceOld   = incoming.priceOld;
      items[i].onSale     = incoming.onSale;
      items[i].thumbnail  = incoming.thumbnail || items[i].thumbnail;
      items[i].title      = incoming.title     || items[i].title;
    } else {
      items.push(incoming);
    }

    this._write(items);
  },

  setQty(id, qty) {
    const items = this._read();
    const i = items.findIndex(x => x.id === id);
    if (i >= 0) { items[i].qty = Math.max(1, qty | 0); this._write(items); }
  },

  remove(id) { this._write(this._read().filter(x => x.id !== id)); },

  clear() { this._write([]); },

  count() { return this._read().reduce((a, x) => a + x.qty, 0); },

  total() { return this._read().reduce((a, x) => a + Number(x.price || 0) * Number(x.qty || 1), 0); },

  // ---------- Helpers para render ----------
  fmt(n) { return (n != null) ? 'U$S ' + Number(n).toLocaleString('es-UY') : ''; },

  /**
   * Devuelve HTML con precio tachado + precio final + badge si hay oferta.
   * Usalo así: el.innerHTML = Cart.renderItemPriceHTML(item)
   */
// Reemplazá Cart.renderItemPriceHTML por esta versión
renderItemPriceHTML(item) {
  const it = this._normalize(item);
  if (it.onSale && it.priceOld && it.priceOld > it.price) {
    const pct = Math.max(0, Math.round((1 - (it.price / it.priceOld)) * 100));
    return `
      <div class="cart-price is-stacked" aria-label="Precio en oferta">
        <div class="row old"><span class="old-price">${this.fmt(it.priceOld)}</span></div>
        <div class="row now">
          <span class="price">${this.fmt(it.price)}</span>
          <span class="badge">-${pct}%</span>
        </div>
      </div>`;
  }
  return `
    <div class="cart-price is-stacked">
      <div class="row now"><span class="price">${this.fmt(it.price)}</span></div>
    </div>`;
},


  /**
   * Reprecia los items del carrito con data/offers.json
   * - Si hay oferta para ese id, setea onSale=true, priceOld=precio anterior y price=precio de oferta
   * - Escribe y dispara 'cart:repriced'
   */
  async repriceWithOffers() {
    try {
      const r = await fetch('data/offers.json', { cache: 'no-store' });
      if (!r.ok) return;
      const rules = await r.json();

      // Pasamos offers a un mapa id -> precio final (cuando exista precio explícito)
      let map = {};
      if (Array.isArray(rules)) {
        for (const it of rules) {
          if (it && it.id != null && it.price != null && !isNaN(it.price)) {
            map[String(it.id)] = Number(it.price);
          }
        }
      } else if (rules && typeof rules === 'object') {
        for (const [id, val] of Object.entries(rules)) {
          if (val != null && !isNaN(val)) map[String(id)] = Number(val);
        }
      }

      // Si no hay precios directos, salimos (tu applyOffers calcula % por marca/categoría)
      // Para esos casos, lo ideal es repricing en tienda/product.js antes de agregar.
      const ids = Object.keys(map);
      if (!ids.length) return;

      const items = this._read();
      let changed = false;

      for (const it of items) {
        const newPrice = map[it.id];
        if (newPrice != null && !isNaN(newPrice)) {
          if (!(it.onSale && it.price === newPrice)) {
            // guardamos el viejo si es mayor que el nuevo
            const old = Number(it.price || 0);
            if (!it.priceOld || old > newPrice) it.priceOld = old;
            it.price  = newPrice;
            it.onSale = it.priceOld > it.price;
            changed = true;
          }
        }
      }

      if (changed) {
        this._write(items);
        window.dispatchEvent(new CustomEvent('cart:repriced', { detail: { items } }));
      }
    } catch (e) {
      console.warn('No se pudo repriciar el carrito con offers.json:', e);
    }
  }
};

// ----- badge en el header (todas las páginas con .gdar-cart-count)
function updateCartBadge() {
  const els = document.querySelectorAll('.gdar-cart-count');
  if (!els.length) return;
  const c = Cart.count();
  els.forEach(el => {
    el.textContent = c;
    el.style.visibility = c > 0 ? 'visible' : 'hidden';
  });
}
document.addEventListener('DOMContentLoaded', updateCartBadge);
window.addEventListener('cart:updated', updateCartBadge);

// ----- Repricing al cargar la página del carrito (y cada update)
document.addEventListener('DOMContentLoaded', () => {
  Cart.repriceWithOffers(); // actualiza precios/tachado si hay ofertas por id
});
window.addEventListener('cart:updated', () => {
  Cart.repriceWithOffers();
});

window.EcoCart = { Cart, updateCartBadge };
