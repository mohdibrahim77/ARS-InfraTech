import './styles.css';
import './theme-times.css';
import './brand.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { company, properties, locations, services, stats, markets, process, partners, commission, testimonials, img } from './data.js';
import { createHero } from './hero3d.js';
import { createBuild, PHASES } from './build3d.js';

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env.DEV) window.__ST = ScrollTrigger;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const icon = (name) => `<svg class="ic"><use href="#i-${name}"/></svg>`;
const fmtIN = new Intl.NumberFormat('en-IN');
const rupees = (n) => `₹${fmtIN.format(Math.round(n))}`;
const shortINR = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : rupees(n));

const mq = (q) => window.matchMedia(q).matches;
const reduced = mq('(prefers-reduced-motion: reduce)');
const finePointer = mq('(hover: hover) and (pointer: fine)');
const mobile = mq('(max-width: 960px)') || !finePointer;

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
})();

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — favourites just won't persist */
    }
  },
};

/* ------------------------------------------------------------------
   Smooth scroll
------------------------------------------------------------------ */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  if (import.meta.env.DEV) window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToTarget(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  const offset = el.id === 'top' ? 0 : -70;
  const targetY = () => (el.id === 'top' ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY + offset));
  if (!lenis) {
    window.scrollTo({ top: targetY(), behavior: reduced ? 'auto' : 'smooth' });
    return;
  }
  // Pixel target (not the element) + a short correction pass, so lazy images or
  // pinned sections that shift layout mid-scroll can't leave us in the wrong place.
  lenis.scrollTo(targetY(), {
    duration: 1.3,
    force: true,
    onComplete: () => {
      const y = targetY();
      if (Math.abs(window.scrollY - y) > 4) lenis.scrollTo(y, { duration: 0.4, force: true });
    },
  });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const el = $(id);
  if (!el) return;
  e.preventDefault();
  closeDrawer();
  if (a.dataset.interest) $('#interest').value = a.dataset.interest;
  scrollToTarget(el);
});

/* ------------------------------------------------------------------
   Preloader + hero intro
------------------------------------------------------------------ */
const preloader = $('#preloader');
const bar = $('#preloader-bar');
let loadPct = 0;
const loadTick = setInterval(() => {
  loadPct = Math.min(loadPct + Math.random() * 18, 90);
  bar.style.width = `${loadPct}%`;
}, 120);

let hero = null;
if (hasWebGL) {
  try {
    hero = createHero($('#hero-canvas'), { mobile, reduced });
  } catch (err) {
    console.warn('Hero 3D unavailable', err);
  }
}
if (!hero) $('#hero').style.background = `linear-gradient(90deg, rgba(8,14,17,.9), rgba(8,14,17,.4)), url(${img('photo-1486406146926-c627a92ad1ab', 1800)}) center/cover`;

function finishLoading() {
  clearInterval(loadTick);
  bar.style.width = '100%';
  setTimeout(() => {
    preloader.classList.add('is-done');
    introHero();
  }, 350);
}
Promise.all([
  document.fonts ? document.fonts.ready : Promise.resolve(),
  new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true }))),
  new Promise((r) => setTimeout(r, 900)),
]).then(finishLoading);
setTimeout(finishLoading, 6000); // never block on a slow asset

let introDone = false;
function introHero() {
  if (introDone) return;
  introDone = true;
  hero?.intro(gsap);
  if (reduced) return;
  $$('.hero__trust strong').forEach((el, i) => {
    const m = el.textContent.match(/^(\D*)([\d,]+)(.*)$/);
    if (!m) return;
    const target = Number(m[2].replace(/,/g, ''));
    const o = { v: 0 };
    gsap.to(o, { v: target, duration: 1.8, delay: 0.9 + i * 0.15, ease: 'power3.out', onUpdate: () => (el.textContent = `${m[1]}${Math.round(o.v)}${m[3]}`) });
  });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__title .word', { yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.08 }, 0.2)
    .from('.hero .eyebrow', { y: 20, opacity: 0, duration: 1 }, 0.1)
    .from('.hero__lead, .hero__ctas, .hero__trust', { y: 30, opacity: 0, duration: 1.2, stagger: 0.1 }, 0.6)
    .from('.search', { y: 60, opacity: 0, rotateX: 12, transformPerspective: 1200, duration: 1.6, clearProps: 'transform' }, 0.5)
    .from('.header', { y: -30, opacity: 0, duration: 1, clearProps: 'transform,opacity' }, 0.3)
    .from('.topbar', { opacity: 0, duration: 1 }, 0.4);
}

if (hero) {
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => hero.setScroll(self.progress),
  });
  new IntersectionObserver(([e]) => hero.setActive(e.isIntersecting), { threshold: 0 }).observe($('#hero'));
  if (!reduced && !mq('(max-width: 960px)')) {
    gsap.to('.hero__content', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true } });
  }
}

