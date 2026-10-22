# A.R.S Infratech — website

**Live:** https://ars-infratech.pages.dev

Interactive 3D real-estate & construction website for **A.R.S Infratech**, Bengaluru.

The look follows the Times Estates template (white utility bar and header, orange active menu item,
blue phone bar, charcoal title tabs with icon squares, Lato / Open Sans, orange `#ec894d`,
sky blue `#4dc7ec`, charcoal `#394041`) with the A.R.S navy-and-gold logo, a 3D hero (Three.js)
and scroll animations.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production site in dist/
npm run preview   # serve the production build locally
npm run test:e2e  # 151 automated checks (needs `npm run dev` running; uses Microsoft Edge)
```

`npm run test:e2e -- mobile` (or `desktop`, `reduced`, `nowebgl`) runs one suite.
Test the live site with `BASE_URL=https://ars-infratech.pages.dev npm run test:e2e`.
Set `SHOTS_DIR=some-folder` to save screenshots of every section.

## Deploy (Cloudflare Pages)

Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repository, then:

| Setting | Value |
|---|---|
| Framework preset | None (or Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `20` |

Every push to `main` redeploys automatically. `public/_headers` sets long-term caching for assets.
(The same settings work on Netlify: build `npm run build`, publish `dist`.)

## What's on the page

| Section | Highlights |
|---|---|
| Hero | 3D city at dusk with a twisting signature tower, live traffic, cursor / device-tilt parallax, intro fly-in, count-up stats |
| Send a query | Buy / Rent / Build / Invest tabs, name, phone, location, budget, requirement → opens WhatsApp to the ARS number with everything filled in |
| Listings | Status chips, sort, grid / list, 3D tilt cards, saved favourites, quick-view with gallery and WhatsApp enquiry |
| Hot properties | Drag / swipe carousel |
| About + stats | 12+ years · 20 projects developed · 9 developer partners · 1500+ families |
| Services | Four practices with hover photo reveal |
| Construction | Scroll-pinned 3D build: foundation → structure (floor by floor) → MEP → façade → handover |
| Locations | Interactive Bengaluru micro-market map → jump to listings in that area |
| How we work | Five-step timeline |
| Commission structure | Sale, joint development, rental and temporary-rental fees (+ GST note) |
| Partners | Bhartiya City, Puravankara, Sattva, Prestige, Embassy, Brigade, Godrej, Shriram, Sobha |
| Testimonials, contact, list your property | Forms open WhatsApp or email with details pre-filled — no backend needed |

## Edit content

- **Text and data:** `src/data.js` — `properties` (**sample listings — replace with real inventory**),
  `markets` (**indicative figures**), `stats`, `partners`, `commission`, `services`, `process`, `testimonials`.
- **Partner logos:** drop PNGs into `public/partners/` named as listed in `public/partners/README.txt`.
  Until a file exists, that partner shows as a clean wordmark.
- **Logo:** `public/brand/` (navy version for the white header, gold for dark areas, favicon).
- **Phone / email:** +91 86603 32979, contact@arsinfratech.in — in `index.html` and `src/data.js`.
- **Styles:** `src/styles.css` (base) → `src/theme-times.css` (template look) → `src/brand.css` (logo, fees, partners, motion).

## Notes

- Animations use transform / opacity only and run once on scroll; everything respects `prefers-reduced-motion`.
- Phones get a lighter 3D scene (fewer buildings, capped pixel ratio); 3D falls back to photos without WebGL.
