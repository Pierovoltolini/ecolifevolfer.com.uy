// js/nav.js
// =================== HEADER / DRAWER ===================
// js/nav.js
// =================== HEADER / DRAWER ===================
(function () {
  const burger  = document.getElementById('gdar-burger');
  const drawer  = document.getElementById('gdar-drawer');
  const overlay = document.getElementById('gdar-overlay');
  const close   = document.getElementById('gdar-close');

  const setOpen = (open) => {
    const now = !!open;
    if (!drawer) return;
    drawer.classList.toggle('is-open', now);
    drawer.setAttribute('aria-hidden', String(!now));
    if (burger)  burger.setAttribute('aria-expanded', String(now));
    if (overlay) overlay.hidden = !now;
    document.body.classList.toggle('gdar-no-scroll', now);
    if (now) drawer.focus();
  };

  burger?.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  close?.addEventListener('click', () => setOpen(false));
  overlay?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

  document.querySelectorAll('.gdar-accordion__btn').forEach(btn => {
    const panelId = btn.getAttribute('aria-controls');
    const panel   = document.getElementById(panelId);
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      if (panel) panel.hidden = expanded;
    });
  });

  // >>> Línea nueva: enlaza el badge del carrito en el header
  window.Cart?.bindCount?.('.gdar-cart-count');
})();

// =================== MENÚ (categories.json sin marcas) ===================
// (resto del archivo sin cambios)


