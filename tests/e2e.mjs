// End-to-end checks for the A.R.S Infratech site.
// Usage: start the dev server (npm run dev), then: node tests/e2e.mjs
// Env: BASE_URL (default http://localhost:5173), SHOTS_DIR (optional screenshots folder)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
// Site content comes from the project files, so the suite runs against dev, preview or the live site.
const loadData = () => import(new URL('../src/data.js', import.meta.url).href);
const SHOTS = process.env.SHOTS_DIR || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(suite, name, ok, detail = '') {
  results.push({ suite, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${suite}] ${name}${detail ? ` — ${detail}` : ''}`);
}
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function openPage(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1440, height: 900 },
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
    deviceScaleFactor: opts.mobile ? 2 : 1,
    reducedMotion: opts.reducedMotion || 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => {
    const u = r.url();
    // third-party map tiles / fonts may be aborted when the page closes; only flag our own + images
    if (u.startsWith(BASE) || u.includes('images.unsplash.com')) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`);
  });
  // capture outbound WhatsApp / mailto hand-offs instead of opening them
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (url, target) => { window.__opened.push({ url: String(url), target }); return null; };
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#preloader.is-done', { timeout: 8000 }).catch(() => {});
  return { context, page, errors };
}

const scrollToEl = (page, sel, offset = 0) =>
  page.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + o);
  }, [sel, offset]);
const topOf = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
const count = (page, sel) => page.$$eval(sel, (els) => els.length);
const visible = (page, sel) => page.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden').catch(() => false);

async function scrollWholePage(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    if (await page.evaluate(() => { const r = document.getElementById('rail').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })) {
      // the carousel lazy-loads sideways: sweep it so every card's photo is requested
      for (let x = 0; x <= 6000; x += 300) { await page.$eval('#rail', (r, v) => { r.scrollLeft = v; }, x); await sleep(40); }
      await page.$eval('#rail', (r) => { r.scrollLeft = 0; });
    }
    await sleep(60);
  }
  await sleep(2500);
}
// An image is broken if it finished loading with no pixels; lazy images never reached are not "broken".
const brokenImages = (page) => page.$$eval('img', (imgs) => imgs.filter((i) => (i.complete && i.naturalWidth === 0) || (!i.complete && i.loading !== 'lazy')).map((i) => i.currentSrc || i.src));

