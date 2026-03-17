
// util mínimo
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();
// Reveal on scroll (retrigger each time)
(function () {
  const els = document.querySelectorAll('.reveal');

  if (!('IntersectionObserver' in window) || els.length === 0) {
    // Fallback: mostrar todo
    els.forEach(el => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;

      // Si entra al viewport -> agregar .in-view
      if (entry.isIntersecting) {
        el.classList.add('in-view');
      } else {
        // Si sale -> quitar para que la animación se pueda re-disparar al volver a entrar
        el.classList.remove('in-view');
      }
    });
  }, {
    root: null,
    threshold: 0.18,          // ~18% visible
    rootMargin: '0px 0px -8% 0px' // dispara un toque antes
  });

  els.forEach(el => io.observe(el));
})();
// HERO: reveal on scroll (retrigger)
(function(){
  const hero = document.querySelector('.hero');
  if(!hero) return;

  // Estado inicial limpio (por si cargas desde mitad de página)
  function setState(isIn){
    hero.classList.toggle('is-inview', isIn);
  }

  if(!('IntersectionObserver' in window)){
    // Fallback: mostrar animado una vez
    setState(true);
    return;
  }

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      // Entra al viewport => activar
      if(entry.isIntersecting){
        setState(true);
      }else{
        // Sale del viewport => quitar para re-disparar al volver
        setState(false);
      }
    });
  },{
    threshold: 0.45,               // ~45% visible
    rootMargin: '0px 0px -6% 0px'  // dispara un toque antes
  });

  io.observe(hero);
})();
// Icon cards: reveal on scroll con re-trigger
(function () {
  const group = document.querySelector('.icon-cards');
  if (!group) return;

  const set = (on) => group.classList.toggle('inview', on);

  if (!('IntersectionObserver' in window)) {
    set(true);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => set(entry.isIntersecting));
  }, {
    threshold: 0.25,
    rootMargin: '0px 0px -8% 0px'
  });

  io.observe(group);
})();
/* ====== FAQ: acordeón accesible ====== */
(function(){
  const faqs = document.querySelectorAll('.faq__item');
  faqs.forEach(item => {
    const btn = item.querySelector('.faq__q');
    const panel = item.querySelector('.faq__a');

    if(!btn || !panel) return;

    // Cerrar al iniciar
    btn.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    panel.style.maxHeight = '0px';

    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      // Toggle
      btn.setAttribute('aria-expanded', String(!expanded));

      if (!expanded) {
        panel.classList.add('is-open');
        // Altura automática con transición suave
        panel.style.maxHeight = panel.scrollHeight + 'px';
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px'; // fijar estado actual
        // forzar reflow para transicionar hacia 0
        panel.offsetHeight; 
        panel.style.maxHeight = '0px';
        // al final de la transición quitamos la clase
        panel.addEventListener('transitionend', function onEnd(){
          panel.classList.remove('is-open');
          panel.removeEventListener('transitionend', onEnd);
        });
      }
    });
  });
})();

/* ====== FAQ: reveal on scroll (re-trigger) ====== */
(function(){
  const section = document.querySelector('.faq');
  if(!section) return;

  const set = (on) => section.classList.toggle('inview', on);

  if(!('IntersectionObserver' in window)){
    set(true); return;
  }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e => set(e.isIntersecting));
  }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

  io.observe(section);
})();
// ===== Showcase Carousel: auto-scroll continuo + flechas + retrigger on scroll
(function(){
  const section = document.querySelector('.showcase');
  const viewport = section?.querySelector('.sc-viewport');
  const track = section?.querySelector('.sc-track');
  const prevBtn = section?.querySelector('.sc-prev');
  const nextBtn = section?.querySelector('.sc-next');
  if(!section || !viewport || !track) return;

  // Reveal al entrar/salir (para re-disparar animación de entrada)
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e => section.classList.toggle('inview', e.isIntersecting));
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    io.observe(section);
  } else {
    section.classList.add('inview');
  }

  // Duplicar contenido para loop infinito
  const items = Array.from(track.children);
  track.append(...items.map(n => n.cloneNode(true)));

  let pos = 0;                // posición actual en px
  const speed = 0.5;          // velocidad (px/frame) -> ajustá si querés más rápido/lento
  let rafId = null;
  let isPaused = false;

  // Ancho total de la mitad (un set) para el loop
  function getSetWidth(){
    let w = 0;
    for (let i = 0; i < items.length; i++){
      w += items[i].getBoundingClientRect().width + getGap();
    }
    return w;
  }
  function getGap(){
    // lee el gap de .sc-track (10px por CSS), fallback si no está soportado
    const cs = getComputedStyle(track);
    const g = parseFloat(cs.columnGap || cs.gap || '10');
    return isNaN(g) ? 10 : g;
  }

  let setWidth = 0;
  function recalc(){
    setWidth = getSetWidth();
  }
  recalc();
  window.addEventListener('resize', ()=>{ recalc(); });

  function loop(){
    if(!isPaused){
      pos -= speed;
      if (Math.abs(pos) >= setWidth) pos = 0; // resetea cuando pasa un set completo
      track.style.transform = `translateX(${pos}px)`;
    }
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  

  // Flechas manuales: mueven una “pantalla” parcial sin romper el auto
  function nudge(dir){
    // dir = 1 (next) o -1 (prev)
    const step = Math.min(viewport.clientWidth * 0.6, 600); // tamaño del empujón
    pos -= dir * step;
    // normalizar dentro del rango [-setWidth, 0)
    while (pos <= -setWidth) pos += setWidth;
    while (pos > 0) pos -= setWidth;
    track.style.transform = `translateX(${pos}px)`;
  }
  prevBtn?.addEventListener('click', ()=> nudge(-1));
  nextBtn?.addEventListener('click', ()=> nudge(1));

  // Drag con mouse/touch (suave)
  let dragging = false, startX = 0, startPos = 0;
  function onDown(clientX){
    dragging = true; isPaused = true;
    startX = clientX; startPos = pos;
    viewport.classList.add('dragging');
  }
  function onMove(clientX){
    if(!dragging) return;
    const dx = clientX - startX;
    pos = startPos + dx;
    // mantener en rango (se normaliza en loop)
    track.style.transform = `translateX(${pos}px)`;
  }
  function onUp(){
    if(!dragging) return;
    dragging = false;
    viewport.classList.remove('dragging');
    isPaused = false;
  }

  // Eventos mouse
  viewport.addEventListener('mousedown', e => { e.preventDefault(); onDown(e.clientX); });
  window.addEventListener('mousemove', e => onMove(e.clientX));
  window.addEventListener('mouseup', onUp);

  // Eventos touch
  viewport.addEventListener('touchstart', e => onDown(e.touches[0].clientX), {passive:true});
  window.addEventListener('touchmove',  e => onMove(e.touches[0].clientX), {passive:true});
  window.addEventListener('touchend', onUp);

})();