// =================== MENÚ (categories.json sin marcas) ===================
(async function buildDrawerMenu(){
  const treeEl = document.getElementById('menu-tree');
  if (!treeEl) return;

  async function loadJSON(url){
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) { console.warn(`No pude cargar ${url} (${r.status})`); return null; }
      const txt = await r.text();
      if (!txt.trim()) { console.warn(`JSON vacío: ${url}`); return null; }
      return JSON.parse(txt);
    } catch (e) {
      console.error(`JSON inválido en ${url}:`, e);
      return null;
    }
  }

  try {
    const [catsJSON, prodJSON] = await Promise.all([
      loadJSON('data/categories.json'),
      loadJSON('data/products.json') // para conteos
    ]);

    const catDefsObj = catsJSON?.categories || {};
    const catOrder   = catsJSON?.order || Object.keys(catDefsObj);
    const products   = Array.isArray(prodJSON) ? prodJSON : (prodJSON?.products ?? []);

    // -------- Conteos por cat / sub / sub-sub (solo texto, opcional) --------
    // Estructura: counts.get(cat).get(sub).get(subsub) = n
    const counts = new Map();
    for (const p of products) {
      const cat = String(p.category||'').toLowerCase();
      const sub = String(p.subcategory||'').toLowerCase();
      // algunos p pueden tener "subsubcategory" si los manejás así; si no, queda vacío
      const subsub = String(p.subsubcategory||'').toLowerCase();
      if (!cat) continue;

      if (!counts.has(cat)) counts.set(cat, new Map());
      const subMap = counts.get(cat);

      const subKey = sub || '_sin_sub';
      if (!subMap.has(subKey)) subMap.set(subKey, new Map());
      const subsubMap = subMap.get(subKey);

      const subsubKey = subsub || '_sin_subsub';
      subsubMap.set(subsubKey, (subsubMap.get(subsubKey)||0) + 1);
    }

    const labelCat = (c) => (catDefsObj[c]?.label || c).toString();
    const labelSub = (c,s) => (catDefsObj[c]?.subs?.[s]?.label || s).toString();

    // -------- Helpers de UI --------
    const makeBtn = (txt) => {
      const b = document.createElement('button');
      b.className = 'mt-btn';
      b.type = 'button';
      b.textContent = txt;
      b.setAttribute('aria-expanded', 'false');
      return b;
    };

    const makePanel = () => {
      const d = document.createElement('div');
      d.className = 'mt-panel';
      return d;
    };

    const makeLink = (href, txt, count) => {
      const a = document.createElement('a');
      a.className = 'mt-link';
      a.href = href;
      a.innerHTML = count ? `${txt} <span class="mt-count">(${count})</span>` : txt;
      return a;
    };

    // Limpio
    treeEl.innerHTML = '';

    // -------- Construcción del árbol (sin marcas) --------
    for (const catSlug of catOrder) {
      const catWrap = document.createElement('div'); catWrap.className = 'mt-item';

      // Botón de categoría (abre/cierra sus subcategorías si existen)
      const catBtn = makeBtn(labelCat(catSlug));
      catWrap.appendChild(catBtn);

      const catPanel = makePanel();
      catWrap.appendChild(catPanel);

      // Link "Ver todo" por categoría
      // Conteo por categoría: suma de todos los sub/subsub
      let catCount = 0;
      const catCountMap = counts.get(catSlug);
      if (catCountMap) {
        for (const subMap of catCountMap.values()) {
          for (const n of subMap.values()) catCount += n;
        }
      }
      catPanel.appendChild(makeLink(
        `tienda.html?cat=${encodeURIComponent(catSlug)}`,
        'Ver todo',
        catCount || undefined
      ));

      // Subcategorías de la categoría
      const subObj = catDefsObj[catSlug]?.subs || {};
      const subOrder = catDefsObj[catSlug]?.suborder || Object.keys(subObj);

      for (const subSlug of subOrder) {
        // Si la subcategoría es "pequenos-electro", se despliega dentro con sus sub-subcategorías
        const isPeqElectro = (catSlug === 'electrodomesticos' && subSlug === 'pequenos-electro');

        // Conteo del nivel sub (suma de sus sub-sub)
        let subCount = 0;
        const subCountMap = counts.get(catSlug)?.get(subSlug) || counts.get(catSlug)?.get('_sin_sub');
        if (subCountMap) {
          for (const n of subCountMap.values()) subCount += n;
        }

        if (isPeqElectro) {
          // Item con botón (abre el panel de sub-subcategorías)
          const subItem = document.createElement('div'); subItem.className = 'mt-item';
          const subBtn  = makeBtn(labelSub(catSlug, subSlug));
          subItem.appendChild(subBtn);

          const subPanel = makePanel();
          subItem.appendChild(subPanel);

          // Link "Ver todo" de pequeños electro (filtra por sub)
          subPanel.appendChild(makeLink(
            `tienda.html?cat=${encodeURIComponent(catSlug)}&subcat=${encodeURIComponent(subSlug)}`,
            'Ver todo',
            subCount || undefined
          ));

          // Mostrar sub-subcategorías definidas en categories.json
          const subsubs = subObj[subSlug]?.subs || {};
          const subsubsOrder = Object.keys(subsubs);
          for (const s2 of subsubsOrder) {
            // Conteo por sub-sub
            const c = (counts.get(catSlug)?.get(subSlug)?.get(s2)) || 0;
            // Si querés ocultar los 0, descomentá:
            // if (!c) continue;
            subPanel.appendChild(makeLink(
              `tienda.html?cat=${encodeURIComponent(catSlug)}&subcat=${encodeURIComponent(subSlug)}&subsub=${encodeURIComponent(s2)}`,
              subsubs[s2]?.label || s2,
              c || undefined
            ));
          }

          // Toggle sub-sub
          subBtn.addEventListener('click', () => {
            const open = !subPanel.classList.contains('is-open');
            subPanel.classList.toggle('is-open', open);
            subBtn.setAttribute('aria-expanded', String(open));
          });

          catPanel.appendChild(subItem);
        } else {
          // Para todas las otras subcategorías: link directo (sin marcas, sin sub-sub)
          const link = makeLink(
            `tienda.html?cat=${encodeURIComponent(catSlug)}&subcat=${encodeURIComponent(subSlug)}`,
            labelSub(catSlug, subSlug),
            subCount || undefined
          );
          catPanel.appendChild(link);
        }
      }

      // Toggle subcategorías
      catBtn.addEventListener('click', () => {
        const open = !catPanel.classList.contains('is-open');
        catPanel.classList.toggle('is-open', open);
        catBtn.setAttribute('aria-expanded', String(open));
      });

      treeEl.appendChild(catWrap);
    }
  } catch (e) {
    console.warn('No se pudo construir el menú del drawer:', e);
    treeEl.innerHTML = `<a class="mt-link" href="tienda.html">Ver productos</a>`;
  }
})();
// al final de nav.js
if (window.Cart?.bindCount) Cart.bindCount();