/* ------------------------------------------------------------------
   Header, drawer, nav highlighting
------------------------------------------------------------------ */
const header = $('#header');
let lastY = 0;
function onScroll(y) {
  header.classList.toggle('is-scrolled', y > 40);
  const goingDown = y > lastY && y > 700;
  header.classList.toggle('is-hidden', goingDown && !document.body.classList.contains('is-locked'));
  lastY = y;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? y / max : 0;
  $('#to-top').classList.toggle('is-on', y > 800);
  $('#top-ring').style.strokeDashoffset = String(138.2 * (1 - p));
  header.style.setProperty('--progress', p.toFixed(4));
  updateNav();
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
onScroll(window.scrollY);
$('#to-top').addEventListener('click', () => scrollToTarget('#top'));

// Highlight the nav item for whichever section sits under 45% of the viewport.
// Position-based (not enter/leave events) so it is also correct after jumps.
var navCurrent = ''; // var: updateNav() first runs before this line is reached
function updateNav() {
  const navMap = [
    ['hero', 'top'], ['listings', 'listings'], ['featured', 'listings'], ['about', 'about'],
    ['services', 'services'], ['build', 'build'], ['markets', 'markets'],
    ['process', 'about'], ['fees', 'fees'], ['partners', 'about'], ['testimonials', 'about'], ['contact', 'contact'],
  ];
  const line = window.innerHeight * 0.45;
  let current = 'top';
  for (const [sectionId, navId] of navMap) {
    const el = document.getElementById(sectionId);
    if (el && el.getBoundingClientRect().top <= line) current = navId;
  }
  if (current === navCurrent) return;
  navCurrent = current;
  $$('.nav__link').forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === `#${current}`));
}

const drawer = $('#drawer');
function openDrawer() {
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  $('#burger').setAttribute('aria-expanded', 'true');
  lockScroll(true);
}
function closeDrawer() {
  if (!drawer.classList.contains('is-open')) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  $('#burger').setAttribute('aria-expanded', 'false');
  lockScroll(false);
}
$('#burger').addEventListener('click', openDrawer);
$('#drawer-close').addEventListener('click', closeDrawer);
drawer.addEventListener('click', (e) => { if (e.target === drawer) closeDrawer(); });

function lockScroll(on) {
  document.body.classList.toggle('is-locked', on);
  if (lenis) on ? lenis.stop() : lenis.start();
}

/* ------------------------------------------------------------------
   Cursor + magnetic buttons + tilt
------------------------------------------------------------------ */
if (finePointer && !reduced) {
  const cursor = $('.cursor');
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const pos = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    const t = e.target;
    cursor.classList.toggle('is-view', !!t.closest('[data-cursor="view"]'));
    cursor.classList.toggle('is-hover', !!t.closest('a, button, input, select, textarea, label, .pin'));
  }, { passive: true });
  gsap.ticker.add(() => {
    pos.rx += (pos.x - pos.rx) * 0.18;
    pos.ry += (pos.y - pos.ry) * 0.18;
    ring.style.transform = `translate(${pos.rx}px, ${pos.ry}px) translate(-50%, -50%)`;
  });

  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: x * 0.25, y: y * 0.35, duration: 0.6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }));
  });
}

