// js/product.js — usa data/descriptions.json para TODO lo extra
(async function () {
  // ---------- utils ----------
  const qs  = (s, r=document)=>r.querySelector(s);
  const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));
  // Mostrar precios en dólares (U$S)
  const fmt = n => (n!=null) ? 'U$S ' + Number(n).toLocaleString('es-UY') : '';

  // Markdown liviano: **negrita**, links, listas "- ", párrafos
  const mdInline = (s='') => String(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  const md = (t='') => {
    t = String(t || '').trim();
    if (!t) return '';
    const blocks = t.split(/\n{2,}/);
    return blocks.map(b=>{
      if (/^\s*-\s+/.test(b)) {
        const items = b.split(/\n/).filter(l=>/^\s*-\s+/.test(l))
                      .map(l=> l.replace(/^\s*-\s+/, '').trim())
                      .map(x=> `<li>${mdInline(x)}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${mdInline(b.replace(/\n+/g,' ').trim())}</p>`;
    }).join('');
  };

  const slugify = (s='') => s.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/\s+/g,'-');

  const fetchJSONwithFallback = async (paths) => {
    for (const p of paths) {
      try { const r = await fetch(p, { cache:'no-store' }); if (r.ok) return await r.json(); } catch {}
    }
    return null;
  };

  const escapeHTML = (s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const deepMerge = (base={}, extra={}) => {
    const out = { ...base };
    for (const [k,v] of Object.entries(extra)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  const getCandidateKeys = () => {
    const url  = new URL(location.href);
    const id   = url.searchParams.get('id');
    const sku  = url.searchParams.get('sku');
    const slug = url.searchParams.get('slug');
    const last = url.pathname.split('/').filter(Boolean).pop();
    return { raw: Array.from(new Set([id, sku, slug, last].filter(Boolean))) };
  };

  // ---------- datos ----------
  const products = await fetchJSONwithFallback(['/data/products.json','data/products.json','../data/products.json']);
  if (!products) return;

  const extrasMap = await fetchJSONwithFallback([
    '/data/descriptions.json','data/descriptions.json','../data/descriptions.json',
    '/data/description.json','data/description.json','../data/description.json'
  ]) || {};
  
  const list = Array.isArray(products) ? products : (products.products || []);
  const keys = getCandidateKeys();

  // localizar producto base
  const prod = list.find(p => {
    const pid   = String(p.id   || '').toLowerCase();
    const psku  = String(p.sku  || '').toLowerCase();
    const pslug = slugify(p.slug || p.title || p.id || '');
    if (keys.raw.some(k => k?.toLowerCase() === pid))  return true;
    if (psku && keys.raw.some(k => k?.toLowerCase() === psku)) return true;
    if (keys.raw.map(slugify).includes(pslug)) return true;
    if (keys.raw.map(slugify).includes(slugify(pid))) return true;
    return false;
  });
  if (!prod) return;

  // aplicar extras por id/sku/slug
  const slug = slugify(prod.slug || prod.title || prod.id || '');
  const extra = extrasMap[prod.id] || (prod.sku && extrasMap[prod.sku]) || extrasMap[slug] || {};
  const item  = deepMerge(prod, extra);

  // ---------- FUNCIONES DE OFERTAS (ficha + carrito) ----------
  async function applyOffersToItem(baseItem){
    let final = { ...baseItem, onSale:false, priceOld:null };
    try {
      const r = await fetch('data/offers.json', { cache:'no-store' });
      if (!r.ok) return final;
      const rules = await r.json();

      if (typeof window.applyOffers === 'function') {
        // Misma API que en tienda: applyOffers(listaProductos, reglas)
        const arr = window.applyOffers([baseItem], rules) || [];
        if (arr[0]) {
          final = {
            ...baseItem,
            price: Number(arr[0].price ?? baseItem.price ?? 0),
            onSale: !!arr[0].onSale,
            priceOld: arr[0].priceOld != null ? Number(arr[0].priceOld) : null,
            offerRule: arr[0].offerRule
          };
        }
      } else {
        // Fallback simple: soporta {id:price} o [{id,price}]
        let map = {};
        if (Array.isArray(rules)) {
          for (const it of rules) if (it && it.id != null) map[String(it.id)] = it.price;
        } else if (rules && typeof rules === 'object') {
          map = rules;
        }
        const newPrice = map[baseItem.id];
        if (newPrice != null && !isNaN(newPrice)) {
          final = {
            ...baseItem,
            price: Number(newPrice),
            onSale: true,
            priceOld: Number(baseItem.price || 0)
          };
        }
      }
    } catch (e) {
      console.warn('No se pudieron aplicar ofertas en product.js:', e);
    }
    return final;
  }

  function ensureSibling(id, className, afterEl){
    let el = document.getElementById(id);
    if (!el){
      el = document.createElement('span');
      el.id = id;
      if (className) el.className = className;
      if (afterEl && afterEl.parentNode){
        afterEl.insertAdjacentText('afterend', ' ');
        afterEl.insertAdjacentElement('afterend', el);
      }
    }
    return el;
  }

  // ---------- cabecera ----------
  const title = item.title || 'Producto';
  const brand = item.brand || '';
  qs('#bc-product') && (qs('#bc-product').textContent = title);
  qs('#p-title')    && (qs('#p-title').textContent    = title);
  qs('#p-brand')    && (qs('#p-brand').textContent    = brand);
  // (No seteamos #p-price acá; lo hacemos luego de aplicar ofertas)

  // ---------- galería ----------
// ---------- galería (thumbnail SIEMPRE primero) ----------
injectThumbCSS();

// 1) Primera imagen SIEMPRE la thumbnail
let mainImage = item.thumbnail;

// 2) Galería completa: thumbnail primero + imágenes extra
let galleryImages = [
  item.thumbnail,
  ...(Array.isArray(item.images) ? item.images : [])
].filter(Boolean);

// Normalización de URLs
galleryImages = galleryImages.map(g =>
  typeof g === 'string' ? g : (g?.src || g?.url || g?.image || g?.path || '')
).filter(Boolean);

// Mostrar imagen principal
const main = qs('#p-image');
if (main) {
  main.src = mainImage;
  main.alt = title;
}

// Miniaturas
const thumbs = qs('#p-thumbs');
if (thumbs) {
  thumbs.innerHTML = '';
  galleryImages.forEach((src, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb' + (i === 0 ? ' is-active' : '');
    b.setAttribute('aria-label', `Imagen ${i + 1}`);
    b.innerHTML = `<img src="${src}" alt="" loading="lazy" decoding="async" width="96" height="96">`;
    b.addEventListener('click', () => {
      main.src = src;
      qsa('.p-thumbs .thumb', thumbs).forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });
    thumbs.appendChild(b);
  });
}


  // ---------- bullets (solo si vienen en descriptions.json) ----------
  (function renderBullets(){
    const ul = qs('#p-bullets');
    if (!ul) return;
    const bullets = Array.isArray(item.features) ? item.features.filter(Boolean) : [];
    if (!bullets.length) {
      (ul.closest('.p-meta') || ul).style.display = 'none';
      return;
    }
    ul.innerHTML = '';
    bullets.slice(0,8).forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    (ul.closest('.p-meta') || ul).style.display = '';
  })();

  // ---------- pestaña: Descripción (OCULTA) ----------
  const descPane = qs('#tab-desc');
  const descBtn  = qs('.tab[data-tab="desc"]') || qs('.p-tabs [data-tab="desc"]');
  if (descPane) descPane.hidden = true;
  if (descBtn)  descBtn.hidden  = true;

  // ---------- pestaña: Especificaciones ----------
  const specsPane = qs('#tab-specs');
  if (specsPane) {
    const rawDesc = String(item.desc_md || item.desc_html || '').trim();
    let heroTitle = '';
    let restMD = '';
    if (rawDesc) {
      const m = rawDesc.match(/\*\*(.+?)\*\*/);
      heroTitle = m ? m[1].trim() : '';
      restMD = m ? rawDesc.replace(m[0], '').trim() : rawDesc;
    }

    const leadHTML = rawDesc ? `
      ${heroTitle ? `<div class="desc-hero"><div class="desc-hero__title">${escapeHTML(heroTitle)}</div></div>` : ''}
      ${restMD ? `<div class="specs-body">${md(restMD)}</div>` : ''}
    ` : '';

    const specs = item.specs || {};
    const entries = Array.isArray(specs) ? specs.map(s=>[s.k,s.v]) : Object.entries(specs);
    const tableHTML = entries.length
      ? `<table class="specs"><tbody>${
          entries.map(([k,v])=>`<tr><th>${escapeHTML(k)}</th><td>${escapeHTML(v)}</td></tr>`).join('')
        }</tbody></table>`
      : '';

    specsPane.innerHTML = `
      ${leadHTML}
      ${tableHTML}
    `;
    injectDescHeroCSS();
  }

  // ---------- pestaña: Envío y garantía ----------
  const shipPane = qs('#tab-ship');
  const shipBtn  = qs('.tab[data-tab="ship"]') || qs('.p-tabs [data-tab="ship"]');
  if (shipPane && shipBtn) {
    const shippingHTML = (item.shipping_html && item.shipping_html.trim())
                      || (item.shipping_md   ? md(item.shipping_md)   : '');
    const warrantyHTML = (item.warranty_html && item.warranty_html.trim())
                      || (item.warranty_md   ? md(item.warranty_md)   : '');

    const visible = Boolean(shippingHTML || warrantyHTML);
    shipBtn.hidden  = !visible;
    shipPane.hidden = !visible;

    if (visible) {
      shipPane.innerHTML = `
        <div class="ship-grid">
          ${shippingHTML ? `
            <article class="card">
              <h3>Envío</h3>
              ${shippingHTML}
            </article>` : ''}

          ${warrantyHTML ? `
            <article class="card">
              <h3>Garantía</h3>
              ${warrantyHTML}
            </article>` : ''}
        </div>
      `;
      injectShipCSS();
    }
  }

  // ---------- mover tabs abajo (siempre) ----------
  injectBottomDetailsCSS();
  moveDetailsToBottom();

  // ---------- tabs: activar primera visible ----------
  (function bindTabs(){
    const btns = qsa('.tab').filter(b => !b.hidden);
    const panes = { desc: qs('#tab-desc'), specs: qs('#tab-specs'), ship: qs('#tab-ship') };
    const activate = (tabKey) => {
      btns.forEach(x=>x.classList.remove('is-active'));
      Object.values(panes).forEach(p=>p && (p.classList?.remove('is-active'), p.hidden = true));
      const btn = btns.find(b=>b.dataset.tab===tabKey) || btns[0];
      if (btn) { btn.classList.add('is-active'); const pane = panes[btn.dataset.tab]; if (pane) { pane.hidden=false; pane.classList?.add('is-active'); } }
    };
    btns.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.tab)));
    if (btns.length) activate(btns[0].dataset.tab);
  })();

  // ---------- Mercado Pago + Botón oficial Samsung ----------
  injectMPCSS();
  renderMPInfo();
  injectOfficialBtnCSS();
  injectRightCSS();
  await renderOfficialButton(item);

  // ======= APLICAR OFERTAS Y MOSTRAR PRECIOS EN FICHA =======
  const priceEl = document.getElementById('p-price');

  // 1) Calcular precio final con ofertas
  const final = await applyOffersToItem(item);
  const priceNow = Number(final.price ?? item.price ?? 0);
  const priceOld = (final.onSale && final.priceOld != null) ? Number(final.priceOld) : null;

  // 2) Pintar SIEMPRE nuevo precio y, si hay oferta, tachado + badge
  if (priceEl) priceEl.textContent = fmt(priceNow);

  const oldEl   = ensureSibling('p-old',   'old-price', priceEl);
  const badgeEl = ensureSibling('p-badge', 'badge',     oldEl);

  if (priceOld && priceOld > priceNow){
    oldEl.hidden   = false;
    oldEl.textContent = fmt(priceOld);
    const pct = Math.max(0, Math.round((1 - (priceNow / priceOld)) * 100));
    badgeEl.hidden = false;
    badgeEl.textContent = `-${pct}%`;
  } else {
    if (oldEl)   oldEl.hidden = true;
    if (badgeEl) badgeEl.hidden = true;
  }

  // 3) Guardar valores para carrito
  window.__productFinalPrice = priceNow;
  window.__productPriceOld   = priceOld;
  window.__productOnSale     = !!(priceOld && priceOld > priceNow);

  // ===== stepper ficha
  const qtyInput = document.getElementById('p-qty-input');
  const qtyDec   = document.getElementById('p-qty-dec');
  const qtyInc   = document.getElementById('p-qty-inc');
  const qtyHint  = document.getElementById('p-qty-hint');

  const clamp = (n) => Math.max(1, Math.min(5, Number(n) || 1));
  const setQty = (n) => { if (qtyInput) qtyInput.value = clamp(n); if (qtyHint) qtyHint.textContent = ''; };

  qtyDec?.addEventListener('click', () => setQty(Number(qtyInput.value) - 1));
  qtyInc?.addEventListener('click', () => setQty(Number(qtyInput.value) + 1));
  qtyInput?.addEventListener('input', () => setQty(qtyInput.value));

  // ===== Comprar: agrega al carrito SIN redirigir =====
  // botón de agregar
const addBtn = qs('#btn-add');
const stockFlag = (item.stock || '').toString().trim().toLowerCase();

if (addBtn) {
  // si NO hay stock
  if (stockFlag === 'no') {
    addBtn.disabled = true;
    addBtn.textContent = 'Sin stock';
    addBtn.classList.add('is-out-of-stock');
  } else {
    // hay stock: dejamos el comportamiento normal
    qs('#btn-add')?.addEventListener('click', () => {
      const addBtn = qs('#btn-add');
      addBtn.disabled = true;

      const qtySel = clamp(qtyInput?.value);

      // Tomamos imagen principal o thumbnail
      const image =
        (Array.isArray(item.images) && item.images[0]) ||
        item.thumbnail ||
        '';

      // Normalizamos payload al formato de Cart.addItem (con oferta incluida)
      const payload = {
        id: String(item.id || '').trim(),
        title: String(item.title || ''),
        price: Number(window.__productFinalPrice ?? item.price ?? 0),
        priceOld: Number(window.__productPriceOld ?? 0) || null,
        onSale: !!window.__productOnSale,
        thumbnail: image
      };

      const CartAPI = window.EcoCart?.Cart;
      if (CartAPI?.addItem) {
        CartAPI.addItem(payload, qtySel);
      } else {
        console.warn(
          'EcoCart.Cart no disponible. ¿Cargaste /js/cart.js antes que product.js?'
        );
      }

      // Feedback sutil sin mover layout
      const originalText = addBtn.textContent;
      addBtn.textContent = 'Agregado ✓';
      setTimeout(() => {
        addBtn.textContent = originalText;
        addBtn.disabled = false;
      }, 1000);
    });
  }
}

renderRelatedProducts(item);

  // ---------- trust strip ----------
  renderTrustStrip();

  // ---------- mostrar layout ----------
  qs('#product-layout') && (qs('#product-layout').hidden = false);

  // ---------- helpers de UI ----------
  function renderTrustStrip() {
    const host = qs('#p-simple') || qs('#p-premium') || document.body;
    if (!host) return;
    const html = `
      <section class="trust wrap" aria-label="Compromisos de EcoLife">
        <div class="trust__item">
          <span class="trust__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" role="img" focusable="false">
              <circle cx="12" cy="12" r="10" fill="#E8F0FF"></circle>
              <path d="M9.2 12.6l-1.9-1.9-1.3 1.3 3.2 3.2 7-7-1.3-1.3-5.7 5.7z" fill="#3B82F6"></path>
            </svg>
          </span>
          <h3>100% Original</h3>
          <p>Todos nuestros productos vienen sellados y en su caja original.</p>
        </div>
        <div class="trust__item">
          <span class="trust__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" role="img" focusable="false">
              <circle cx="12" cy="12" r="10" fill="#E8F0FF"></circle>
              <path d="M12 6v6l4 2" stroke="#3B82F6" stroke-width="2" fill="none" stroke-linecap="round"></path>
            </svg>
          </span>
          <h3>Cambios en 10 días</h3>
          <p>Te aseguramos un cambio seguro ante defectos de fábrica.</p>
        </div>
        <div class="trust__item">
          <span class="trust__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" role="img" focusable="false">
              <path d="M12 3l7 3v6c0 5-3.5 7.7-7 9-3.5-1.3-7-4-7-9V6l7-3z" fill="#E8F0FF"></path>
              <path d="M12 3l7 3v6c0 5-3.5 7.7-7 9V3z" fill="#3B82F6" opacity=".25"></path>
            </svg>
          </span>
          <h3>Garantía oficial</h3>
          <p>Respaldo del fabricante. Hasta 2 años en productos seleccionados.</p>
        </div>
      </section>
    `;
    host.insertAdjacentHTML('beforeend', html);
  }

  function injectShipCSS() {
    if (document.getElementById('ship-css')) return;
    const style = document.createElement('style');
    style.id = 'ship-css';
    style.textContent = `
      .ship-grid{ display:grid; gap:16px; }
      @media (min-width: 900px){ .ship-grid{ grid-template-columns: 1fr 1fr; } }
      .ship-grid .card{ background:#fff; border:1px solid #e9edf3; border-radius:14px; padding:18px 20px; box-shadow: 0 8px 30px rgba(0,0,0,.04); }
      .ship-grid .card h3{ margin:0 0 10px; font-size:1.15rem; }
      .ship-grid .card p{ margin:8px 0; }
      .ship-grid .card ul{ margin:8px 0 0 1.2rem; padding:0; }
      .ship-grid .card li{ margin:6px 0; }
    `;
    document.head.appendChild(style);
  }

  function injectThumbCSS(){
    if (document.getElementById('thumb-css')) return;
    const style = document.createElement('style');
    style.id = 'thumb-css';
    style.textContent = `
      .p-thumbs{ display:grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap:10px; }
      .p-thumbs .thumb{ background:#fff; border:1px solid #E5EAF2; border-radius:12px; padding:6px; transition:border-color .2s, box-shadow .2s, transform .1s; }
      .p-thumbs .thumb:hover{ transform:translateY(-1px); }
      .p-thumbs .thumb img{ width:100%; height:auto; display:block; }
      .p-thumbs .thumb.is-active, .p-thumbs .thumb:focus-visible{ border-color:#1428A0; box-shadow:0 0 0 3px rgba(20,40,160,.12); outline:none; }
    `;
    document.head.appendChild(style);
  }

  function injectBottomDetailsCSS(){
    if (document.getElementById('bottom-details-css')) return;
    const style = document.createElement('style');
    style.id = 'bottom-details-css';
    style.textContent = `
      .p-details{ margin-top:24px; padding-top:12px; border-top:1px solid #E9EDF3; }
      .p-details .p-tabs{ margin-bottom:10px; }
    `;
    document.head.appendChild(style);
  }
  function moveDetailsToBottom(){
    const layout = qs('.product-layout');
    const tabs   = qs('.p-tabs');
    const panels = qs('.p-panels');
    if (!layout || !tabs || !panels) return;
    let dest = qs('.p-details');
    if (!dest) {
      dest = document.createElement('section');
      dest.className = 'p-details';
      layout.insertAdjacentElement('afterend', dest);
    }
    dest.appendChild(tabs);
    dest.appendChild(panels);
  }

  function injectDescHeroCSS(){
    const id = 'desc-hero-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .desc-hero{
        margin: 0 0 8px;
        padding: 0;
        border: none;
        background: transparent;
        box-shadow: none;
        opacity: 0;
        transform: translateY(10px);
        animation: descFadeUp .45s ease-out .03s forwards;
      }
      .desc-hero__title{
        font-weight: 900;
        line-height: 1.18;
        font-size: clamp(1.3rem, 2.8vw, 1.9rem);
        letter-spacing: .2px;
        background: linear-gradient(135deg, #1428A0 0%, #00C853 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .specs-body{
        margin: 8px 0 14px;
        opacity: 0;
        transform: translateY(8px);
        animation: descFadeUp .5s ease-out .08s forwards;
      }
      .specs-body p{ margin: 6px 0; }
      .specs-body ul{ margin: 8px 0 0 1.15rem; }
      .specs-body li{ margin: 4px 0; }
      @keyframes descFadeUp{ to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }

  function injectOfficialBtnCSS() {
    if (document.getElementById('official-btn-css')) return;
    const style = document.createElement('style');
    style.id = 'official-btn-css';
    style.textContent = `
      .page-btn--official{
        --official-bg:#0F1E4D;
        --brd-w:3px;
        --brd-grad:linear-gradient(135deg, #1428A0 0%, #00C853 100%);
        position:relative; display:inline-flex; align-items:center; gap:.65rem;
        padding:.9rem 1.1rem; border-radius:14px;
        border:var(--brd-w) solid transparent;
        color:#0F1E4D; text-decoration:none; font-weight:700; letter-spacing:.2px; overflow:hidden;
        transition:transform .15s ease, box-shadow .2s ease, background .2s ease, color .2s ease, border-color .2s ease;
        background:
          linear-gradient(#fff, #fff) padding-box,
          var(--brd-grad) border-box;
        box-shadow:0 4px 14px rgba(2,6,23,.06);
      }
      .page-btn--official:not(.is-outline){
        color:#fff;
        background:
          linear-gradient(var(--official-bg), var(--official-bg)) padding-box,
          var(--brd-grad) border-box;
        box-shadow:0 6px 16px rgba(15,30,77,.25);
      }
      .page-btn--official .logo{ display:grid; place-items:center; min-width:90px; }
      .page-btn--official .logo img{ display:block; height:16px; width:auto; }
      .page-btn--official .logo .txtlogo{ font-weight:800; letter-spacing:2px; font-size:14px; color:currentColor; }
      .page-btn--official .txt{ line-height:1.05; }
      .page-btn--official .txt small{ display:block; font-weight:450; font-size:.74rem; opacity:.85; }
      .page-btn--official .arrow{ margin-left:.15rem; display:inline-block; transform:translateX(0); animation:arrow-move 1.15s ease-in-out infinite; }
      .page-btn--official::after{
        content:''; position:absolute; inset:-2px; border-radius:16px;
        background:linear-gradient(120deg, transparent 0 40%, rgba(255,255,255,.35) 50%, transparent 60% 100%);
        transform:translateX(-120%); animation:shine 2.6s linear infinite; pointer-events:none;
      }
      .page-btn--official:hover{ transform:translateY(-1px); box-shadow:0 8px 22px rgba(2,6,23,.12); }
      .page-btn--official:not(.is-outline):hover{ box-shadow:0 8px 22px rgba(15,30,77,.35); }
      .page-btn--official.is-pulsing{ animation:pulse 2.4s ease-in-out infinite; }
      @keyframes arrow-move{ 0%{transform:translateX(0)} 50%{transform:translateX(6px)} 100%{transform:translateX(0)} }
      @keyframes shine{ to{ transform:translateX(120%); } }
      @keyframes pulse{ 0%,100%{ box-shadow:0 6px 16px rgba(2,6,23,.06); } 50%{ box-shadow:0 10px 26px rgba(2,6,23,.12); } }
    `;
    document.head.appendChild(style);
  }

  function injectRightCSS() {
    const id = 'official-right-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .p-official{
        display:block;
        width:100%;
        margin:12px 0 0;
        text-align:left;
        margin-left: var(--official-left-offset, 0);
      }
      .p-official .page-btn--official{ margin:0; }
    `;
    document.head.appendChild(style);
  }

  async function renderOfficialButton(prod) {
    const linkMap = await fetchJSONwithFallback(['/data/samsung_links.json','data/samsung_links.json','../data/samsung_links.json']) || {};
    const url = (prod.official_url || prod.brand_info_url || linkMap[prod.id] || linkMap[prod.sku] || '').trim();
    if (!url) return;

    const btn = document.createElement('a');
    btn.href = url; btn.target = '_blank'; btn.rel = 'noopener noreferrer';
    btn.className = 'page-btn page-btn--official is-outline is-pulsing';
    btn.setAttribute('aria-label','Abrir información oficial del producto en una pestaña nueva');
    btn.innerHTML = `
      <span class="logo" aria-hidden="true">
        <img src="/img/brands/samsung-wordmark.svg" alt="">
      </span>
      <span class="txt">
        Tocá aquí y conocé más<br>
        <small>sobre el producto deslizando hacia abajo</small>
      </span>
      <span class="arrow" aria-hidden="true">➜</span>
    `;
    btn.querySelector('.logo img')?.addEventListener('error', (e) => {
      const fallback = document.createElement('span');
      fallback.className = 'txtlogo';
      fallback.textContent = 'SAMSUNG';
      e.currentTarget.replaceWith(fallback);
    });

    const info = document.querySelector('.p-info');
    const mp   = info?.querySelector('.p-mp');
    let host   = info?.querySelector('.p-official');

    if (!host) {
      host = document.createElement('div');
      host.className = 'p-official';
      if (mp) {
        mp.insertAdjacentElement('afterend', host);
      } else {
        const cta = info?.querySelector('.p-cta');
        (cta || info).insertAdjacentElement('afterend', host);
      }
    } else {
      host.innerHTML = '';
    }

    if (info && window.matchMedia('(min-width: 721px)').matches) {
      const padLeft = parseFloat(getComputedStyle(info).paddingLeft || '0');
      const extra   = 8;
      host.style.setProperty('--official-left-offset', `-${padLeft + extra}px`);
    } else {
      host.style.removeProperty('--official-left-offset');
    }

    host.appendChild(btn);
  }

function injectMPCSS(){
  if (document.getElementById('mp-css')) return;

  const style = document.createElement('style');
  style.id = 'mp-css';
  style.textContent = `
    /* Contenedor del banner de pago */
    .p-mp{
      margin: 18px 0 0;      /* más aire arriba */
      padding: 0;
      border: none;
      background: transparent;
      text-align: left;  
    }

    /* Imagen del banner Handy */
    .p-mp-img{
      display: block;
      width: 100%;
      max-width: 400px;   /* <-- MÁS GRANDE (antes 240px) */
      height: auto;
      border-radius: 10px;
      margin: 0;
      opacity: 0.95;
    }

    /* Espacio entre el banner y el botón Samsung */
    .p-official{
      margin-top: 22px !important;  /* <-- aire extra */
    }

    /* Responsive en celular */
    @media (max-width: 600px){
      .p-mp-img{
        max-width: 80%;   /* poquito más grande en móvil también */
        border-radius: 8px;
      }

      .p-official{
        margin-top: 18px !important;
      }
    }
  `;
  document.head.appendChild(style);
}




 function renderMPInfo(){
  const info = qs('.p-info');
  if (!info) return;

  let box = info.querySelector('.p-mp');
  if (!box) {
    box = document.createElement('div');
    box.className = 'p-mp';
    const cta = info.querySelector('.p-cta') || info.firstElementChild;
    (cta || info).insertAdjacentElement('afterend', box);
  }

  // Solo la imagen, el estilo lo manejamos por CSS para que sea responsive
  box.innerHTML = `
    <img src="img/pagoseguro.png" alt="Pago seguro con Handy" class="p-mp-img">
  `;
}

// Mezclador para aleatorizar productos
function shuffleArray(arr) {
  return arr
    .map(x => ({ val: x, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(x => x.val);
}
// Productos relacionados (aleatorios)
async function renderRelatedProducts(current) {
  const wrapper = document.getElementById("related-wrapper");
  const container = document.getElementById("related-carousel");
  if (!wrapper || !container) return;

  const currentId = String(current.id || "").trim();

  // Todos los productos excepto el actual
  let pool = list.filter(p => String(p.id).trim() !== currentId);

  // Mezclar aleatoriamente
  pool = shuffleArray(pool);

  // Elegir 10 productos random
  const finalList = pool.slice(0, 10);

  container.innerHTML = "";

  for (const base of finalList) {
    const final = await applyOffersToItem(base);
    const priceNow = Number(final.price ?? base.price ?? 0);
    const priceOld = final.onSale ? final.priceOld : null;

    const card = document.createElement("article");
    card.className = "related-card";

    const thumb =
      (Array.isArray(base.images) && base.images[0]) ||
      base.thumbnail ||
      "img/products/placeholder.png";

    card.innerHTML = `
    ${
  priceOld
    ? `<span class="rel-badge">-${Math.round((1 - priceNow / priceOld) * 100)}%</span>`
    : `<span class="rel-badge" style="opacity:0">0%</span>` /* mantiene altura fija */
}

      <img src="${thumb}" alt="${escapeHTML(base.title || "")}" loading="lazy">
      <h4>${escapeHTML(base.title || "")}</h4>
      <div class="rel-price">U$S ${priceNow}</div>
      ${
        priceOld
          ? `<span class="rel-old">U$S ${priceOld}</span>`
          : ""
      }
      <a class="rel-link" href="product.html?id=${encodeURIComponent(base.id)}">Ver producto</a>
    `;

    container.appendChild(card);
  }

  wrapper.hidden = false;
}

})();
