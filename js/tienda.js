// js/tienda.js
(function () {
  // ========= utils =========
  var $  = function(sel, root){ return (root||document).querySelector(sel); };
  var $$ = function(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); };
  var params    = new URLSearchParams(location.search);
  var PAGE_SIZE = 24;

  // Cache global de productos
  var ECO_PRODUCTS_CACHE = null;

  // slugs: sin tildes, minúsculas, con guiones
  var slugify = function (s) {
    return (s || '')
      .toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-');
  };

  // --- helpers anti-NaN para precios ---
  var isNum = function (v) { return Number.isFinite(Number(v)); };
  var fmt   = function (n, prefix) { return isNum(n) ? (prefix||'') + Number(n).toLocaleString('es-UY') : ''; };

  // Mostrar/ocultar vistas
  function setMode(mode){
    document.body.classList.remove('is-grid','is-sections');
    document.body.classList.add(mode);

    // Fallback visual por si los estilos no cargaron
    var isGrid   = mode === 'is-grid';
    var sections = document.getElementById('sections');
    var chips    = document.getElementById('active-chips');
    var grid     = document.getElementById('products-grid');
    var pager    = document.getElementById('pagination');
    var hero     = document.getElementById('filter-hero');

    if (sections) sections.style.display = isGrid ? 'none' : '';
    if (chips)    chips.style.display    = isGrid ? '' : 'none';
    if (grid)     grid.style.display     = isGrid ? '' : 'none';
    if (pager)    pager.style.display    = isGrid ? '' : 'none';
    if (hero)     hero.style.display     = isGrid ? '' : 'none';
  }

// ================== BUSCADOR: helpers (anti-falsos positivos) ==================
function norm(s=''){ 
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim();
}

// Particiono en palabras para poder hacer match por palabra completa
function tokenize(s=''){
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// Variantes controladas: singular/plural. SIN prefijos agresivos.
function variants(word){
  const w = norm(word);
  const v = new Set([w]);
  if (w.endsWith('s')) v.add(w.slice(0,-1));        // heladeras -> heladera
  if (!w.endsWith('s') && w.length>2) v.add(w+'s'); // heladera -> heladeras
  return Array.from(v);
}

// Sinónimos acotados (sin "hair" para no abrir demasiado)
const SYN = {
  'secador': ['secador de cabello','cabello','pelo'],
  'secadora': ['secadora de ropa','ropa'],
  'tele': ['tv','smart tv','televisor','televisores'],
  'heladera': ['refrigerador','refrigeradora','freezer'],
  'lavavajillas': ['lavaplatos','lavavajilla'],
  'lavarropas': ['lavadora','lavado','lavasecarropas'],
  'cocina': ['horno','anafe','campana','cocinas']
};

// Expando la consulta en términos y frases (para “secador de cabello”)
function expandQuery(q){
  const base = norm(q);
  if (!base) return {terms:[], phrases:[]};

  const tokens = base.split(/\s+/).filter(Boolean);
  const bag = new Set();
  const phrases = new Set();

  if (tokens.length > 1) phrases.add(base); // frase completa

  for (const t of tokens){
    for (const v of variants(t)) bag.add(v);
    const syns = SYN[t] || [];
    for (const s of syns){
      const st = norm(s);
      const parts = st.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        phrases.add(st);           // ej "secador de cabello"
      } else {
        for (const v of variants(st)) bag.add(v);
      }
    }
  }
  return { terms: Array.from(bag), phrases: Array.from(phrases) };
}

// Construyo texto indexado y sets por campo
function buildIndexEntry(p){
  const title = norm(p.title||'');
  const brand = norm(p.brand||'');
  const cats  = norm([p.category,p.subcategory,p.subsubcategory].filter(Boolean).join(' '));
  const text  = norm([p.title,p.brand,p.category,p.subcategory,p.subsubcategory,p.id,p.sku,p.slug]
                      .filter(Boolean).join(' '));

  return {
    p,
    title, brand, cats, text,
    titleWords: new Set(tokenize(p.title||'')),
    brandWords: new Set(tokenize(p.brand||'')),
    catWords:   new Set(tokenize([p.category,p.subcategory,p.subsubcategory].filter(Boolean).join(' '))),
    textWords:  new Set(tokenize(text))
  };
}

function hasWord(setLike, term){ return setLike.has(term); }
function containsPhrase(haystackNorm, phraseNorm){ return haystackNorm.includes(phraseNorm); }

// Devuelve lista filtrada y ordenada con umbral anti-ruido
function searchProducts(products, q){
  const {terms, phrases} = expandQuery(q);
  if (!terms.length && !phrases.length) return products;

  const indexed = products.map(buildIndexEntry);

  function score(e){
    let s = 0;
    let strongHits = 0;

    // Frases (muy fuertes)
    for (const ph of phrases){
      const parts = ph.split(/\s+/);
      const allWords = parts.every(w =>
        hasWord(e.titleWords,w) || hasWord(e.brandWords,w) || hasWord(e.catWords,w) || hasWord(e.textWords,w)
      );
      if (!allWords) continue;
      if (containsPhrase(e.title, ph)) { s += 20; strongHits++; }
      else if (containsPhrase(e.brand, ph)) { s += 14; strongHits++; }
      else if (containsPhrase(e.cats, ph))  { s += 10; strongHits++; }
      else if (containsPhrase(e.text, ph))  { s += 6;  strongHits++; }
    }

    // Palabras exactas (por palabra completa)
    for (const t of terms){
      if (hasWord(e.titleWords, t)) { s += 8; strongHits++; }
      else if (hasWord(e.brandWords, t)) { s += 6; strongHits++; }
      else if (hasWord(e.catWords, t)) { s += 4; strongHits++; }
      else if (hasWord(e.textWords, t)) { s += 2; strongHits++; }
      // SIN substrings globales; evita lavavajillas->lavarropas y secador->afeitadora
    }

    // Umbral: mínimo 1 “hit fuerte”
    if (strongHits === 0) return -1;
    return s;
  }

  const ranked = indexed
    .map(e => ({ e, s: score(e) }))
    .filter(x => x.s > 0)
    .sort((a,b) => b.s - a.s || (a.e.p.rank||999) - (b.e.p.rank||999));

  return ranked.map(x => x.e.p);
}

  function renderNoResults(term){
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = `
      <div class="no-results">
        <h2>No encontramos ningún resultado para "${(term||'').replace(/"/g,'&quot;')}"</h2>
        <p>¿Qué podés hacer?</p>
        <ul>
          <li>Comprobá los términos ingresados.</li>
          <li>Intentá usar una sola palabra.</li>
          <li>Usá términos más generales.</li>
          <li>Probá con sinónimos o nombres de marca.</li>
        </ul>
      </div>
    `;
  }

  // ========= Estado de carga =========
  function showLoadingState() {
    const gridEl = $('#products-grid');
    if (gridEl) {
        gridEl.innerHTML = `
            <li class="product-card skeleton-card">
                <div class="skel-img skel-box"></div>
                <div class="skel-box" style="width:80%"></div>
                <div class="skel-box" style="width:60%"></div>
                <div class="skel-box" style="width:40%"></div>
            </li>
            <li class="product-card skeleton-card">
                <div class="skel-img skel-box"></div>
                <div class="skel-box" style="width:80%"></div>
                <div class="skel-box" style="width:60%"></div>
                <div class="skel-box" style="width:40%"></div>
            </li>
            <li class="product-card skeleton-card">
                <div class="skel-img skel-box"></div>
                <div class="skel-box" style="width:80%"></div>
                <div class="skel-box" style="width:60%"></div>
                <div class="skel-box" style="width:40%"></div>
            </li>
        `;
    }
  }

  function initializeGridMode() {
    // Forzar modo grid inmediatamente
    setMode('is-grid');
    // Mostrar estado de carga
    showLoadingState();
    // Scroll suave a los resultados
    setTimeout(() => {
        const resultsSection = document.querySelector('.shop-results');
        if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
  }

  // ========= Carga optimizada de productos =========
  async function loadProductsOnce() {
    if (ECO_PRODUCTS_CACHE) {
        return ECO_PRODUCTS_CACHE;
    }
    
    try {
      var rProdP = fetch('data/products.json', { cache: 'no-store' });
      var rOffP  = fetch('data/offers.json',   { cache: 'no-store' });

      var rProd = await rProdP;
      var rOff  = await rOffP;

      if (!rProd.ok) {
        console.warn('No pude cargar products.json');
        return [];
      }

      var raw    = await rProd.json();
      var offers = rOff && rOff.ok ? (await rOff.json()) : [];
      var base   = Array.isArray(raw) ? raw : (raw && raw.products ? raw.products : []);

      // normalizar
      var products = base.map(function (p) {
        var image = p.thumbnail || (Array.isArray(p.images) && p.images.length ? p.images[0] : null) || p.image || 'img/products/placeholder.png';
        return {
          id:              p.id,
          title:           p.title || '',
          brand:           p.brand || '',
          category:        p.category || '',
          subcategory:     p.subcategory || '',
          subsubcategory:  p.subsubcategory || '',   // 3er nivel
          price:           Number(p.price != null ? p.price : 0),
          image:           image,                    // usado por la card
          thumbnail:       p.thumbnail || null,      // por si lo necesitás en la ficha
          images:          Array.isArray(p.images) ? p.images : [],
          rank:            Number(p.rank != null ? p.rank : 999),
          onSale:          false,
          priceOld:        0,
          // slugs precalculados
          _cat:    slugify(p.category),
          _sub:    slugify(p.subcategory),
          _subsub: slugify(p.subsubcategory),

          // (opcional) si existen en tu JSON, los dejamos tal cual para data-attrs:
          price_usd: p.price_usd,
          price_uyu: p.price_uyu
        };
      });

      // aplicar ofertas (si existe applyOffers) o soporte simple
      if (typeof window.applyOffers === 'function') {
        products = window.applyOffers(products, offers);
      } else if (Array.isArray(offers) || (offers && typeof offers === 'object')) {
        var map = Array.isArray(offers)
          ? (function(arr){
              var o = {}; for (var i=0;i<arr.length;i++){ var it=arr[i]||{}; o[it.id]=it.price; }
              return o;
            })(offers)
          : offers;

        products = products.map(function (p) {
          var final = map[p.id];
          if (final != null && !isNaN(final)) {
            return {
              id: p.id,
              title: p.title,
              brand: p.brand,
              category: p.category,
              subcategory: p.subcategory,
              subsubcategory: p.subsubcategory,
              price: Number(final),
              image: p.image,
              thumbnail: p.thumbnail,
              images: p.images,
              rank: p.rank,
              onSale: true,
              priceOld: p.price,
              _cat: p._cat,
              _sub: p._sub,
              _subsub: p._subsub,
              price_usd: p.price_usd,
              price_uyu: p.price_uyu
            };
          }
          return p;
        });
      }

      ECO_PRODUCTS_CACHE = products;
      return products;
      
    } catch (error) {
      console.error('Error loading products:', error);
      return [];
    }
  }

  // ========= hook UI =========
  var countEl = $('#results-count');
  var gridEl  = $('#products-grid');
  var chipsEl = $('#active-chips');
  var pagEl   = $('#pagination');
  var sortSel = $('#sort');
  var qInput  = $('#q');

  // sync URL -> UI
  if (qInput && params.get('q')) qInput.value = params.get('q');
  if (sortSel && params.get('sort')) sortSel.value = params.get('sort');
  if (sortSel) {
    sortSel.addEventListener('change', function () {
      params.set('sort', sortSel.value);
      params.set('page', '1');
      location.search = params.toString();
    });
  }

  // ========= main =========
  (async function run(){
    try {
      // ====== Detectar filtros activos inmediatamente ======
      var active = {
        cat:    params.get('cat')    || '',
        subcat: params.get('subcat') || '',
        subsub: params.get('subsub') || '',   // 3er nivel
        brand:  params.get('brand')  || '',
        q:      params.get('q')      || '',
        onSale: params.get('onSale') === '1',
        filter: params.get('filter') || ''  
      };

      // slugs para comparar
      var aCat    = slugify(active.cat);
      var aSub    = slugify(active.subcat);
      var aSubSub = slugify(active.subsub);

      // ¿hay filtros activos? -> cambiamos modo inmediatamente
      var isFiltering = !!(aCat || aSub || aSubSub || active.q || active.brand || active.onSale || active.filter);

      if (isFiltering) {
        initializeGridMode();
      } else {
        setMode('is-sections');
      }

      // ====== Cargar productos (optimizado) ======
      var products = await loadProductsOnce();
      if (products.length === 0) {
        if (gridEl) gridEl.innerHTML = '<li class="product-card">No se pudieron cargar los productos.</li>';
        return;
      }

      function findBestSection(terms) {
        var sectionsRoot = document.getElementById('sections');
        var sections = sectionsRoot ? Array.prototype.slice.call(sectionsRoot.querySelectorAll('.section')) : [];
        var best = null, bestScore = -1;

        sections.forEach(function (sec) {
          var filters = (sec.dataset.filter || '')
            .toLowerCase()
            .split(',')
            .map(function (s) { return s.trim(); })
            .filter(Boolean);

          var score = 0;
          for (var i=0; i<filters.length; i++) {
            var tok = filters[i];
            if (terms.indexOf(tok) !== -1) score++;
          }
          if (score > bestScore) { bestScore = score; best = sec; }
        });

        return { best: best, score: bestScore };
      }

      // ===== Banner cuando hay filtro =====
      (function renderFilterHero(){
        var filterHero = document.getElementById('filter-hero');
        if (!filterHero) return;

        var hasFilters = !!(aCat || aSub || aSubSub || active.q || active.brand || active.onSale || active.filter);
        if (hasFilters) { filterHero.hidden = true; filterHero.innerHTML = ''; return; }
      })();

      // ===== Renombrar H1 =====
      (function renameH1(){
        var h1 = document.getElementById('shop-title');
        var rcEl = document.getElementById('results-count');
        var resultsCount = rcEl ? rcEl.textContent : '';
        if (!h1) return;

        // Preferencias de "nombre lindo"
        var nice = active.subsub || active.subcat || active.cat || (active.q ? ('Resultados: ' + active.q) : '');

        // Si no hay nada (p.ej. solo filter=...), intentamos deducir la sección del hero
        if (isFiltering && !nice && active.filter) {
          var terms = [active.filter].join(' ').toLowerCase();
          var pick = findBestSection(terms);
          if (pick.best) {
            var eyebrow = pick.best.querySelector('.section__eyebrow');
            nice = eyebrow && eyebrow.textContent ? eyebrow.textContent.trim() : (pick.best.id || 'Resultados');
          }
        }

        if (isFiltering && nice) {
          h1.innerHTML = (nice.charAt(0).toUpperCase() + nice.slice(1)) + ' <span id="results-count">' + resultsCount + '</span>';
          document.title = nice + ' | Tienda | EcoLife by Volfer';
        } else {
          h1.innerHTML = 'Tienda <span id="results-count">' + resultsCount + '</span>';
          document.title = 'Tienda | EcoLife by Volfer';
        }
      })();

      // ====== filtrar lista (por categoría/marca/oferta/filters) ======
      var preList = products.filter(function (p) {
        if (aCat    && p._cat    !== aCat)    return false;
        if (aSub    && p._sub    !== aSub)    return false;
        if (aSubSub && p._subsub !== aSubSub) return false; // ver solo 3er nivel

        if (active.brand && p.brand.toLowerCase() !== active.brand.toLowerCase()) return false;

        if (active.onSale && !p.onSale) return false;

        // Filtro "filter" (chips predefinidos)
        if (active.filter) {
          const tokens = String(active.filter)
            .toLowerCase()
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          const parts = [
            p.title,
            p.brand,
            p.category,
            p.subcategory,
            p.subsubcategory,
            p.subSubcategory,
            p.sub_subcategory
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          // Opcional: excluir airfryer
          if (parts.includes('freidora') || parts.includes('airfryer')) return false;

          if (!tokens.some(tok => parts.includes(tok))) return false;
        }

        return true;
      });

      // ====== aplicar búsqueda "q" con sinónimos/ranking ======
      var list = preList;
      if (active.q && active.q.trim()) {
        list = searchProducts(preList, active.q);
      }

      // ====== ordenar ======
      var sort = (params.get('sort') || 'relevance');
      if (sort === 'relevance')   list.sort(function(a,b){ return (a.rank - b.rank) || a.title.localeCompare(b.title); });
      if (sort === 'price-asc')   list.sort(function(a,b){ return (a.price - b.price); });
      if (sort === 'price-desc')  list.sort(function(a,b){ return (b.price - a.price); });
      if (sort === 'new')         list.sort(function(a,b){ return String(b.id).localeCompare(String(a.id)); });
      if (sort === 'sale-first')  list.sort(function(a,b){ return (Number(!!b.onSale) - Number(!!a.onSale)) || a.title.localeCompare(b.title); });

      // ====== paginar ======
      var total = list.length;
      var page  = Math.max(1, parseInt(params.get('page') || '1', 10));
      var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      var slice = list.slice((page-1) * PAGE_SIZE, page * PAGE_SIZE);

      // total
      if (countEl) countEl.textContent = '(' + total + ')';

      // ====== chips ======
      if (chipsEl) {
        chipsEl.innerHTML = '';
        var addChip = function (key, label) {
          var chip = document.createElement('span');
          chip.className = 'chip';
          chip.innerHTML = label + ' <button type="button" aria-label="Quitar ' + label + '">×</button>';
          var btn = chip.querySelector('button');
          if (btn) {
            btn.addEventListener('click', function () {
              params.delete(key); params.set('page','1'); location.search = params.toString();
            });
          }
          chipsEl.appendChild(chip);
        };
        if (active.cat)    addChip('cat',    'Categoría: ' + active.cat);
        if (active.subcat) addChip('subcat', 'Subcategoría: ' + active.subcat);
        if (active.subsub) addChip('subsub', 'Tipo: ' + active.subsub);
        if (active.brand)  addChip('brand',  'Marca: ' + active.brand);
        if (active.q)      addChip('q',      'Buscar: 「' + active.q + '」');
        if (active.onSale) addChip('onSale', 'Solo ofertas');

        if (chipsEl.children.length) {
          var clear = document.createElement('button');
          clear.className = 'chip';
          clear.textContent = 'Limpiar todo';
          clear.addEventListener('click', function () {
            ['cat','subcat','subsub','brand','q','onSale','page'].forEach(function(k){ params.delete(k); });
            location.search = params.toString();
          });
          chipsEl.appendChild(clear);
        }
      }

      // ====== grid ======
      if (gridEl) {
        // borramos todo, incluidos los skeletons
        gridEl.innerHTML = '';

        if (!slice.length) {
          // si no hay resultados en la página actual, mostramos mensaje general
          // (nota: como ya aplicamos paginación, podría haber resultados en otras páginas;
          //  si querés, podés mostrar el mensaje cuando total === 0)
          if (total === 0) {
            renderNoResults(active.q || '');
          } else {
            gridEl.innerHTML = '<li class="product-card">No hay resultados en esta página. Probá cambiar de página.</li>';
          }
        } else {
          var frag = document.createDocumentFragment();

          slice.forEach(function (p) {
            var hasOld = !!(p.onSale && p.priceOld);
            var old    = hasOld ? '<span class="old-price">$ ' + Number(p.priceOld).toLocaleString('es-UY') + '</span>' : '';
            var pct    = hasOld ? Math.round((1 - (p.price / p.priceOld)) * 100) : 0;
            var badge  = p.onSale ? '<span class="badge">-' + pct + '%</span>' : '';

            var priceUSD = Number.isFinite(Number(p.price_usd)) ? Number(p.price_usd) : Number(p.price);
            var priceUYU = Number.isFinite(Number(p.price_uyu)) ? Number(p.price_uyu) : '';

            var li = document.createElement('li');
            li.className = 'product-card';
            li.innerHTML =
                '<figure>'
              + '  <img src="' + p.image + '" alt="' + (p.title || '') + '" loading="lazy" decoding="async" width="320" height="400"'
              + '    onerror="if(!this._tried){this._tried=1;this.src=\'img/products/placeholder.png\';}">'
              + '</figure>'
              + '<div class="product-title">' + (p.title || '') + '</div>'
              + '<div class="product-meta">' + (p.brand || '') + '</div>'
              + '<div class="product-price">'
              +     old
              +   ' <span data-usd="' + (Number.isFinite(priceUSD) ? priceUSD : '') + '" data-uyu="' + (Number.isFinite(priceUYU) ? priceUYU : '') + '">'
              +       'U$S ' + Number(priceUSD).toLocaleString('es-UY')
              +   ' </span>'
              +     badge
              + '</div>'
              + '<div class="product-actions">'
              + '  <a class="page-btn buy-link" href="product.html?id=' + encodeURIComponent(p.id) + '" aria-label="Comprar ' + (p.title || '') + '">Ver producto </a>'
              + '</div>';

            frag.appendChild(li);
          });

          gridEl.appendChild(frag);
          if (window.__relayoutBadges) try { window.__relayoutBadges(); } catch(e){}
        }
      }

      // ====== paginación ======
      if (pagEl) {
        pagEl.innerHTML = '';
        if (pages > 1) {
          var go  = function(n){ params.set('page', String(n)); location.search = params.toString(); };
          var btn = function(n, label){
            var a = document.createElement('a');
            a.href = 'javascript:void(0)';
            a.className = 'page-btn';
            a.textContent = String(label != null ? label : n);
            if (n === page) a.setAttribute('aria-current', 'page');
            a.addEventListener('click', function(){ go(n); });
            return a;
          };

          if (page > 1) pagEl.appendChild(btn(page-1, '‹'));
          for (var k=1; k<=pages; k++){
            if (k === 1 || k === pages || Math.abs(k - page) <= 2) {
              pagEl.appendChild(btn(k));
            } else {
              var last = pagEl.lastChild;
              var isDots = last && last.classList && last.classList.contains('dots');
              if (!isDots) {
                var span = document.createElement('span'); span.textContent = '…'; span.className = 'dots';
                pagEl.appendChild(span);
              }
            }
          }
          if (page < pages) pagEl.appendChild(btn(page+1, '›'));
        }
      }
    } catch (err) {
      console.error('Error en tienda.js:', err);
      var gridElErr = document.getElementById('products-grid');
      if (gridElErr) gridElErr.innerHTML = '<li class="product-card">Hubo un error al renderizar la tienda. Revisá la consola.</li>';
    }
  })();
})();

// === Badge al área vacía del figure SOLO en móvil/iPad ===
(function () {
  const MQ = window.matchMedia('(max-width: 1180px)');

  function ensureSlot(fig){
    let slot = fig.querySelector('.badge-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'badge-slot';
      fig.appendChild(slot);
    }
    return slot;
  }

  function moveBadgeToFigure(card){
    const fig   = card.querySelector('figure');
    const badge = card.querySelector('.badge-off, .badge');
    if (!fig || !badge) return;
    const slot = ensureSlot(fig);
    if (badge.parentElement !== slot) slot.appendChild(badge);
  }

  function restoreBadgeToTitle(card){
    const title = card.querySelector('.product-title');
    const badge = card.querySelector('.badge-off, .badge');
    if (!title || !badge) return;
    if (badge.parentElement !== title) title.appendChild(badge);
    const slot = card.querySelector('figure .badge-slot');
    if (slot && !slot.firstElementChild) slot.remove();
  }

  function apply(){
    document.querySelectorAll('.product-card').forEach(card=>{
      if (MQ.matches) moveBadgeToFigure(card);
      else restoreBadgeToTitle(card);
    });
  }

  // Ejecutar una vez; y solo escuchar cuando cambia el breakpoint
  apply();
  MQ.addEventListener('change', apply);

  // Exponer para re-render del grid
  window.__relayoutBadges = apply;
})();

// === Handler para clicks en "Ver más" ===
window.handleCategoryClick = function(link) {
  // Prevenir navegación por defecto
  event.preventDefault();
  
  // Mostrar estado de loading inmediatamente
  const gridEl = document.getElementById('products-grid');
  if (gridEl) {
      gridEl.innerHTML = `
          <li class="product-card skeleton-card">
              <div class="skel-img skel-box"></div>
              <div class="skel-box" style="width:80%"></div>
              <div class="skel-box" style="width:60%"></div>
              <div class="skel-box" style="width:40%"></div>
          </li>
          <li class="product-card skeleton-card">
              <div class="skel-img skel-box"></div>
              <div class="skel-box" style="width:80%"></div>
              <div class="skel-box" style="width:60%"></div>
              <div class="skel-box" style="width:40%"></div>
          </li>
          <li class="product-card skeleton-card">
              <div class="skel-img skel-box"></div>
              <div class="skel-box" style="width:80%"></div>
              <div class="skel-box" style="width:60%"></div>
              <div class="skel-box" style="width:40%"></div>
          </li>
      `;
  }
  
  // Forzar modo grid
  document.body.classList.remove('is-grid','is-sections');
  document.body.classList.add('is-grid');
  
  // Ocultar secciones inmediatamente
  const sections = document.getElementById('sections');
  if (sections) sections.style.display = 'none';
  
  // Mostrar elementos de grid
  const chips = document.getElementById('active-chips');
  const pager = document.getElementById('pagination');
  if (chips) chips.style.display = '';
  if (pager) pager.style.display = '';
  
  // Scroll suave a resultados
  setTimeout(() => {
      const resultsSection = document.querySelector('.shop-results');
      if (resultsSection) {
          resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
  }, 50);
  
  // Navegar después de un pequeño delay
  setTimeout(() => {
      window.location.href = link.href;
  }, 100);
  
  return false;
};
// === ABRIR PRODUCTO AL TOCAR LA TARJETA ===
document.addEventListener('click', (e) => {
  const card = e.target.closest('.product-card');
  if (!card) return;

  const btn = card.querySelector('.buy-link');
  if (!btn) return;

  // Evita que el click en el botón duplique acción
  if (e.target.closest('.buy-link')) return;

  // Abrir producto
  window.location.href = btn.href;
}, false);

// === MOBILE: TAP TAMBIÉN ABRE ===
document.addEventListener('touchend', (e) => {
  const card = e.target.closest('.product-card');
  if (!card) return;

  const btn = card.querySelector('.buy-link');
  if (!btn) return;

  if (e.target.closest('.buy-link')) return;

  window.location.href = btn.href;
}, { passive: true });