/* ============================================================
   DESKTOP
============================================================ */
async function desktop(browser) {
  const S = 'desktop';
  const { context, page, errors } = await openPage(browser);
  const data = await loadData();

  check(S, 'title', (await page.title()).includes('A.R.S Infratech'));
  const logos = await page.$$eval('.header .logo img', (imgs) => imgs.map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })));
  check(S, 'brand logo in header loads (navy on white)', logos.length === 2 && logos.every((l) => l.ok && l.src.includes('navy')), JSON.stringify(logos));
  check(S, 'favicon is the brand mark', (await page.$eval('link[rel=icon]', (l) => l.getAttribute('href'))) === '/brand/favicon.png');
  check(S, 'EMI calculator removed', !(await page.$('#emi')) && !(await page.$('a[href="#emi"]')));
  check(S, 'Spaces-we-have-shaped gallery removed', !(await page.$('#bento')) && !(await page.$('.gallery')));
  check(S, 'old property search removed', !(await page.$('#search')));
  check(S, 'preloader hides', await page.$('#preloader.is-done'));
  await sleep(3500); // hero intro
  await shot(page, 'd01-hero');

  // 3D hero canvas actually drew something
  const heroPixels = await page.evaluate(() => {
    const c = document.getElementById('hero-canvas');
    return c.width > 0 && c.height > 0;
  });
  check(S, 'hero canvas sized', heroPixels);

  // horizontal overflow
  check(S, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  // images (scroll everything into view to trigger lazy loading)
  await scrollWholePage(page);
  const broken = await brokenImages(page);
  check(S, 'all images load', broken.length === 0, broken.join(', '));
  const flogos = await page.$$eval('.footer .logo img', (imgs) => imgs.map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })));
  check(S, 'brand logo in footer loads (gold on charcoal)', flogos.length === 2 && flogos.every((l) => l.ok && l.src.includes('gold')), JSON.stringify(flogos));
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);

  // ---- nav links
  const navTargets = await page.$$eval('.nav__link', (as) => as.map((a) => a.getAttribute('href')));
  for (const href of navTargets) {
    if (href === '#top') continue;
    await page.click(`.nav__link[href="${href}"]`);
    await sleep(1900);
    const t = await topOf(page, href);
    check(S, `nav ${href} scrolls to section`, t > -40 && t < 160, `top=${Math.round(t)}`);
    const active = await page.$eval('.nav__link.is-active', (a) => a.getAttribute('href')).catch(() => null);
    check(S, `nav ${href} highlighted`, active === href, `active=${active}`);
  }
  await page.click('.logo');
  await sleep(1900);
  check(S, 'logo returns to top', (await page.evaluate(() => window.scrollY)) < 20);

  // ---- header behaviour
  await page.mouse.wheel(0, 1600);
  await sleep(1200);
  check(S, 'header gets scrolled state', await page.$('.header.is-scrolled'));
  check(S, 'header hides when scrolling down', await page.$('.header.is-hidden'));
  await page.mouse.wheel(0, -300);
  await sleep(900);
  check(S, 'header returns when scrolling up', !(await page.$('.header.is-hidden')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(800);

  // ---- hero "Send a query" form
  await page.evaluate(() => { window.__opened = []; });
  await page.click('#query .search__submit');
  await sleep(300);
  check(S, 'query: empty submit blocked', (await count(page, '#query .field.is-invalid')) === 2 && (await page.evaluate(() => window.__opened.length)) === 0);
  const buyBudgets = await page.$$eval('#query-budget option', (o) => o.map((x) => x.textContent));
  await page.click('#query .search__tab[data-intent="Rent"]');
  await sleep(200);
  const rentBudgets = await page.$$eval('#query-budget option', (o) => o.map((x) => x.textContent));
  check(S, 'query: tab switches budget ranges', rentBudgets.some((b) => b.includes('month')) && !buyBudgets.some((b) => b.includes('month')));
  check(S, 'query: tab state is accessible', (await page.$eval('#query .search__tab[data-intent="Rent"]', (t) => t.getAttribute('aria-checked'))) === 'true');
  check(S, 'query: locations listed', (await count(page, '#query-location option')) === data.locations.length + 1);
  await page.fill('#query [name=name]', 'Asha Rao');
  await page.fill('#query [name=phone]', '98450 11111');
  await page.selectOption('#query-location', 'Whitefield');
  await page.selectOption('#query-budget', rentBudgets[2]);
  await page.fill('#query [name=message]', '2 BHK, semi-furnished');
  await page.click('#query .search__submit');
  await sleep(300);
  const q = await page.evaluate(() => window.__opened.at(-1));
  const qText = q ? decodeURIComponent(q.url) : '';
  check(S, 'query: opens WhatsApp to ARS with all details', q && q.url.startsWith('https://wa.me/918660332979') && ['Asha Rao', '98450 11111', 'Looking to: Rent', 'Whitefield', rentBudgets[2], '2 BHK, semi-furnished'].every((t) => qText.includes(t)), qText.slice(0, 160));
  check(S, 'query: form resets to Buy', (await page.$eval('#query [name=name]', (i) => i.value)) === '' && (await page.$eval('#query .search__tab.is-active', (t) => t.dataset.intent)) === 'Buy');
  check(S, 'query: call link', (await page.$eval('.query__alt a', (a) => a.getAttribute('href'))) === 'tel:+918660332979');
  await shot(page, 'd01b-query');

  // ---- listings: empty state + reset (area picked on the map + a status with no match there)
  const emptyCombo = (() => {
    for (const m of data.markets) for (const st of ['For Sale', 'For Rent', 'Build to Suit'])
      if (data.properties.some((p) => p.location === m.name) && !data.properties.some((p) => p.location === m.name && p.status === st)) return { i: data.markets.indexOf(m), st };
  })();
  await page.evaluate(() => document.getElementById('markets').scrollIntoView());
  await sleep(1200);
  await page.click(`.pin[data-market="${emptyCombo.i}"]`);
  await page.click('[data-market-go]');
  await sleep(1900);
  await page.click(`#status-chips [data-status="${emptyCombo.st}"]`);
  await sleep(300);
  check(S, 'empty state shown', await visible(page, '#empty'));
  await page.click('#reset-filters');
  await sleep(300);
  check(S, 'reset restores all listings', (await count(page, '#cards .card')) === data.properties.length);
  check(S, 'reset clears area tag', (await text(page, '#active-filters')) === '');

  // status chips
  for (const st of ['For Sale', 'For Rent', 'Build to Suit']) {
    await page.click(`#status-chips [data-status="${st}"]`);
    await sleep(250);
    const ribbons = await page.$$eval('#cards .ribbon', (r) => r.map((x) => x.textContent.trim()));
    const exp = data.properties.filter((p) => p.status === st).length;
    check(S, `chip "${st}"`, ribbons.length === exp && ribbons.every((r) => r === st), `${ribbons.length} vs ${exp}`);
  }
  await page.click('#status-chips [data-status="All"]');

  // sorting
  const titlesNow = () => page.$$eval('#cards .card__title', (t) => t.map((x) => x.textContent.trim()));
  await page.selectOption('#sort', 'price-asc');
  await sleep(250);
  const asc = [...data.properties].sort((a, b) => a.price - b.price).map((p) => p.title);
  check(S, 'sort price low→high', JSON.stringify(await titlesNow()) === JSON.stringify(asc));
  await page.selectOption('#sort', 'price-desc');
  await sleep(250);
  check(S, 'sort price high→low', JSON.stringify(await titlesNow()) === JSON.stringify([...asc].reverse()));
  await page.selectOption('#sort', 'area-desc');
  await sleep(250);
  const areas = await page.evaluate(() => [...document.querySelectorAll('#cards .meta li:nth-child(3) strong')].map((s) => Number(s.textContent.replace(/\D/g, ''))));
  check(S, 'sort largest first', areas.every((a, i) => i === 0 || areas[i - 1] >= a));
  await page.selectOption('#sort', 'featured');

  // view toggle
  await page.click('.view-toggle [data-view="list"]');
  await sleep(300);
  check(S, 'list view', (await page.$eval('#cards', (c) => c.dataset.view)) === 'list');
  await shot(page, 'd02-list-view');
  await page.click('.view-toggle [data-view="grid"]');
  await sleep(300);
  check(S, 'grid view', (await page.$eval('#cards', (c) => c.dataset.view)) === 'grid');

  // ---- favourites
  await scrollToEl(page, '#cards', -120);
  await sleep(800);
  await page.click('#cards .card:nth-child(1) .heart');
  await sleep(400);
  check(S, 'favourite: heart on', await page.$('#cards .card:nth-child(1) .heart.is-on'));
  check(S, 'favourite: badge = 1', (await text(page, '#fav-count')) === '1');
  check(S, 'favourite: toast shown', (await count(page, '.toast')) > 0);
  await page.click('#cards .card:nth-child(2) .heart');
  await sleep(300);
  check(S, 'favourite: badge = 2', (await text(page, '#fav-count')) === '2');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#preloader.is-done', { timeout: 8000 });
  check(S, 'favourites persist after reload', (await text(page, '#fav-count')) === '2');
  await page.click('#fav-open');
  await sleep(500);
  check(S, 'saved modal opens', await visible(page, '#fav-modal'));
  check(S, 'saved modal lists 2', (await count(page, '#fav-list .fav-item')) === 2);
  await page.click('#fav-list .fav-item:nth-child(1) [data-fav]');
  await sleep(300);
  check(S, 'remove from saved modal', (await count(page, '#fav-list .fav-item')) === 1 && (await text(page, '#fav-count')) === '1');
  await page.click('#fav-list .fav-item [data-open-property]');
  await sleep(600);
  check(S, 'saved item opens property', (await visible(page, '#property-modal')) && !(await visible(page, '#fav-modal')));
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.click('#fav-open');
  await page.click('#fav-list [data-fav]');
  await sleep(300);
  check(S, 'saved list empty state', (await text(page, '#fav-list')).includes('Tap the'));
  await page.click('#fav-modal .modal__close');
  await sleep(300);
  check(S, 'saved modal closes', !(await visible(page, '#fav-modal')));

  // ---- quick view
  await scrollToEl(page, '#cards', -120);
  await sleep(800);
  const firstTitle = await text(page, '#cards .card:nth-child(1) .card__title');
  await page.click('#cards .card:nth-child(1) .card__media');
  await sleep(600);
  check(S, 'quick view opens', await visible(page, '#property-modal'));
  check(S, 'quick view title', (await text(page, '#pm-title')) === firstTitle);
  check(S, 'page scroll locked while open', await page.evaluate(() => document.body.classList.contains('is-locked')));
  await shot(page, 'd03-quick-view');
  const src1 = await page.$eval('#pm-main', (i) => i.src);
  await page.click('.pm__thumbs button:nth-child(2)');
  await sleep(300);
  check(S, 'gallery thumbnail switches photo', (await page.$eval('#pm-main', (i) => i.src)) !== src1);
  const wa = await page.$eval('#pm .btn--wa', (a) => a.href);
  check(S, 'WhatsApp link targets ARS number with property name', wa.startsWith('https://wa.me/918660332979?text=') && decodeURIComponent(wa).includes(firstTitle));
  await page.click('#pm [data-fav]');
  await sleep(200);
  check(S, 'save button in quick view toggles', (await text(page, '#pm [data-fav]')).includes('Saved') && (await text(page, '#fav-count')) === '1');
  await page.click('#pm [data-fav]');
  await page.keyboard.press('Escape');
  await sleep(300);
  check(S, 'Escape closes quick view', !(await visible(page, '#property-modal')));
  check(S, 'scroll unlocked after close', await page.evaluate(() => !document.body.classList.contains('is-locked')));
  await page.click('#cards .card:nth-child(2) .card__title button');
  await sleep(500);
  await page.mouse.click(20, 450); // backdrop
  await sleep(300);
  check(S, 'backdrop click closes quick view', !(await visible(page, '#property-modal')));
  await page.click('#cards .card:nth-child(1) .card__media');
  await sleep(500);
  await page.click('#pm-enquire');
  await sleep(2000);
  const msg = await page.$eval('#contact-form [name=message]', (t) => t.value);
  check(S, 'Enquire pre-fills contact form', msg.includes(firstTitle));
  check(S, 'Enquire scrolls to contact', Math.abs(await topOf(page, '#contact')) < 200);
  await page.$eval('#contact-form', (f) => f.reset());

  // ---- modal wheel scrolling on a short viewport
  await page.setViewportSize({ width: 1280, height: 620 });
  await sleep(400);
  await page.click('#cards .card:nth-child(1) .card__media', { force: true }).catch(async () => {
    await scrollToEl(page, '#cards', -100);
    await sleep(600);
    await page.click('#cards .card:nth-child(1) .card__media');
  });
  await sleep(500);
  const canScroll = await page.$eval('#property-modal .modal__panel', (p) => p.scrollHeight > p.clientHeight);
  const box = await page.$eval('#property-modal .modal__panel', (p) => { const r = p.getBoundingClientRect(); return { x: r.x + r.width * 0.75, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.wheel(0, 400);
  await sleep(400);
  const st = await page.$eval('#property-modal .modal__panel', (p) => p.scrollTop);
  check(S, 'mouse wheel scrolls inside quick view', !canScroll || st > 0, `scrollable=${canScroll} scrollTop=${st}`);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(500);

  // ---- hot properties rail
  await scrollToEl(page, '#featured', 0);
  await sleep(900);
  const l0 = await page.$eval('#rail', (r) => r.scrollLeft);
  await page.click('#feat-next');
  await sleep(900);
  const l1 = await page.$eval('#rail', (r) => r.scrollLeft);
  check(S, 'rail next scrolls', l1 > l0, `${l0}→${l1}`);
  await page.click('#feat-prev');
  await sleep(900);
  check(S, 'rail prev scrolls back', (await page.$eval('#rail', (r) => r.scrollLeft)) < l1);
  // drag (make sure the carousel is settled on screen first)
  await page.$eval('#rail', (r) => r.scrollIntoView({ block: 'center' }));
  await sleep(1200);
  await page.$eval('#rail', (r) => { r.scrollLeft = 0; });
  await sleep(300);
  const rb = await page.$eval('#rail', (r) => { const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  check(S, 'rail on screen for drag test', rb.y > 0 && rb.y < 900, `y=${Math.round(rb.y)}`);
  await page.mouse.move(rb.x, rb.y);
  await page.mouse.down();
  await page.mouse.move(rb.x - 300, rb.y, { steps: 8 });
  await page.mouse.up();
  await sleep(900);
  const afterDrag = await page.$eval('#rail', (r) => r.scrollLeft);
  check(S, 'rail drag advances one card', afterDrag > 300, `scrollLeft=${afterDrag}`);
  check(S, 'drag does not open a modal', !(await visible(page, '#property-modal')));
  await page.click('#feat-prev');
  await page.click('#feat-prev');
  await sleep(900);
  const featTitle = await text(page, '#rail .feat:nth-child(1) .feat__title');
  await page.click('#rail .feat:nth-child(1) .feat__body');
  await sleep(500);
  check(S, 'rail card opens quick view', (await visible(page, '#property-modal')) && (await text(page, '#pm-title')) === featTitle);
  await page.keyboard.press('Escape');
  await shot(page, 'd04-hot');

  // ---- stats
  await scrollToEl(page, '#stats', -300);
  await sleep(3000);
  const statVals = await page.$$eval('[data-count]', (els) => els.map((e) => e.textContent));
  const statLabels = await page.$$eval('.stat__label', (els) => els.map((e) => e.textContent.toLowerCase()));
  check(S, 'stat counters reach targets', JSON.stringify(statVals) === JSON.stringify(['12', '20', String(data.partners.length), '1,500']), statVals.join(' '));
  check(S, 'stats: 20 projects developed, no "property transacted"', statLabels.includes('projects developed') && !statLabels.some((l) => l.includes('transacted')), statLabels.join(' | '));
  const heroTrust = await page.$$eval('.hero__trust li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
  check(S, 'hero trust row updated', heroTrust.includes('20 projects developed') && !heroTrust.join(' ').includes('Cr'), heroTrust.join(' | '));
  check(S, 'about images revealed', (await count(page, '.about__img.is-in')) === 2);

  // ---- services hover
  await scrollToEl(page, '#services', 0);
  await sleep(1000);
  await page.hover('.service:nth-child(1)');
  await sleep(900);
  check(S, 'service hover reveals photo', (await page.$eval('.service:nth-child(1) .service__bg', (b) => Number(getComputedStyle(b).opacity))) > 0.5);
  await shot(page, 'd06-services');

  // ---- construction pin
  const pin = await page.evaluate(() => {
    const b = document.getElementById('build');
    return { top: b.getBoundingClientRect().top + window.scrollY, len: window.innerHeight * 3.2 };
  });
  const stepAt = async (frac) => {
    await page.evaluate((y) => window.scrollTo(0, y), pin.top + pin.len * frac);
    await sleep(1500);
    return {
      pct: parseInt(await text(page, '#build-pct'), 10),
      label: await text(page, '#build-label'),
      active: await page.$$eval('#build-steps li', (l) => l.findIndex((x) => x.classList.contains('is-active'))),
      pinned: await page.$eval('.build__pin', (p) => Math.abs(p.getBoundingClientRect().top) < 2),
    };
  };
  let s1 = await stepAt(0.05);
  check(S, 'build: foundation stage', s1.active === 0 && s1.pinned, JSON.stringify(s1));
  await shot(page, 'd07-build-foundation');
  s1 = await stepAt(0.4);
  check(S, 'build: structure stage with floor counter', s1.active === 1 && /Floor \d+ of 12/.test(s1.label), JSON.stringify(s1));
  await shot(page, 'd08-build-structure');
  s1 = await stepAt(0.63);
  check(S, 'build: MEP stage', s1.active === 2, JSON.stringify(s1));
  s1 = await stepAt(0.8);
  check(S, 'build: façade stage', s1.active === 3, JSON.stringify(s1));
  await shot(page, 'd09-build-facade');
  s1 = await stepAt(0.995);
  check(S, 'build: handover at ~100%', s1.active === 4 && s1.pct >= 98, JSON.stringify(s1));
  await shot(page, 'd10-build-handover');

  // ---- markets
  await scrollToEl(page, '#markets', 0);
  await sleep(1000);
  for (let i = 0; i < data.markets.length; i++) {
    await page.click(`.pin[data-market="${i}"]`);
    await sleep(150);
    const name = await text(page, '#market-card h3');
    check(S, `market pin ${data.markets[i].name}`, name === data.markets[i].name && (await page.$(`.pin[data-market="${i}"].is-active`)));
  }
  await page.click('.pin[data-market="0"]');
  await sleep(200);
  await shot(page, 'd11-markets');
  const goLabel = await text(page, '[data-market-go]');
  await page.click('[data-market-go]');
  await sleep(1900);
  const expWF = data.properties.filter((p) => p.location === data.markets[0].name).length;
  const wfCount = await count(page, '#cards .card');
  check(S, 'market "View listings" filters to that area', wfCount === expWF && goLabel.includes(String(expWF)), `${wfCount} cards, button "${goLabel}", expected ${expWF}`);
  check(S, 'market "View listings" scrolls to listings', Math.abs(await topOf(page, '#listings')) < 160, String(Math.round(await topOf(page, '#listings'))));
  await page.click('#reset-filters').catch(() => {});
  await page.evaluate(() => document.querySelector('#active-filters [data-clear]')?.click());

  // ---- commission structure
  await page.click('.nav__link[href="#fees"]');
  await sleep(2000);
  check(S, 'nav Fees scrolls to commission structure', Math.abs((await topOf(page, '#fees')) - 70) < 20);
  const fees = await page.$$eval('.fee', (fs) => fs.map((f) => ({ t: f.querySelector('h3').textContent, rows: [...f.querySelectorAll('.fee__rows div')].map((d) => d.textContent) })));
  check(S, 'fees: 4 groups in order', JSON.stringify(fees.map((f) => f.t)) === JSON.stringify(data.commission.groups.map((g) => g.title)));
  check(S, 'fees: every row rendered', fees.reduce((n, f) => n + f.rows.length, 0) === data.commission.groups.reduce((n, g) => n + g.rows.length, 0));
  check(S, 'fees: BBMP sale rate', fees[0].rows[0].includes('2% from seller · 1% from buyer'));
  check(S, 'fees: GST note', (await text(page, '#fees-note')).includes('GST'));
  await sleep(1200);
  await shot(page, 'd12-fees');

  // ---- partners
  const tiles = await page.$$eval('#marquee .partner', (t) => t.map((x) => x.getAttribute('title')));
  check(S, 'partners: all 9 shown (looping strip)', tiles.length === data.partners.length * 2 && data.partners.every((p) => tiles.includes(p.name)), tiles.slice(0, 9).join(', '));
  check(S, 'partners: footer strip lists them', (await text(page, '#footer-partners')).startsWith('Partnered with Bhartiya City'));
  await page.evaluate(() => document.getElementById('partners').scrollIntoView({ block: 'center' }));
  await sleep(1200);
  await shot(page, 'd13-partners');

  // ---- process + testimonials
  await scrollToEl(page, '#process', 300);
  await sleep(1200);
  await scrollToEl(page, '#partners', 0);
  await sleep(1200);
  check(S, 'process steps all lit after scrolling past', (await count(page, '.step.is-on')) === 5);
  await scrollToEl(page, '#testimonials', 0);
  await sleep(1000);
  const activeSlide = () => page.$$eval('.slide', (s) => s.findIndex((x) => x.classList.contains('is-active')));
  const s0 = await activeSlide();
  await page.click('#testi-next');
  await sleep(300);
  check(S, 'testimonial next', (await activeSlide()) === (s0 + 1) % 3);
  await page.click('#testi-prev');
  await sleep(300);
  check(S, 'testimonial prev', (await activeSlide()) === s0);
  await page.click('#testi-dots button:nth-child(3)');
  await sleep(300);
  check(S, 'testimonial dots', (await activeSlide()) === 2);
  await shot(page, 'd13-testimonials');

  // ---- contact form
  await scrollToEl(page, '#contact', 0);
  await sleep(1000);
  await page.evaluate(() => { window.__opened = []; });
  await page.click('#contact-form button[type=submit]');
  await sleep(300);
  check(S, 'contact: empty submit blocked', (await count(page, '#contact-form .field.is-invalid')) === 4 && (await page.evaluate(() => window.__opened.length)) === 0);
  await page.fill('#contact-form [name=name]', 'Test Buyer');
  await page.fill('#contact-form [name=phone]', '+91 98450 00000');
  await page.fill('#contact-form [name=email]', 'not-an-email');
  await page.fill('#contact-form [name=message]', 'Looking for a 3 BHK in Whitefield');
  await page.click('#contact-form button[type=submit]');
  await sleep(200);
  check(S, 'contact: invalid email rejected', (await count(page, '#contact-form .field.is-invalid')) === 1);
  check(S, 'contact: typing clears the error', true);
  await page.fill('#contact-form [name=email]', 'buyer@example.com');
  check(S, 'contact: error clears on input', (await count(page, '#contact-form .field.is-invalid')) === 0);
  await page.selectOption('#interest', 'Construction services');
  await page.click('#send-email');
  await sleep(200);
  const mail = await page.evaluate(() => window.__opened.at(-1));
  check(S, 'contact: email hand-off', mail && mail.url.startsWith('mailto:contact@arsinfratech.in') && decodeURIComponent(mail.url).includes('Test Buyer'));
  await page.click('#contact-form button[type=submit]');
  await sleep(300);
  const waOpen = await page.evaluate(() => window.__opened.at(-1));
  check(S, 'contact: WhatsApp hand-off with details', waOpen && waOpen.url.startsWith('https://wa.me/918660332979') && decodeURIComponent(waOpen.url).includes('Construction services') && decodeURIComponent(waOpen.url).includes('buyer@example.com'));
  check(S, 'contact: form resets after send', (await page.$eval('#contact-form [name=name]', (i) => i.value)) === '');
  await shot(page, 'd14-contact');

  // ---- list-your-property modal from all three entry points
  for (const sel of ['.topbar [data-open="list-modal"]', '.cta-band [data-open="list-modal"]', '.footer [data-open="list-modal"]']) {
    if (sel.startsWith('.topbar')) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(600); }
    else { await scrollToEl(page, sel, -300); await sleep(900); }
    await page.click(sel);
    await sleep(400);
    check(S, `list modal opens from ${sel.split(' ')[0]}`, await visible(page, '#list-modal'));
    await page.keyboard.press('Escape');
    await sleep(300);
  }
  await page.click('.cta-band [data-open="list-modal"]');
  await sleep(400);
  await page.evaluate(() => { window.__opened = []; });
  await page.click('#list-form button[type=submit]');
  check(S, 'list form: empty submit blocked', (await count(page, '#list-form .field.is-invalid')) === 3);
  await page.fill('#list-form [name=name]', 'Owner');
  await page.fill('#list-form [name=phone]', '9845000000');
  await page.fill('#list-form [name=location]', 'Indiranagar');
  await page.selectOption('#list-form [name=intent]', 'Lease / rent out');
  await page.click('#list-form button[type=submit]');
  await sleep(300);
  const lw = await page.evaluate(() => window.__opened.at(-1));
  check(S, 'list form: WhatsApp hand-off', lw && decodeURIComponent(lw.url).includes('lease / rent out') && decodeURIComponent(lw.url).includes('Indiranagar'));
  check(S, 'list form: modal closes after send', !(await visible(page, '#list-modal')));

  // ---- back to top, FAB, links
  check(S, 'back-to-top visible when scrolled', await page.$('#to-top.is-on'));
  await page.click('#to-top');
  await sleep(2000);
  check(S, 'back-to-top returns to top', (await page.evaluate(() => window.scrollY)) < 20);
  const telLinks = await page.$$eval('a[href^="tel:"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  check(S, 'phone links are dialable', telLinks.every((h) => /^tel:\+91\d{10}$/.test(h)), telLinks.join(' '));
  const mailLinks = await page.$$eval('a[href^="mailto:"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  check(S, 'email links correct', mailLinks.every((h) => h === 'mailto:contact@arsinfratech.in'));
  check(S, 'WhatsApp FAB link', (await page.$eval('.fab--wa', (a) => a.href)).startsWith('https://wa.me/918660332979'));
  const unnamed = await page.$$eval('button, a', (els) => els.filter((e) => e.offsetParent !== null && !(e.getAttribute('aria-label') || e.textContent.trim())).map((e) => e.outerHTML.slice(0, 80)));
  check(S, 'every visible button/link has a name', unnamed.length === 0, unnamed.join(' | '));

  check(S, 'no JS errors during desktop run', errors.length === 0, errors.slice(0, 5).join(' | '));
  await context.close();
}

/* ============================================================
   MOBILE
============================================================ */
async function mobile(browser) {
  const S = 'mobile';
  const { context, page, errors } = await openPage(browser, { viewport: { width: 375, height: 812 }, mobile: true });
  await sleep(3000);
  await shot(page, 'm01-hero');
  check(S, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check(S, 'desktop nav hidden, menu button shown', !(await visible(page, '.nav')) && (await visible(page, '#burger')));
  const hdr = await page.$eval('.header__inner', (h) => h.scrollWidth <= h.clientWidth + 1);
  check(S, 'header fits the screen', hdr);

  await page.tap('#burger');
  await sleep(700);
  check(S, 'menu opens', await page.$('#drawer.is-open'));
  await shot(page, 'm02-menu');
  await page.tap('.drawer__nav a[href="#markets"]');
  await sleep(2000);
  check(S, 'menu link closes menu', !(await page.$('#drawer.is-open')));
  check(S, 'menu link scrolls to section', Math.abs(await topOf(page, '#markets')) < 200, String(await topOf(page, '#markets')));
  await page.tap('.pin[data-market="1"]');
  await sleep(300);
  check(S, 'map pin tap', (await text(page, '#market-card h3')) === 'Hebbal');

  // query form by tapping
  await page.evaluate(() => { window.scrollTo(0, 0); window.__opened = []; });
  await sleep(700);
  await scrollToEl(page, '#query', -80);
  await sleep(700);
  await page.tap('#query .search__tab[data-intent="Build"]');
  await page.fill('#query [name=name]', 'Mobile User');
  await page.fill('#query [name=phone]', '9845022222');
  await page.tap('#query .search__submit');
  await sleep(400);
  const mq = await page.evaluate(() => window.__opened.at(-1));
  check(S, 'query form works by tapping', mq && decodeURIComponent(mq.url).includes('Looking to: Build'));
  check(S, 'query fields use 16px text (no iOS zoom)', (await page.$eval('#query [name=name]', (i) => parseFloat(getComputedStyle(i).fontSize))) >= 16);
  await shot(page, 'm03-query');
  await page.evaluate(() => document.getElementById('listings').scrollIntoView());
  await sleep(900);

  await page.tap('#cards .card:nth-child(1) .card__media');
  await sleep(800);
  check(S, 'quick view opens as sheet', await visible(page, '#property-modal'));
  const sheet = await page.$eval('#property-modal .modal__panel', (p) => { const r = p.getBoundingClientRect(); return { bottom: Math.round(r.bottom), h: innerHeight, scroll: p.scrollHeight > p.clientHeight }; });
  check(S, 'sheet docked to bottom & scrollable', Math.abs(sheet.bottom - sheet.h) <= 2 && sheet.scroll, JSON.stringify(sheet));
  await shot(page, 'm04-sheet');
  await page.tap('#property-modal .modal__close');
  await sleep(400);
  check(S, 'sheet closes', !(await visible(page, '#property-modal')));
  await page.tap('#active-filters [data-clear="beds"]').catch(() => {});

  // construction on mobile
  const pin = await page.evaluate(() => ({ top: document.getElementById('build').getBoundingClientRect().top + window.scrollY, len: window.innerHeight * 2.4 }));
  await page.evaluate((y) => window.scrollTo(0, y), pin.top + pin.len * 0.45);
  await sleep(1500);
  check(S, 'build progresses on mobile', parseInt(await text(page, '#build-pct'), 10) > 20);
  await shot(page, 'm05-build');

  // tap targets: hearts and buttons at least ~40px
  const small = await page.$$eval('.icon-btn, .heart, .btn, .chip', (els) => els.filter((e) => e.offsetParent && (e.getBoundingClientRect().height < 36)).map((e) => e.className));
  check(S, 'tap targets ≥ 36px tall', small.length === 0, small.slice(0, 6).join(', '));

  await scrollWholePage(page);
  const broken = await brokenImages(page);
  check(S, 'all images load', broken.length === 0, broken.join(', '));
  await scrollToEl(page, '#fees', 0);
  await sleep(1200);
  await shot(page, 'm06-fees');
  await scrollToEl(page, '.footer', 0);
  await sleep(800);
  await shot(page, 'm07-footer');
  check(S, 'no horizontal overflow after full scroll', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check(S, 'no JS errors during mobile run', errors.length === 0, errors.slice(0, 5).join(' | '));
  await context.close();
}

/* ============================================================
   REDUCED MOTION + NO-WEBGL FALLBACKS
============================================================ */
async function reducedMotion(browser) {
  const S = 'reduced-motion';
  const { context, page, errors } = await openPage(browser, { reducedMotion: 'reduce' });
  await sleep(1500);
  await scrollToEl(page, '#about', 0);
  await sleep(800);
  const hidden = await page.$$eval('[data-reveal]', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.99 && e.getBoundingClientRect().top < innerHeight).length);
  check(S, 'content visible without animations', hidden === 0, `${hidden} hidden`);
  await page.click('.nav__link[href="#contact"]');
  await sleep(500);
  check(S, 'anchor links still work', Math.abs(await topOf(page, '#contact')) < 160);
  check(S, 'no JS errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

async function noWebGL() {
  const S = 'no-webgl';
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-webgl', '--disable-3d-apis'] });
  const { context, page, errors } = await openPage(browser);
  await sleep(1500);
  const bg = await page.$eval('#hero', (h) => h.style.background);
  check(S, 'hero falls back to photo', bg.includes('unsplash'));
  const bbg = await page.$eval('.build__pin', (h) => h.style.background);
  check(S, 'construction falls back to photo', bbg.includes('unsplash'));
  await page.click('#status-chips [data-status="For Rent"]');
  await sleep(500);
  check(S, 'site still usable (filters work)', (await count(page, '#cards .card')) > 0);
  check(S, 'no JS errors', errors.length === 0, errors.join(' | '));
  await context.close();
  await browser.close();
}

/* ============================================================ */
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const only = process.argv[2];
try {
  if (!only || only === 'desktop') await desktop(browser);
  if (!only || only === 'mobile') await mobile(browser);
  if (!only || only === 'reduced') await reducedMotion(browser);
} catch (e) {
  check('runner', 'suite crashed', false, e.stack);
}
await browser.close();
if (!only || only === 'nowebgl') await noWebGL().catch((e) => check('runner', 'no-webgl crashed', false, e.stack));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFailures:');
  failed.forEach((f) => console.log(` - [${f.suite}] ${f.name}: ${f.detail}`));
}
process.exit(failed.length ? 1 : 0);