function tilt(el, max = 8) {
  if (!finePointer || reduced) return;
  const glare = el.querySelector('.card__glare');
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transition = 'transform .15s ease-out, box-shadow .5s';
    el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateY(-6px)`;
    if (glare) {
      glare.style.setProperty('--gx', `${px * 100}%`);
      glare.style.setProperty('--gy', `${py * 100}%`);
    }
  });
  el.addEventListener('pointerleave', () => {
    el.style.transition = 'transform .8s cubic-bezier(.22,1,.36,1), box-shadow .5s';
    el.style.transform = '';
  });
}
$$('.tilt').forEach((el) => tilt(el, Number(el.dataset.tilt) || 8));

/* ------------------------------------------------------------------
   Toasts
------------------------------------------------------------------ */
function toast(msg, ic = 'check') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icon(ic)}<span>${msg}</span>`;
  $('#toasts').append(t);
  setTimeout(() => {
    t.classList.add('is-out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, 3200);
}

/* ------------------------------------------------------------------
   Favourites
------------------------------------------------------------------ */
const favs = new Set(store.get('ars-favs', []));
function updateFavBadge(bump = false) {
  const b = $('#fav-count');
  b.textContent = String(favs.size);
  b.classList.toggle('is-on', favs.size > 0);
  if (bump) {
    b.classList.remove('bump');
    void b.offsetWidth;
    b.classList.add('bump');
  }
}
function toggleFav(id, btn) {
  const p = properties.find((x) => x.id === id);
  if (favs.has(id)) {
    favs.delete(id);
    toast(`Removed “${p.title}” from saved`, 'heart');
  } else {
    favs.add(id);
    toast(`Saved “${p.title}”`, 'heart');
  }
  store.set('ars-favs', [...favs]);
  $$(`[data-fav="${id}"]`).forEach((b) => {
    b.classList.toggle('is-on', favs.has(id));
    b.setAttribute('aria-pressed', String(favs.has(id)));
  });
  if (btn) {
    btn.classList.remove('pop');
    void btn.offsetWidth;
    btn.classList.add('pop');
  }
  updateFavBadge(true);
  if (!$('#fav-modal').hidden) renderFavs();
}
updateFavBadge();

/* ------------------------------------------------------------------
   Listings (status chips, area filter from the map, sort, view)
------------------------------------------------------------------ */
const filters = { status: 'All', location: 'All', sort: 'featured' };

const statusClass = (s) => (s === 'For Rent' ? 'ribbon--rent' : s === 'Build to Suit' ? 'ribbon--build' : '');

function metaList(p) {
  return `<ul class="meta">
    <li><strong>${icon('bed')}${p.beds || '—'}</strong>${p.beds ? 'Beds' : 'Open plan'}</li>
    <li><strong>${icon('bath')}${p.baths}</strong>Baths</li>
    <li><strong>${icon('area')}${fmtIN.format(p.area)}</strong>Sq ft</li>
    <li><strong>${icon('car')}${p.parking}</strong>Parking</li>
  </ul>`;
}

function cardHTML(p, i) {
  const on = favs.has(p.id);
  return `<article class="card is-entering" style="--d:${Math.min(i, 8) * 0.06}s">
    <div class="card__media" data-open-property="${p.id}" data-cursor="view">
      <img src="${img(p.images[0], 800)}" alt="${p.title}" loading="lazy" />
      <span class="ribbon ${statusClass(p.status)}">${p.status}</span>
      <button class="heart ${on ? 'is-on' : ''}" data-fav="${p.id}" aria-pressed="${on}" aria-label="Save ${p.title}">${icon('heart')}</button>
      <span class="card__dev">${p.developer}</span>
      <span class="card__photos">${p.images.length} photos</span>
      <span class="card__view">View details ${icon('arrow')}</span>
      <span class="card__glare"></span>
    </div>
    <div class="price-strip"><strong>${p.priceLabel}</strong><span>${p.type} · ${p.category}</span></div>
    <div class="card__body">
      <h3 class="card__title"><button data-open-property="${p.id}">${p.title}</button></h3>
      <p class="card__loc">${icon('pin')}${p.location}, Bengaluru</p>
      <p class="card__excerpt">${p.excerpt}</p>
    </div>
    ${metaList(p)}
  </article>`;
}

function applyFilters() {
  const list = properties.filter((p) =>
    (filters.status === 'All' || p.status === filters.status) &&
    (filters.location === 'All' || p.location === filters.location)
  );
  const sorters = {
    featured: (a, b) => Number(b.featured) - Number(a.featured),
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    'area-desc': (a, b) => b.area - a.area,
    newest: (a, b) => b.year - a.year,
  };
  return [...list].sort(sorters[filters.sort]);
}

function renderListings() {
  const list = applyFilters();
  const wrap = $('#cards');
  wrap.innerHTML = list.map(cardHTML).join('');
  $$('.card', wrap).forEach((c) => tilt(c, 6));
  $('#empty').hidden = list.length > 0;
  $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'property' : 'properties'}`;
  $$('#status-chips .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.status === filters.status));
  $('#active-filters').innerHTML = filters.location !== 'All'
    ? `<span class="tag">${filters.location}<button data-clear="location" aria-label="Remove ${filters.location} filter">${icon('close')}</button></span>`
    : '';
  ScrollTrigger.refresh();
}

function resetFilters() {
  Object.assign(filters, { status: 'All', location: 'All' });
  renderListings();
}

$('#status-chips').addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (!c) return;
  filters.status = c.dataset.status;
  renderListings();
});
$('#sort').addEventListener('change', (e) => {
  filters.sort = e.target.value;
  renderListings();
});
$$('.view-toggle .icon-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.view-toggle .icon-btn').forEach((x) => x.classList.toggle('is-active', x === b));
  $('#cards').dataset.view = b.dataset.view;
  renderListings();
}));
$('#active-filters').addEventListener('click', (e) => {
  if (!e.target.closest('[data-clear]')) return;
  filters.location = 'All';
  renderListings();
});
$('#reset-filters').addEventListener('click', resetFilters);

/* ------------------------------------------------------------------
   Hero "Send a query" form → WhatsApp
------------------------------------------------------------------ */
{
  const form = $('#query');
  $('#query-location').insertAdjacentHTML('beforeend', locations.map((l) => `<option>${l}</option>`).join(''));
  const budgets = {
    Buy: ['Flexible', 'Under ₹1 Cr', '₹1 – 2 Cr', '₹2 – 5 Cr', 'Above ₹5 Cr'],
    Rent: ['Flexible', 'Under ₹50,000 / month', '₹50,000 – 1 L / month', 'Above ₹1 L / month'],
    Build: ['Flexible', 'Under ₹1 Cr', '₹1 – 3 Cr', 'Above ₹3 Cr'],
    Invest: ['Flexible', 'Under ₹2 Cr', '₹2 – 10 Cr', 'Above ₹10 Cr'],
  };
  let intent = 'Buy';
  function setIntent(next) {
    intent = next;
    const tabs = $$('.search__tab', form);
    const idx = tabs.findIndex((t) => t.dataset.intent === next);
    tabs.forEach((t, i) => {
      t.classList.toggle('is-active', i === idx);
      t.setAttribute('aria-checked', String(i === idx));
    });
    $('.search__tab-ink', form).style.transform = `translateX(${idx * 100}%)`;
    $('#query-budget').innerHTML = budgets[next].map((b) => `<option>${b}</option>`).join('');
  }
  $$('.search__tab', form).forEach((t) => t.addEventListener('click', () => setIntent(t.dataset.intent)));
  setIntent('Buy');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const lines = [
      'Hello A.R.S Infratech, I have a query.',
      '',
      `Name: ${form.name.value.trim()}`,
      `Phone: ${form.phone.value.trim()}`,
      `Looking to: ${intent}`,
      `Preferred location: ${form.location.value}`,
      `Budget: ${form.budget.value}`,
    ];
    if (form.message.value.trim()) lines.push('', form.message.value.trim());
    window.open(`https://wa.me/${company.phoneRaw}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    toast('Opening WhatsApp — an advisor will reply shortly');
    form.reset();
    setIntent('Buy');
  });
}