/* ====== Menú hamburguesa (drawer) con manejo de foco ====== */
(() => {
  const burger   = document.getElementById('gdar-burger');
  const drawer   = document.getElementById('gdar-drawer');   // <aside tabindex="-1">
  const overlay  = document.getElementById('gdar-overlay');
  const closeBtn = document.getElementById('gdar-close');
  const main     = document.querySelector('main');            // para inert opcional
  if (!burger || !drawer) return;

  let lastFocus = null;

  const setInert = (on) => {
    // Deshabilita la interacción fuera del drawer (si el navegador soporta 'inert')
    if (main && 'inert' in HTMLElement.prototype) {
      main.inert = on;
    }
  };

  const trapTab = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = drawer.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  function openMenu() {
    lastFocus = document.activeElement;
    burger.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    if (overlay) overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    setInert(true);

    // mover foco dentro del drawer (al botón cerrar si existe; si no, al propio aside)
    (closeBtn || drawer).focus();
    document.addEventListener('keydown', trapTab);
  }

  function closeMenu() {
    // Si el foco está dentro del drawer, sacarlo antes de ocultar
    if (drawer.contains(document.activeElement)) {
      // volver el foco al trigger
      burger.focus();
    }
    burger.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
    setInert(false);
    document.removeEventListener('keydown', trapTab);

    // Restaurar foco previo (si no quedó en el burger)
    if (lastFocus && lastFocus !== burger) {
      try { lastFocus.focus(); } catch {}
    }
  }

  burger.addEventListener('click', () => {
    const expanded = burger.getAttribute('aria-expanded') === 'true';
    expanded ? closeMenu() : openMenu();
  });
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
})();
// Scroll-lock para el drawer
function lockScroll(){
  const y = window.scrollY || document.documentElement.scrollTop;
  document.body.dataset.scrollY = y;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
}
function unlockScroll(){
  const y = parseInt(document.body.dataset.scrollY || '0', 10);
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  window.scrollTo(0, y);
}

// Si ya tenés el burger/close:
document.getElementById('gdar-burger')?.addEventListener('click', lockScroll);
document.getElementById('gdar-close')?.addEventListener('click', unlockScroll);
// Si tu overlay cierra:
document.getElementById('gdar-overlay')?.addEventListener('click', unlockScroll);
(function(){
  const vp = document.querySelector('.showcase .sc-viewport');
  if(!vp) return;

  let sx = 0, sy = 0, dragging = false;

  vp.addEventListener('touchstart', (e)=>{
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    dragging = false;
  }, {passive:true});

  vp.addEventListener('touchmove', (e)=>{
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - sx);
    const dy = Math.abs(t.clientY - sy);
    // Si el gesto es más horizontal que vertical, prevenimos scroll de la página
    if (dx > dy) {
      e.preventDefault();              // <-- clave
      dragging = true;
    }
  }, {passive:false});

  vp.addEventListener('touchend', ()=>{ dragging = false; }, {passive:true});
})();
/* ============ Slider Nosotros ============ */
document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".nosotros-slider .slide");
  const prevBtn = document.querySelector(".nosotros-slider .prev");
  const nextBtn = document.querySelector(".nosotros-slider .next");
  const dotsContainer = document.querySelector(".nosotros-slider .slider-dots");

  let index = 0;

  // Crear dots
  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    if (i === 0) dot.classList.add("active-dot");
    dot.addEventListener("click", () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });

  const dots = dotsContainer.querySelectorAll("span");

  function showSlide(n) {
    slides.forEach(s => s.classList.remove("active"));
    dots.forEach(d => d.classList.remove("active-dot"));

    slides[n].classList.add("active");
    dots[n].classList.add("active-dot");
  }

  function next() {
    index = (index + 1) % slides.length;
    showSlide(index);
  }

  function prev() {
    index = (index - 1 + slides.length) % slides.length;
    showSlide(index);
  }

  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);

  // Click en dots
  function goToSlide(n) {
    index = n;
    showSlide(index);
  }

  // Auto-slide
  setInterval(next, 5000);
});
