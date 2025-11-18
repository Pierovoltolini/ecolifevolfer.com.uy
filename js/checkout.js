// js/checkout.js
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => root.querySelectorAll(sel);

  // --- PASOS ---
  const stepBtns = $$(".checkout-steps .step");
  const panels = $$(".checkout-panel");

  function showStep(n) {
    stepBtns.forEach(btn => {
      const active = Number(btn.dataset.step) === n;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active);
    });
    panels.forEach(p => {
      p.classList.toggle("is-visible", Number(p.dataset.step) === n);
    });

    const email = $("#fact-email")?.value;
    const small = $("#order-email-small");
    if (email && small) small.textContent = email;
  }

  stepBtns.forEach(btn => btn.addEventListener("click", () => showStep(Number(btn.dataset.step))));
  document.addEventListener("click", (e) => {
    const next = e.target.getAttribute("data-next");
    const prev = e.target.getAttribute("data-prev");
    if (next) showStep(Number(next));
    if (prev) showStep(Number(prev));
  });

  // --- TABS ENVÍO ---
  const shipTabs = $$(".ship-tab");
  shipTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      shipTabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const mode = tab.dataset.mode;
      document.querySelectorAll("[data-ship]").forEach(el => {
        el.hidden = el.dataset.ship !== mode;
      });
      recomputeTotals();
    });
  });

  // --- CARRITO ---
  const listEl = $("#cart-list");
  const subEl = $("#cart-sub");
  const clearBtn = $("#btn-clear");
  const fmt = new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD" });

  function renderCartRight() {
    const CartAPI = window.EcoCart?.Cart;
    if (!CartAPI) return;
    const items = CartAPI.getItems();

    if (!items.length) {
      listEl.innerHTML = `
        <li class="cart-empty">
          <p><strong>Tu carrito está vacío.</strong></p>
          <p><a class="page-btn" href="tienda.html">Ver productos</a></p>
        </li>`;
      subEl.textContent = fmt.format(0);
      recomputeTotals();
      window.EcoCart?.updateCartBadge?.();
      return;
    }

    listEl.innerHTML = items.map(it => {
      const line = (Number(it.price) || 0) * (Number(it.qty) || 1);
      const img = it.thumbnail || "img/products/placeholder.png";
      const safe = (it.title || "Producto").replace(/"/g, "&quot;");
      const priceHTML = (window.EcoCart?.Cart?.renderItemPriceHTML)
        ? window.EcoCart.Cart.renderItemPriceHTML(it)
        : `<div class="cart-price"><span>${fmt.format(it.price || 0)}</span></div>`;

      return `
<li class="ci" data-id="${String(it.id).trim()}">
  <figure>
    <img src="${img}" alt="${safe}"
      onerror="if(!this._tried){this._tried=1;this.src='img/products/placeholder.png'}">
  </figure>
  <div>
    <h4>${it.title || ""}</h4>
    <div class="qty">
      <button class="qty-dec" type="button" aria-label="Restar">−</button>
      <input class="qty-input" type="number" min="1" max="5" value="${it.qty || 1}" inputmode="numeric">
      <button class="qty-inc" type="button" aria-label="Sumar">+</button>
      <button class="remove" type="button" aria-label="Quitar">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="icon-trash">
          <path d="M4 6h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M5 6l1 14h12l1-14" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  </div>
  <div class="price">
    ${priceHTML}
    <div class="line-total"><small>× ${it.qty} = <strong>${fmt.format(line)}</strong></small></div>
  </div>
</li>`;
    }).join("");

    relocateBadgesToTitle();
    ensureRightAlignedPriceLayout();
    recomputeTotals();
    window.EcoCart?.updateCartBadge?.();
  }

  function relocateBadgesToTitle(){
    document.querySelectorAll('#cart-list .ci').forEach(row => {
      const title = row.querySelector('h4');
      const priceBlock = row.querySelector('.cart-price');
      const badge = priceBlock ? priceBlock.querySelector('.badge') : null;
      if (!title || !badge) return;

      let tr = row.querySelector('.title-row');
      if (!tr){
        tr = document.createElement('div');
        tr.className = 'title-row';
        title.parentNode.insertBefore(tr, title);
        tr.appendChild(title);
      }
      tr.appendChild(badge);
    });
  }

  function ensureRightAlignedPriceLayout(){
    const STYLE_ID = 'checkout-price-overrides';
    if (document.getElementById(STYLE_ID)) return;
    const css = `
.ci .price{ text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.cart-price{ display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.cart-price .old-price{ font-size:.82rem; font-weight:500; color:#94a3b8; text-decoration:line-through; }
.cart-price .price{ font-size:.9rem; font-weight:600; }
.line-total small{ font-size:.78rem; color:#475569; display:block; margin-top:2px; }
.ci .title-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.ci .title-row h4{ margin:0; }
.ci .title-row .badge{ margin-left:auto; }`;
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  document.addEventListener("click", (e) => {
    const CartAPI = window.EcoCart?.Cart;
    if (!CartAPI) return;
    const row = e.target.closest(".ci");
    if (!row) return;
    const id = row.dataset.id;
    const input = row.querySelector(".qty-input");
    const val = () => Math.max(1, Math.min(5, Number(input.value) || 1));

    if (e.target.matches(".qty-inc")) CartAPI.setQty(id, val() + 1);
    else if (e.target.matches(".qty-dec")) CartAPI.setQty(id, val() - 1);
    else if (e.target.matches(".remove")) CartAPI.remove(id);

    recomputeTotals();
  });

  document.addEventListener("input", (e) => {
    const CartAPI = window.EcoCart?.Cart;
    if (!CartAPI) return;
    if (!e.target.classList.contains("qty-input")) return;
    const row = e.target.closest(".ci");
    const id = row.dataset.id;
    const n = Math.max(1, Math.min(5, Number(e.target.value) || 1));
    CartAPI.setQty(id, n);
    recomputeTotals();
  });

  clearBtn?.addEventListener("click", () => {
    const CartAPI = window.EcoCart?.Cart;
    if (!CartAPI) return;
    if (confirm("¿Vaciar el carrito?")) CartAPI.clear();
    recomputeTotals();
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const CartAPI = window.EcoCart?.Cart;
    if (CartAPI?.repriceWithOffers) {
      try { await CartAPI.repriceWithOffers(); } catch {}
    }
    renderCartRight();
    ensureRightAlignedPriceLayout();
  });

  window.addEventListener("cart:updated", renderCartRight);
  window.addEventListener("cart:repriced", renderCartRight);

  // --- ENVÍO Y TOTALES ---
  const USD_FREE_SHIP_THRESHOLD = 150;
  const UYU_SHIP_FLAT = 250;
  const USD_RATE = 40;

  function calcCartSubtotalUSD(cart) {
    return cart.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  }

  function ensurePaymentStrip(summaryBox){
    if (!summaryBox) return;
    if (summaryBox.querySelector('.payment-strip')) return;

    const el = document.createElement('div');
    el.className = 'payment-strip';
    el.innerHTML = `
      <img src="img/pagoseguro.png" alt="Pago seguro: tarjetas, bancos, Handy, SSL" style="width:100%;margin-top:12px;opacity:.95;">
    `;
    summaryBox.appendChild(el);
  }

  function recomputeTotals() {
    const cart = window.EcoCart?.Cart.getItems() || [];
    const summaryBox = document.querySelector('.cart-summary');
    if (!summaryBox) return;

    if (cart.length === 0) {
      summaryBox.style.display = "none";
      return;
    } else summaryBox.style.display = "";

    const unitFinalUSD = (it) => Number(it.unitPriceUSD ?? it.priceUSD ?? it.price ?? 0);
    const unitOriginalUSD = (it) => Number(it.unitPriceOriginalUSD ?? it.priceOldUSD ?? it.priceOld ?? it.msrp ?? unitFinalUSD(it));

    const subtotalUSD = cart.reduce((acc, it) => acc + unitFinalUSD(it) * (it.qty || 1), 0);
    const originalUSD = cart.reduce((acc, it) => acc + unitOriginalUSD(it) * (it.qty || 1), 0);
    const savingsUSD = Math.max(0, originalUSD - subtotalUSD);
    const envioUYU = subtotalUSD >= USD_FREE_SHIP_THRESHOLD ? 0 : UYU_SHIP_FLAT;
    const envioUSD = envioUYU / USD_RATE;
    const totalUSD = subtotalUSD + envioUSD;

    summaryBox.querySelectorAll('.cart-row, .summary-rows').forEach(n => n.remove());

    const rows = document.createElement('div');
    rows.className = 'summary-rows';
    summaryBox.prepend(rows);

    rows.insertAdjacentHTML('beforeend', `
      <div class="summary-row"><span class="label">Subtotal</span><span class="value">${fmt.format(subtotalUSD)}</span></div>
    `);

    if (savingsUSD >= 0.01) {
      rows.insertAdjacentHTML('beforeend', `
        <div class="summary-row saving"><span class="label">Ahorrás</span><span class="value"><small><s>${fmt.format(savingsUSD)}</s></small></span></div>
      `);
    }

    const isFreeShip = envioUYU === 0;

    rows.insertAdjacentHTML('beforeend', `
      <div class="summary-row row-shipping"><span class="label">Envío</span><span class="value ${isFreeShip ? 'is-free' : 'is-paid'}">${isFreeShip ? 'Gratis' : `+ UYU ${envioUYU}`}</span></div>
      <div class="summary-row total"><span class="label">Total</span><span class="value">${fmt.format(totalUSD)}</span></div>
    `);

    ensurePaymentStrip(summaryBox);
  }

  /* EMAILJS - ECOLIFE */

  const EMAILJS_SERVICE = "service_o901yzo";
  const TEMPLATE_ID_STORE = "template_2jobyzx";      // mail interno
  const TEMPLATE_ID_PENDING = "template_3t4k1j1";    // pago en proceso
  const TEMPLATE_ID_ABANDONED = "template_v9m0mtb";  // carrito abandonado
  const EMAILJS_USER = "ktIyEXjcCfhYjKZzI";

  if (typeof emailjs !== "undefined") emailjs.init(EMAILJS_USER);

  function buildCartRowsHTML(items) {
    return items.map(it => {
      const priceNew = Number(it.price) || 0;
      const priceOld = Number(it.priceOld || it.msrp || 0);
      const line = priceNew * (it.qty || 1);
      const img = it.thumbnail || "https://via.placeholder.com/60x60?text=IMG";
      const code = it.codigo || it.id || "-";

      const priceHTML = priceOld && priceOld > priceNew
        ? `<span style="color:#777;text-decoration:line-through;">USD ${priceOld.toLocaleString("es-UY")}</span><br><strong style="color:#222;">USD ${priceNew.toLocaleString("es-UY")}</strong>`
        : `<strong>USD ${priceNew.toLocaleString("es-UY")}</strong>`;

      return `
        <tr style="border-bottom:1px solid #ddd;">
          <td><img src="${img}" width="60" style="border-radius:6px;"></td>
          <td>${it.title || ""}</td>
          <td>${code}</td>
          <td>${it.qty}</td>
          <td>${priceHTML}</td>
          <td><strong>USD ${line.toLocaleString("es-UY")}</strong></td>
        </tr>
      `;
    }).join("");
  }

  function collectCheckoutData() {
    const CartAPI = window.EcoCart?.Cart;
    const items = CartAPI?.getItems() || [];
    const subtotalUSD = calcCartSubtotalUSD(items);
    const shippingUYU = subtotalUSD >= USD_FREE_SHIP_THRESHOLD ? 0 : UYU_SHIP_FLAT;
    const envioUSD = shippingUYU / USD_RATE;
    const totalUSD = subtotalUSD + envioUSD;

    return {
      customer: {
        name: $("#fact-nombre")?.value || "",
        email: $("#fact-email")?.value || "",
        phone: $("#fact-tel")?.value || "",
        rut: $("#fact-doc")?.value || ""
      },
      shipping: {
        address: $("#envio-direccion")?.value || "",
        city: $("#envio-ciudad")?.value || "",
        state: $("#envio-depto")?.value || "",
        zip: $("#envio-cp")?.value || ""
      },
      items,
      amounts: { subtotalUSD, shippingUYU, totalUSD }
    };
  }

  async function sendEmailToStore(payload) {
    const rows = buildCartRowsHTML(payload.items);

    const vars = {
      name: payload.customer.name,
      email: payload.customer.email,
      phone: payload.customer.phone,
      rut: payload.customer.rut,
      address: payload.shipping.address,
      city: payload.shipping.city,
      state: payload.shipping.state,
      zip: payload.shipping.zip,
      subtotalUSD: fmt.format(payload.amounts.subtotalUSD),
      shippingUYU: payload.amounts.shippingUYU === 0 ? "Gratis" : `UYU ${payload.amounts.shippingUYU}`,
      totalUSD: fmt.format(payload.amounts.totalUSD),
      itemsrows: rows
    };

    try {
      // --- 1️⃣ Envío interno (a EcoLife)
      await emailjs.send(EMAILJS_SERVICE, TEMPLATE_ID_STORE, vars);
      console.log("📩 Pedido enviado a EcoLife (interno)");

      // --- 2️⃣ Envío al cliente (pago en proceso)
      const clientVars = {
        name: payload.customer.name,
        email: payload.customer.email,
        subtotalUSD: fmt.format(payload.amounts.subtotalUSD),
        shippingUYU: payload.amounts.shippingUYU === 0 ? "Gratis" : `UYU ${payload.amounts.shippingUYU}`,
        totalUSD: fmt.format(payload.amounts.totalUSD),
        itemsrows: rows
      };

      await emailjs.send(EMAILJS_SERVICE, TEMPLATE_ID_PENDING, clientVars);
      console.log("✅ Confirmación enviada al cliente");

      // ⭐ 3️⃣ Programar recordatorio (carrito abandonado)
      setTimeout(() => {
        emailjs.send(EMAILJS_SERVICE, TEMPLATE_ID_ABANDONED, {
          name: payload.customer.name,
          email: payload.customer.email,
          totalUSD: fmt.format(payload.amounts.totalUSD),
          shippingUYU: payload.amounts.shippingUYU === 0 ? "Gratis" : `UYU ${payload.amounts.shippingUYU}`,
          itemsrows: rows
        })
        .then(() => console.log("⏳ Recordatorio enviado (carrito abandonado)"))
        .catch(err => console.error("Error recordatorio:", err));
      }, 60 * 60 * 1000); // 1 hora


      alert("✅ Pedido enviado correctamente. Te llegará un correo con el detalle.");
      window.EcoCart?.Cart.clear();

    } catch (err) {
      console.error("❌ Error al enviar el correo:", err);
      alert("⚠️ No se pudo enviar el correo del pedido.");
    }
  }

  $("#btn-confirm")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const payload = collectCheckoutData();
    await sendEmailToStore(payload);
  });
})();