// global delegation: favourites + open property
document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.preventDefault();
    e.stopPropagation();
    toggleFav(fav.dataset.fav, fav);
    return;
  }
  const open = e.target.closest('[data-open-property]');
  if (open && !$('#rail').classList.contains('was-dragged')) {
    e.preventDefault();
    openProperty(open.dataset.openProperty);
  }
});

renderListings();

/* ------------------------------------------------------------------
   Modals
------------------------------------------------------------------ */
let lastFocus = null;
function openModal(id) {
  const m = $(`#${id}`);
  lastFocus = document.activeElement;
  m.hidden = false;
  lockScroll(true);
  closeDrawer();
  setTimeout(() => m.querySelector('.modal__close')?.focus(), 50);
}
function closeModal(m) {
  m.hidden = true;
  if (!$$('.modal').some((x) => !x.hidden)) lockScroll(false);
  lastFocus?.focus?.();
}
$$('.modal').forEach((m) => m.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModal(m);
}));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = $$('.modal').filter((m) => !m.hidden).pop();
  if (open) closeModal(open);
  else closeDrawer();
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-open]');
  if (b) openModal(b.dataset.open);
});

function openProperty(id) {
  const p = properties.find((x) => x.id === id);
  if (!p) return;
  const on = favs.has(p.id);
  const waText = encodeURIComponent(`Hi A.R.S Infratech, I'm interested in "${p.title}" (${p.location}, ${p.priceLabel}). Please share more details.`);
  $('#pm').innerHTML = `
    <div class="pm__gallery">
      <div class="pm__main"><img id="pm-main" src="${img(p.images[0], 1400)}" alt="${p.title}" /></div>
      <div class="pm__thumbs">${p.images.map((im, i) => `<button class="${i === 0 ? 'is-active' : ''}" data-img="${im}" aria-label="Photo ${i + 1}"><img src="${img(im, 300)}" alt="" loading="lazy" /></button>`).join('')}</div>
    </div>
    <div class="pm__info">
      <span class="ribbon ${statusClass(p.status)}" style="position:static;display:inline-block">${p.status}</span>
      <h3 id="pm-title">${p.title}</h3>
      <p class="card__loc">${icon('pin')}${p.location}, Bengaluru · ${p.developer}</p>
      <div class="pm__price"><strong>${p.priceLabel}</strong><span>${p.type} · ${p.category}</span></div>
      ${metaList(p)}
      <p style="margin-top:20px">${p.excerpt}</p>
      <ul class="amen">${p.amenities.map((a) => `<li>${icon('check')}${a}</li>`).join('')}</ul>
      <div class="pm__actions">
        <button class="btn btn--primary" id="pm-enquire">${icon('mail')} Enquire now</button>
        <a class="btn btn--wa" href="https://wa.me/${company.phoneRaw}?text=${waText}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>
        <button class="btn btn--ghost-dark ${on ? 'is-on' : ''}" data-fav="${p.id}" aria-pressed="${on}">${icon('heart')} ${on ? 'Saved' : 'Save'}</button>
        <a class="btn btn--ghost-dark" href="tel:+${company.phoneRaw}">${icon('phone')} Call</a>
      </div>
    </div>`;
  $$('.pm__thumbs button').forEach((b) => b.addEventListener('click', () => {
    $$('.pm__thumbs button').forEach((x) => x.classList.toggle('is-active', x === b));
    const main = $('#pm-main');
    main.src = img(b.dataset.img, 1400);
    main.style.animation = 'none';
    void main.offsetWidth;
    main.style.animation = '';
  }));
  $('#pm-enquire').addEventListener('click', () => {
    const f = $('#contact-form');
    f.interest.value = p.status === 'For Rent' ? 'Renting / leasing' : p.category === 'Construction' ? 'Construction services' : 'Buying a property';
    f.message.value = `I'm interested in ${p.title} (${p.location}, ${p.priceLabel}). Please share availability and a site-visit slot.`;
    closeModal($('#property-modal'));
    scrollToTarget('#contact');
    setTimeout(() => f.name.focus({ preventScroll: true }), 1400);
  });
  // keep the Save button label in sync
  const saveBtn = $('#pm [data-fav]');
  saveBtn.addEventListener('click', () => setTimeout(() => {
    const isOn = favs.has(p.id);
    saveBtn.innerHTML = `${icon('heart')} ${isOn ? 'Saved' : 'Save'}`;
  }));
  $('#pm .meta').style.marginTop = '0';
  openModal('property-modal');
}

