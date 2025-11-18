// js/tienda.decor.js
(function(){
  // ========= utils =========
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const slug = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,'-');
  const fmtUSD = n => 'U$S ' + Number(n||0).toLocaleString('es-UY');
  const pctOff = (oldP, newP) => Math.max(1, Math.round(100 - (Number(newP)*100/Number(oldP))));

  // ========= HERO de portada (opcional) =========
  const slides = [
    {
      title: "Viví el cine en casa",
      subtitle: "Colores más reales y sonido envolvente",
      cta: { label: "Ver Smart TV", url: "/tienda.html?cat=televisores" },
      img: { desktop: "/img/hero/hero-tv-desktop.jpg", mobile: "/img/hero/hero-tv-mobile.jpg", alt: "Smart TV mostrando colores vivos" }
    },
    {
      title: "Frescura que dura",
      subtitle: "No Frost y eficiencia para tu día a día",
      cta: { label: "Ver heladeras", url: "/tienda.html?cat=electrodomesticos&subcat=refrigeradores" },
      img: { desktop: "/img/hero/hero-heladeras-desktop.jpg", mobile: "/img/hero/hero-heladeras-mobile.jpg", alt: "Heladera No Frost de gran capacidad" }
    },
    {
      title: "Cociná más en menos tiempo",
      subtitle: "Hornos, cocinas y anafes que cuidan tu energía",
      cta: { label: "Ver Cocina", url: "/tienda.html?cat=electrodomesticos&subcat=hornos" },
      img: { desktop: "/img/hero/hero-cocina-desktop.jpg", mobile: "/img/hero/hero-cocina-mobile.jpg", alt: "Horno y anafe en cocina moderna" }
    }
  ];

  function renderHero(){
    const track = $('#hero-track');
    const dots  = $('#hero-dots');
    const viewport = $('.hero-viewport');
    if (!track || !dots || !viewport) return;

    track.innerHTML = slides.map((s, i) => `
      <li class="hero-slide" role="group" aria-roledescription="slide" aria-label="${i+1} de ${slides.length}">
        <picture>
          <source media="(max-width: 720px)" srcset="${s.img.mobile}">
          <img src="${s.img.desktop}" alt="${s.img.alt}" loading="${i===0?'eager':'lazy'}">
        </picture>
        <div class="hero-content">
          <h3>${s.title}</h3>
          <p>${s.subtitle}</p>
          <a class="page-btn" href="${s.cta.url}">${s.cta.label}</a>
        </div>
      </li>
    `).join('');

    dots.innerHTML = slides.map((_, i) => `
      <button class="hero-dot" role="tab" aria-label="Ir a slide ${i+1}" aria-selected="${i===0?'true':'false'}" data-i="${i}"></button>
    `).join('');

    let idx = 0, max = slides.length, timer = null, isHover = false;
    const prev = $('.hero-prev');
    const next = $('.hero-next');

    function go(n){
      idx = (n + max) % max;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.querySelectorAll('.hero-dot').forEach((d,i)=> d.setAttribute('aria-selected', i===idx ? 'true' : 'false'));
    }
    function auto(){
      clearTimeout(timer);
      timer = setTimeout(()=>{ if(!isHover){ go(idx+1); } auto(); }, 4800);
    }

    dots.addEventListener('click', (e)=>{
      const b = e.target.closest('.hero-dot'); if(!b) return;
      go(Number(b.dataset.i||0));
    });
    prev?.addEventListener('click', ()=> go(idx-1));
    next?.addEventListener('click', ()=> go(idx+1));
    viewport.addEventListener('mouseenter', ()=>{ isHover = true; });
    viewport.addEventListener('mouseleave', ()=>{ isHover = false; });

    go(0); auto();
  }

  // ========= Animación reveal (opcional) =========
  function mountReveal(){
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(el => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el=>io.observe(el));
  }

  // ========= Catálogo =========
  let CATALOG = null;
  async function loadProducts(){
    if (CATALOG) return CATALOG;
    const r = await fetch('/data/products.json', { cache:'no-store' });
    if (!r.ok) return [];
    const json = await r.json();
    const base = Array.isArray(json) ? json : (json.products || []);
    CATALOG = base.map(p=>{
      const image = p.thumbnail || (Array.isArray(p.images)&&p.images[0]) || p.image || '/img/products/placeholder.png';
      return {
        id: p.id,
        title: p.title || '',
        brand: p.brand || '',
        category: p.category || '',
        subcategory: p.subcategory || '',
        subsubcategory: p.subsubcategory || '',
        price: Number(p.price!=null ? p.price : 0),
        image,
        thumbnail: p.thumbnail || null,
        images: Array.isArray(p.images) ? p.images : [],
        rank: Number(p.rank != null ? p.rank : 999),
        _cat: slug(p.category),
        _sub: slug(p.subcategory),
        _subsub: slug(p.subsubcategory)
      };
    });
    return CATALOG;
  }

  // ========= Ofertas (vía offers.js si está) =========
  let OFFER_RULES = null;
  async function loadOffers(){
    if (OFFER_RULES) return OFFER_RULES;
    try{
      const r = await fetch('/data/offers.json', { cache:'no-store' });
      OFFER_RULES = r.ok ? await r.json() : [];
    }catch(e){
      OFFER_RULES = [];
    }
    return OFFER_RULES;
  }
  async function withOffers(items){
    const rules = await loadOffers();
    if (typeof window.applyOffers === 'function'){
      try{
        return window.applyOffers(items, rules) || items;
      }catch(e){
        console.warn('applyOffers falló, sigo sin aplicar', e);
        return items;
      }
    }
    return items;
  }

  // ========= Tarjeta compacta =========
  function cardHTML(p){
    const safeTitle = (p.title||'').replace(/"/g,'&quot;');
    const sizes = "(max-width:600px) 42vw, (max-width:1024px) 30vw, 320px";
    const showSale = !!p.onSale && p.priceOld && p.price < p.priceOld;
    const badge = showSale ? `<span class="badge-off">-${pctOff(p.priceOld, p.price)}%</span>` : '';
    const old   = showSale ? `<span class="price-old">${fmtUSD(p.priceOld)}</span>` : '';
    return `
<li class="product-card">
  <figure>
    <img src="${p.image}" alt="${safeTitle}"
         loading="lazy" decoding="async" fetchpriority="low"
         width="320" height="400" sizes="${sizes}"
         onerror="if(!this._tried){this._tried=1;this.src='/img/products/placeholder.png'}">
    ${badge}
  </figure>
  <div class="product-title">${p.title||''}</div>
  <div class="product-meta">${p.brand||''}</div>
  <div class="product-price">
    ${old}<span>${fmtUSD(p.price)}</span>
  </div>
  <div class="product-actions">
    <a class="page-btn buy-link" href="product.html?id=${encodeURIComponent(p.id)}"
       aria-label="Comprar ${safeTitle}">Ver producto</a>
  </div>
</li>`;
  }

  // ========= Reubicar badge debajo del título (derecha) =========
  function moveBadges(scope){
    (scope || document).querySelectorAll('.product-card').forEach(card=>{
      const title = card.querySelector('.product-title');
      const badge = card.querySelector('.badge-off');
      if (title && badge && !title.contains(badge)) {
        title.appendChild(badge);
      }
    });
  }

  // ========= Carrusel de sección =========
  function mountCarousel(section){
    const track = section.querySelector('.carousel__track');
    const prev  = section.querySelector('.carousel__btn--prev');
    const next  = section.querySelector('.carousel__btn--next');
    if (!track) return;

    const step = ()=> track.clientWidth * 0.9;
    prev?.addEventListener('click', ()=> track.scrollBy({left: -step(), behavior:'smooth'}));
    next?.addEventListener('click', ()=> track.scrollBy({left:  step(), behavior:'smooth'}));
  }

  // ========= Botones Comprar (EcoCart.Cart) =========
  function bindBuyButtons(scope=document){
    scope.addEventListener('click', (e)=>{
      const btn = e.target.closest('.add-btn'); if (!btn) return;
      const payload = {
        id: String(btn.dataset.id||'').trim(),
        title: btn.dataset.title || '',
        price: Number(btn.dataset.price||0),
        thumbnail: btn.dataset.thumb || ''
      };
      const API = window.EcoCart && window.EcoCart.Cart;
      if (API && typeof API.addItem === 'function') {
        API.addItem(payload, 1);
        const prev = btn.textContent; btn.disabled = true; btn.textContent = 'Agregado ✓';
        setTimeout(()=>{ btn.disabled=false; btn.textContent = prev; }, 900);
      } else {
        console.warn('EcoCart.Cart no disponible');
      }
    }, false);
  }

  // ========= Rellenar carruseles =========
  async function renderSectionCarousels(){
    if (document.body.classList.contains('is-grid')) return;

    const catalog  = await loadProducts();
    const sections = $$('#sections .section');

    const byRankTitle = (a,b)=> (a.rank - b.rank) || a.title.localeCompare(b.title);
    const blob = (p)=> `${p.title} ${p.brand} ${p.category} ${p.subcategory} ${p.subsubcategory}`.toLowerCase();

    for (const sec of sections){
      const track = sec.querySelector('.carousel__track');
      if (!track) continue;

      // --- CLIMATIZACIÓN ---
      if (sec.id === 'clima') {
        const LIMIT = 12;
        const text = (p)=> `${p.title} ${p.brand} ${p.category} ${p.subcategory} ${p.subsubcategory}`.toLowerCase();

        const isWasher = (p) => /(lavarrop|lavadora|lava\s*secar|lavasecar)/.test(text(p));
        const isAirCond = (p) => (
          /\baire\s*(acondicionad|acondicionado)\b/.test(text(p)) ||
          /\bsplit\b/.test(text(p)) ||
          /\bbtu\b/.test(text(p)) ||
          /\b(12000|18000|24000)\b/.test(text(p))
        );
        const isWaterHeaterSlug = (p) =>
          p._sub === 'termotanque' || p._subsub === 'termotanque' || p._cat === 'termotanques';
        const isWaterHeaterText = (p) =>
          /(termotanque|termof[oó]n|calef[oó]n|calentador\s+de\s+agua)/.test(text(p));
        const isWaterHeater = (p) => isWaterHeaterSlug(p) || isWaterHeaterText(p);

        let items = catalog
          .filter(p => !isWasher(p) && (isAirCond(p) || isWaterHeater(p)))
          .sort(byRankTitle)
          .slice(0, LIMIT);

        items = await withOffers(items);

        track.innerHTML = items.map(cardHTML).join('');
        moveBadges(sec);
        mountCarousel(sec);
        continue;
      }

      // --- TV & Audio ---
      if (sec.id === 'tv-audio') {
        const LIMIT = 12;
        const wantSoundbars = 2;

        const taken = new Set();
        const soundbars = catalog
          .filter(p => /soundbar|barra/.test(blob(p)))
          .sort(byRankTitle)
          .slice(0, wantSoundbars);
        soundbars.forEach(p=>taken.add(p.id));

        const neoQLED = catalog
          .filter(p => !taken.has(p.id) && /neo.?qled/.test(blob(p)))
          .sort(byRankTitle);
        neoQLED.forEach(p=>taken.add(p.id));

        const qledOled = catalog
          .filter(p => !taken.has(p.id) && /(qled|oled)/.test(blob(p)))
          .sort(byRankTitle);
        qledOled.forEach(p=>taken.add(p.id));

        const smartTV = catalog
          .filter(p => !taken.has(p.id) && /(smart\s*tv|tele)/.test(blob(p)))
          .sort(byRankTitle);

        let items = [...soundbars, ...neoQLED, ...qledOled, ...smartTV].slice(0, LIMIT);

        items = await withOffers(items);

        track.innerHTML = items.map(cardHTML).join('');
        moveBadges(sec);
        mountCarousel(sec);
        continue;
      }

      // --- Default (usa data-filter) ---
      const filters = (sec.dataset.filter || '')
        .toLowerCase()
        .split(',')
        .map(s=>s.trim())
        .filter(Boolean);

      let items = catalog
        .filter(p => filters.some(tok => tok && blob(p).includes(tok)))
        .sort(byRankTitle)
        .slice(0, 12);

      items = await withOffers(items);

      track.innerHTML = items.map(cardHTML).join('');
      moveBadges(sec);
      mountCarousel(sec);
    }

    bindBuyButtons($('#sections') || document);
  }

  // ========= start =========
  document.addEventListener('DOMContentLoaded', () => {
    renderHero();
    mountReveal();
    renderSectionCarousels();
  });
})();
// Badge al <figure> en mobile/iPad; restaurar en desktop
(function () {
  var MQ = window.matchMedia('(max-width: 1194px)');

  function ensureSlot(fig){
    var slot = fig.querySelector('.badge-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'badge-slot';
      fig.appendChild(slot);
    }
    return slot;
  }

  function moveToFigure(card){
    var fig   = card.querySelector('figure');
    var badge = card.querySelector('.badge-off');
    if (!fig || !badge) return;
    var slot = ensureSlot(fig);
    if (badge.parentElement !== slot) slot.appendChild(badge);
  }

  function restoreToTitle(card){
    var title = card.querySelector('.product-title');
    var badge = card.querySelector('.badge-off');
    if (!title || !badge) return;
    if (badge.parentElement !== title) title.appendChild(badge);
  }

  function apply(){
    document.querySelectorAll('.product-card').forEach(function(card){
      if (MQ.matches) moveToFigure(card);
      else restoreToTitle(card);
    });
  }

  if (document.readyState !== 'loading') apply();
  else document.addEventListener('DOMContentLoaded', apply);

  MQ.addEventListener('change', apply);
  window.addEventListener('resize', apply);

  // por si re-renderizás las cards
  var obs = new MutationObserver(apply);
  obs.observe(document.body, { childList: true, subtree: true });

  window.__relayoutBadges = apply;
})();
// Estructura de precios uniforme + (opcional) igualar alturas de todas las cards en ≤1194px
(function(){
  var MQ = window.matchMedia('(max-width: 1194px)');

  function uniformPriceWrap(card){
    var oldEl = card.querySelector('del, .old-price, .product-old-price');
    var newEl = card.querySelector('.product-price, .price-now, .price strong, .new-price');
    if (!newEl) return;

    var wrap = card.querySelector('.price-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'price-wrap';
      // insertar antes del precio actual
      newEl.parentElement.insertBefore(wrap, newEl);
    }
    if (oldEl && oldEl.parentElement !== wrap) wrap.appendChild(oldEl);
    if (newEl.parentElement !== wrap) wrap.appendChild(newEl);
  }

  function apply(){
    document.querySelectorAll('.product-card').forEach(uniformPriceWrap);
    // Igualar alturas (opcional): todas iguales en mobile/iPad
    if (!MQ.matches) {
      document.querySelectorAll('.product-card').forEach(c=>c.style.height='');
      return;
    }
    var maxH = 0, cards = Array.from(document.querySelectorAll('.product-card'));
    cards.forEach(c=>{ c.style.height='auto'; maxH = Math.max(maxH, c.offsetHeight); });
    cards.forEach(c=>{ c.style.height = maxH + 'px'; });
  }

  // disparadores
  function run(){ apply(); }
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);

  window.addEventListener('load', function(){
    run();
    document.querySelectorAll('.product-card img').forEach(img=>{
      if (!img.complete) img.addEventListener('load', run, { once:true });
    });
  });
  window.addEventListener('resize', run);
  MQ.addEventListener('change', run);

  // si re-renderizás productos dinámicamente
  var obs = new MutationObserver(()=>{ clearTimeout(run._t); run._t=setTimeout(run,50); });
  obs.observe(document.body, { childList:true, subtree:true });

  // helper manual
  window.__uniformCards = run;
})();
// Marca "vista de categoría" si hay filtros en la URL
(function () {
  const p = new URL(location.href).searchParams;
  const isCategory =
    p.has('cat') || p.has('subcat') || p.has('brand') ||
    p.has('q')   || p.has('min')    || p.has('max');

  document.documentElement.classList.toggle('is-in-category', isCategory);
})();
// === Categoría: llevar el descuento a la esquina sup. derecha del <figure> ===
(function(){
  // Detectar si estamos en vista de categoría/filtrado
  const p = new URL(location.href).searchParams;
  const isCategory =
    p.has('cat') || p.has('subcat') || p.has('brand') || p.has('q') || p.has('min') || p.has('max');

  if (!isCategory) return; // en la tienda "home" no tocamos nada

  function ensureSlot(fig){
    let slot = fig.querySelector('.badge-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'badge-slot';
      fig.appendChild(slot);
    }
    return slot;
  }

  // posibles clases/usos del descuento en tus cards
  const BADGE_SELECTOR = [
    '.badge-off',
    '.product-price .badge',
    '.discount', '.discount-pill', '.price-badge'
  ].join(',');

  function moveBadge(card){
    const badge = card.querySelector(BADGE_SELECTOR);
    const fig   = card.querySelector('figure');
    if (!badge || !fig) return;

    // si ya está en figure, listo
    if (fig.contains(badge)) return;

    // crear slot y mover badge
    const slot = ensureSlot(fig);
    slot.appendChild(badge);
  }

  function apply(scope){
    (scope || document).querySelectorAll('.product-card').forEach(moveBadge);
  }

  if (document.readyState !== 'loading') apply();
  else document.addEventListener('DOMContentLoaded', apply);

  // por si cambian filtros / se re-renderiza
  const mo = new MutationObserver(()=>apply());
  mo.observe(document.body, { childList:true, subtree:true });
  window.addEventListener('resize', ()=>apply());
})();
// === Hero de categoría: Refrigeradores ===
(function () {
  const q = new URL(location.href).searchParams;
  const isRefrigeradores =
    (q.get('cat') || '').toLowerCase() === 'electrodomesticos' &&
    (q.get('subcat') || '').toLowerCase() === 'refrigeradores';

  if (!isRefrigeradores) return;

  // Marca global por si la usás en estilos
  document.documentElement.classList.add('is-in-category');

  // Contenedor donde inyectar (antes de chips/filtros activos)
  const results = document.querySelector('.shop-results');
  if (!results) return;

  // Evitar duplicar si ya existe
  if (document.getElementById('category-hero')) return;

  // Mismo contenido/tono que el hero de "Refrigeración" en tienda.html
  // (titulo, texto y variables de fondo)  :contentReference[oaicite:1]{index=1}
  const wrapper = document.createElement('section');
  wrapper.className = 'section category-hero reveal fade-up';
  wrapper.id = 'category-hero';
  wrapper.innerHTML = `
    <div class="section__hero"
         style="--hero:url('/img/bannerhela.png'); /* misma imagen que usás */
                --hero-pos:right center; --hero-size:cover;
                --fade-color:rgba(0,0,0,.58); --fade-stop:44%;">
      <div class="section__inner">
        <div class="section__eyebrow">Refrigeración</div>
        <h2 class="section__title">Refrigeración para conservar más y gastar menos</h2>
        <p class="section__tagline">Heladeras y freezers eficientes para tu día a día.</p>
      </div>
    </div>
  `;

  // Insertar antes de los “chips” activos si existen; sino, al inicio
  const chips = document.getElementById('active-chips');
  if (chips && chips.parentElement === results) {
    results.insertBefore(wrapper, chips);
  } else {
    results.prepend(wrapper);
  }
})();