function renderFavs() {
  const list = properties.filter((p) => favs.has(p.id));
  $('#fav-list').innerHTML = list.length
    ? list.map((p) => `<div class="fav-item">
        <img src="${img(p.images[0], 240)}" alt="" />
        <button style="text-align:left" data-open-property="${p.id}"><strong>${p.title}</strong><small>${p.location} · ${p.priceLabel}</small></button>
        <button class="icon-btn" data-fav="${p.id}" aria-label="Remove">${icon('close')}</button>
      </div>`).join('')
    : `<p class="fav-empty">Tap the ${icon('heart')} on any property to save it here.</p>`;
}
$('#fav-open').addEventListener('click', () => {
  renderFavs();
  openModal('fav-modal');
});
$('#fav-list').addEventListener('click', (e) => {
  if (e.target.closest('[data-open-property]')) closeModal($('#fav-modal'));
});

/* ------------------------------------------------------------------
   Hot properties rail
------------------------------------------------------------------ */
const rail = $('#rail');
const featured = properties.filter((p) => p.featured).concat(properties.filter((p) => !p.featured).slice(0, 2));
rail.innerHTML = featured.map((p) => `
  <article class="feat" data-open-property="${p.id}" data-cursor="view">
    <img src="${img(p.images[0], 900)}" alt="${p.title}" loading="lazy" draggable="false" />
    <div class="feat__top"><span class="feat__chip">${p.status}</span><button class="heart ${favs.has(p.id) ? 'is-on' : ''}" style="position:static" data-fav="${p.id}" aria-label="Save ${p.title}">${icon('heart')}</button></div>
    <div class="feat__body">
      <div class="feat__dev">${p.developer}</div>
      <h3 class="feat__title">${p.title}</h3>
      <div class="feat__loc">${icon('pin')}${p.location}</div>
      <div class="feat__row"><span class="feat__price">${p.priceLabel}</span><span class="feat__go">${icon('arrow-up-right')}</span></div>
    </div>
  </article>`).join('');
$$('.feat', rail).forEach((f) => tilt(f, 7));

function railStep() {
  const card = $('.feat', rail);
  return card ? card.getBoundingClientRect().width + 24 : 400;
}
$('#feat-next').addEventListener('click', () => rail.scrollBy({ left: railStep(), behavior: 'smooth' }));
$('#feat-prev').addEventListener('click', () => rail.scrollBy({ left: -railStep(), behavior: 'smooth' }));
function railProgress() {
  const max = rail.scrollWidth - rail.clientWidth;
  const vis = rail.clientWidth / rail.scrollWidth;
  const pr = max > 0 ? rail.scrollLeft / max : 0;
  const el = $('#rail-progress');
  el.style.width = `${Math.max(vis * 100, 12)}%`;
  el.style.transform = `translateX(${pr * (100 / Math.max(vis, 0.12) - 100)}%)`;
}
rail.addEventListener('scroll', railProgress, { passive: true });
railProgress();

// mouse drag-to-scroll (touch already scrolls natively)
{
  let down = false;
  let startX = 0;
  let startLeft = 0;
  let moved = 0;
  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true;
    moved = 0;
    startX = e.clientX;
    startLeft = rail.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 6) rail.classList.add('is-dragging');
    rail.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    if (moved > 6) {
      // settle on the next card in the drag direction (a short flick still advances)
      const dx = startLeft - rail.scrollLeft;
      const step = railStep();
      const cards = Math.round(-dx / step + Math.sign(-dx) * 0.35);
      rail.scrollTo({ left: startLeft + cards * step, behavior: reduced ? 'auto' : 'smooth' });
      setTimeout(() => rail.classList.remove('is-dragging'), 450);
    } else {
      rail.classList.remove('is-dragging');
    }
    if (moved > 6) {
      rail.classList.add('was-dragged');
      setTimeout(() => rail.classList.remove('was-dragged'), 50);
    }
  });
}

/* ------------------------------------------------------------------
   Stats counters
------------------------------------------------------------------ */
$('#stats').innerHTML = stats.map((s) => `
  <div class="stat"><div class="stat__num">${s.prefix ? `<span class="unit">${s.prefix}</span>` : ''}<span data-count="${s.value}">0</span><span class="unit">${s.suffix}</span></div><div class="stat__label">${s.label}</div></div>`).join('');
ScrollTrigger.create({
  trigger: '#stats',
  start: 'top 85%',
  once: true,
  onEnter: () => {
    $$('#stats .stat').forEach((s, i) => setTimeout(() => s.classList.add('is-in'), i * 150));
    $$('[data-count]').forEach((el) => {
      const o = { v: 0 };
      gsap.to(o, { v: Number(el.dataset.count), duration: reduced ? 0 : 2.2, ease: 'power3.out', onUpdate: () => (el.textContent = fmtIN.format(Math.round(o.v))) });
    });
  },
});

/* ------------------------------------------------------------------
   Services
------------------------------------------------------------------ */
$('#services-grid').innerHTML = services.map((s, i) => `
  <article class="service" tabindex="0">
    <div class="service__bg"><img src="${img(s.image, 700)}" alt="" loading="lazy" /></div>
    <span class="service__num">0${i + 1}</span>
    <div class="service__icon">${icon(s.icon)}</div>
    <h3>${s.title}</h3>
    <p>${s.text}</p>
    <ul>${s.points.map((x) => `<li>${x}</li>`).join('')}</ul>
  </article>`).join('');
$$('.service').forEach((s) => tilt(s, 10));

/* ------------------------------------------------------------------
   3D construction sequence (pinned)
------------------------------------------------------------------ */
{
  let build = null;
  if (hasWebGL) {
    try {
      build = createBuild($('#build-canvas'), { mobile });
    } catch (err) {
      console.warn('Build 3D unavailable', err);
    }
  }
  if (!build) $('.build__pin').style.background = `linear-gradient(90deg, rgba(11,18,21,.95) 30%, rgba(11,18,21,.4)), url(${img('photo-1541888946425-d81bb19240f5', 1600)}) center/cover`;

  const steps = $$('#build-steps li');
  const pct = $('#build-pct');
  const label = $('#build-label');
  const barEl = $('#build-bar');
  let lastStep = -1;
  function update(p) {
    build?.setProgress(p);
    pct.textContent = `${Math.round(p * 100)}%`;
    barEl.style.width = `${p * 100}%`;
    let phase = PHASES[0];
    for (const ph of PHASES) if (p >= ph.at) phase = ph;
    if (p < 0.02) label.textContent = 'Ground breaking';
    else if (phase.step === 1) label.textContent = `Floor ${Math.min(12, Math.max(1, Math.ceil(((p - 0.18) / 0.37) * 12)))} of 12`;
    else label.textContent = phase.label;
    if (phase.step !== lastStep) {
      lastStep = phase.step;
      steps.forEach((li, i) => {
        li.classList.toggle('is-active', i === phase.step);
        li.classList.toggle('is-done', i < phase.step);
      });
    }
  }
  update(0);

  ScrollTrigger.create({
    trigger: '#build',
    start: 'top top',
    end: () => `+=${window.innerHeight * (mobile ? 2.4 : 3.2)}`,
    pin: '.build__pin',
    scrub: reduced ? true : 0.6,
    anticipatePin: 1,
    onUpdate: (self) => update(self.progress),
  });
  if (build) new IntersectionObserver(([e]) => build.setActive(e.isIntersecting), { threshold: 0 }).observe($('.build__pin'));
}

/* ------------------------------------------------------------------
   Micro-markets
------------------------------------------------------------------ */
{
  const pins = $('#map-pins');
  const maxGrowth = Math.max(...markets.map((m) => m.growth));
  const maxRate = Math.max(...markets.map((m) => m.rate));
  pins.innerHTML = markets.map((m, i) => `
    <button class="pin" style="left:${m.x}%;top:${m.y}%" data-market="${i}" aria-label="${m.name}">
      <span class="pin__dot"></span><span class="pin__label">${m.name}</span>
    </button>`).join('');
  function showMarket(i) {
    const m = markets[i];
    $$('.pin', pins).forEach((p, j) => p.classList.toggle('is-active', i === j));
    const count = properties.filter((p) => p.location === m.name).length;
    $('#market-card').innerHTML = `
      <span class="market-card__k">Micro-market snapshot</span>
      <h3>${m.name}</h3>
      <p>${m.note}</p>
      <div class="kpis">
        <div class="kpi"><small>Avg. price</small><strong>₹${fmtIN.format(m.rate)}</strong><small>per sq ft</small><div class="bar-track"><span style="width:${(m.rate / maxRate) * 100}%"></span></div></div>
        <div class="kpi kpi--up"><small>YoY growth</small><strong>▲ ${m.growth}%</strong><small>capital value</small><div class="bar-track"><span style="width:${(m.growth / maxGrowth) * 100}%"></span></div></div>
        <div class="kpi"><small>Rental yield</small><strong>${m.yield}%</strong><small>gross, annual</small></div>
        <div class="kpi"><small>Metro</small><strong style="font-size:1rem">${m.metro}</strong></div>
      </div>
      ${count
        ? `<button class="btn btn--primary" data-market-go="${m.name}">View ${count} ${count === 1 ? 'listing' : 'listings'} in ${m.name} ${icon('arrow')}</button>`
        : `<a href="#contact" class="btn btn--ghost-dark">Ask about ${m.name} ${icon('arrow')}</a>`}`;
    if (!reduced) gsap.from('#market-card > *', { y: 16, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
  }
  pins.addEventListener('click', (e) => {
    const p = e.target.closest('[data-market]');
    if (p) showMarket(Number(p.dataset.market));
  });
  $('#market-card').addEventListener('click', (e) => {
    const b = e.target.closest('[data-market-go]');
    if (!b) return;
    resetFilters();
    filters.location = b.dataset.marketGo;
    renderListings();
    scrollToTarget('#listings');
  });
  showMarket(0);
}

/* ------------------------------------------------------------------
   Process timeline
------------------------------------------------------------------ */
{
  const list = $('#process-list');
  list.insertAdjacentHTML('beforeend', process.map((s, i) => `
    <div class="step"><div class="step__num">0${i + 1}</div><h3>${s.title}</h3><p>${s.text}</p></div>`).join(''));
  const stepsEls = $$('.step', list);
  const vertical = () => mq('(max-width: 960px)');
  ScrollTrigger.create({
    trigger: list,
    start: 'top 75%',
    end: 'bottom 55%',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      $('#process-line').style.transform = vertical() ? `scaleY(${p})` : `scaleX(${p})`;
      stepsEls.forEach((s, i) => s.classList.toggle('is-on', p >= i / (stepsEls.length - 1) - 0.02));
    },
  });
}

/* ------------------------------------------------------------------
   Partners marquee
------------------------------------------------------------------ */
// Logo files live in /public/partners/<slug>.png — until one exists the tile shows a clean wordmark.
const partnerTile = (p) => `<span class="partner" title="${p.name}">
    <img src="/partners/${p.slug}.png" alt="${p.name}" loading="lazy" onerror="this.remove()" />
    <span class="partner__word">${p.name}</span>
  </span>`;
$('#marquee').innerHTML = [...partners, ...partners].map(partnerTile).join('');
$$('#marquee .partner img').forEach((im) => {
  const ok = () => im.parentElement?.classList.add('has-logo');
  if (im.complete && im.naturalWidth) ok();
  else im.addEventListener('load', ok, { once: true });
});
$('#footer-partners').textContent = `Partnered with ${partners.map((p) => p.short || p.name).join(' · ')}`;

/* ------------------------------------------------------------------
   Commission structure
------------------------------------------------------------------ */
$('#fees-grid').innerHTML = commission.groups.map((g, i) => `
  <article class="fee">
    <header class="fee__head"><span class="fee__ic">${icon(g.icon)}</span><h3>${g.title}</h3><span class="fee__num">0${i + 1}</span></header>
    ${g.subtitle ? `<p class="fee__sub">${g.subtitle}</p>` : ''}
    <dl class="fee__rows">${g.rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
  </article>`).join('');
$('#fees-note').textContent = commission.note;

/* ------------------------------------------------------------------
   Testimonials
------------------------------------------------------------------ */
{
  const slides = $('#testi-slides');
  const dots = $('#testi-dots');
  slides.innerHTML = testimonials.map((t, i) => `
    <figure class="slide ${i === 0 ? 'is-active' : ''}" style="margin:0">
      <blockquote>${t.quote}</blockquote>
      <figcaption class="slide__who"><span class="avatar">${t.name.split(' ').map((w) => w[0]).filter((c) => /[A-Z]/.test(c)).slice(0, 2).join('')}</span><span><strong>${t.name}</strong><small>${t.title}</small></span></figcaption>
    </figure>`).join('');
  dots.innerHTML = testimonials.map((_, i) => `<button class="${i === 0 ? 'is-active' : ''}" aria-label="Testimonial ${i + 1}"></button>`).join('');
  let idx = 0;
  let timer = null;
  function go(n) {
    idx = (n + testimonials.length) % testimonials.length;
    $$('.slide', slides).forEach((s, i) => s.classList.toggle('is-active', i === idx));
    $$('button', dots).forEach((d, i) => {
      d.classList.remove('is-active');
      if (i === idx) {
        void d.offsetWidth;
        d.classList.add('is-active');
      }
    });
    restart();
  }
  function restart() {
    clearInterval(timer);
    if (!reduced) timer = setInterval(() => go(idx + 1), 6000);
  }
  $('#testi-next').addEventListener('click', () => go(idx + 1));
  $('#testi-prev').addEventListener('click', () => go(idx - 1));
  dots.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) go($$('button', dots).indexOf(b));
  });
  restart();
}

/* ------------------------------------------------------------------
   Forms → WhatsApp / email (no backend required)
------------------------------------------------------------------ */
function validate(form) {
  let ok = true;
  $$('[required]', form).forEach((el) => {
    let valid = el.value.trim().length > 0;
    if (valid && el.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim());
    if (valid && el.type === 'tel') valid = el.value.replace(/\D/g, '').length >= 10;
    el.closest('.field').classList.toggle('is-invalid', !valid);
    if (!valid && ok) {
      ok = false;
      el.focus();
    }
  });
  if (!ok) toast('Please complete the highlighted fields', 'close');
  return ok;
}
$$('form.form').forEach((f) => f.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid')));

function contactMessage(f) {
  return `Hello A.R.S Infratech,\n\nName: ${f.name.value}\nPhone: ${f.phone.value}\nEmail: ${f.email.value}\nInterested in: ${f.interest.value}\n\n${f.message.value}`;
}
$('#contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!validate(f)) return;
  window.open(`https://wa.me/${company.phoneRaw}?text=${encodeURIComponent(contactMessage(f))}`, '_blank', 'noopener');
  toast('Opening WhatsApp — an advisor will reply shortly');
  f.reset();
});
$('#send-email').addEventListener('click', () => {
  const f = $('#contact-form');
  if (!validate(f)) return;
  window.open(`mailto:${company.email}?subject=${encodeURIComponent(`Enquiry: ${f.interest.value}`)}&body=${encodeURIComponent(contactMessage(f))}`, '_self');
  toast('Opening your email app');
});
$('#list-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!validate(f)) return;
  const text = `Hello A.R.S Infratech, I'd like to ${f.intent.value.toLowerCase()} my property.\n\nName: ${f.name.value}\nPhone: ${f.phone.value}\nType: ${f.ptype.value}\nLocation: ${f.location.value}\n${f.details.value}`;
  window.open(`https://wa.me/${company.phoneRaw}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  toast('Opening WhatsApp with your listing details');
  f.reset();
  closeModal($('#list-modal'));
});

/* ------------------------------------------------------------------
   Reveal-on-scroll, headline word reveals, staggered grids, parallax.
   Everything animates transform / opacity / clip-path only and runs once.
------------------------------------------------------------------ */
{
  const once = (els, onIn, margin = '0px 0px -8% 0px') => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        onIn(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: margin });
    els.forEach((el) => io.observe(el));
  };

  // 1. blocks that fade + rise
  const targets = $$('.section-head > div > .eyebrow, .section-head__lead, .about__copy > p, .about__copy .ticks, .about__media, .map, .market-card, .fees__note, .contact__info > p, .contact__map, #contact-form, .testi__photo, .testi__body, .partners__head, .cta-band__inner > *, .footer__cta-actions, .build__copy > .eyebrow');
  targets.forEach((el, i) => {
    el.setAttribute('data-reveal', '');
    el.style.setProperty('--d', `${(i % 3) * 0.08}s`);
  });

  // 2. grids reveal their children one after another
  ['.stats', '.services', '.fees', '.process', '.contact__list', '.footer__grid'].forEach((sel) => {
    $$(`${sel} > :not(.process__line)`).forEach((el, i) => {
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--d', `${Math.min(i, 6) * 0.09}s`);
      targets.push(el);
    });
  });
  once(targets, (el) => el.classList.add('is-in'));

  // 3. headlines: split into words that rise into place
  const headlines = $$('.section-head .h2, .about__copy .h2, .testi__head .h2, .build__copy .h2, .cta-band .h2, .footer__cta-title');
  if (!reduced) {
    headlines.forEach((h) => {
      let i = 0;
      const walk = (node) => {
        [...node.childNodes].forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.append(part); return; }
              const outer = document.createElement('span');
              const inner = document.createElement('span');
              outer.className = 'wrd';
              inner.textContent = part;
              inner.style.setProperty('--i', i++);
              outer.append(inner);
              frag.append(outer);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            walk(n);
          }
        });
      };
      walk(h);
    });
    once(headlines, (h) => h.classList.add('is-words-in'), '0px 0px -12% 0px');
  }

  // 4. about photos wipe in; map pins drop in one by one
  $$('.pin').forEach((pin, i) => pin.style.setProperty('--i', i));
  // (observe the container: a fully clipped image has no visible area, so it would never "intersect")
  once($$('.about__media'), (el) => $$('.about__img', el).forEach((im) => im.classList.add('is-in')), '0px 0px -15% 0px');

  // 5. scroll-linked parallax (desktop + phone; transform only)
  if (!reduced) {
    $$('[data-parallax]').forEach((el) => {
      gsap.fromTo(el, { yPercent: -Number(el.dataset.parallax) }, { yPercent: Number(el.dataset.parallax), ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.from('.footer__giant', { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.fromTo('.cta-band', { backgroundPosition: '0% 50%' }, { backgroundPosition: '100% 50%', ease: 'none', scrollTrigger: { trigger: '.cta-band', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}

updateNav();
$('#year').textContent = String(new Date().getFullYear());
window.addEventListener('load', () => ScrollTrigger.refresh());
