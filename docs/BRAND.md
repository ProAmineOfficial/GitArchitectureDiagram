# Brand and footer

Git Architecture Diagram is developed by Amine Saoud ibn al-Bashir / Pro_Amine LLC.

- Official website: <https://gitarchitecturediagram.com>
- Company: <https://proamine.tech>

The footer connects the workspace to the wider Pro_Amine ecosystem: a Pro_Amine LLC card, an ecosystem card (Pro_AmineUMT IDE with AI, site navigation, social profiles), and a NanoKit / UMT card, followed by the centered copyright line `© 2026 Pro_Amine LLC · Created & Developed by Amine Saoud ibn al-Bashir`. There is no "All rights reserved" line, because the project is MIT licensed.

## Footer design

The footer uses a premium dark-glass palette, with a light counterpart for the light theme. It contains no neon green or yellow.

| Token | Dark | Light |
| --- | --- | --- |
| Backgrounds | `#090D14`, `#0B1020`, `#101522` | `#EEF2F8`, `#E7ECF5`, `#F6F8FC` |
| Glass | `rgba(20,28,40,.55)` → `rgba(15,23,42,.60)` | `rgba(255,255,255,.66)` → `.56` |
| Text / secondary / muted | `#F3F4F6` / `#CBD5E1` / `#94A3B8` | `#0F172A` / `#334155` / `#475569` |
| Accent | `#8BA8FF` (with `#7DD3FC`, `#A78BFA` in glows) | `#4F6BDB` |
| Borders | `rgba(255,255,255,.08)` | `rgba(15,23,42,.08)` |

Cards use a large radius (28 px), a 1 px translucent border, an 18 px backdrop blur, a soft shadow, and an inner highlight. On hover they lift by 4 px and gain a soft accent glow. Titles are off-white, and paragraphs are muted gray. Buttons are dark glass, and the NanoKit purchase button uses the muted cool accent. Images sit in soft frames. The black Pro_Amine logo sits on a light frosted plate, so it stays legible on dark glass. The cards fade in upward, once, at 0, 150, and 300 ms, followed by the copyright at 450 ms (1 s, `cubic-bezier(.22,1,.36,1)`). Reduced motion turns off the reveal and all hover movement. The styles live in one footer layer in `public/styles.css` (the `--ft-*` tokens), with no override layers.

## Product icon

The official Git Architecture Diagram icon (a black-and-white symbol on a transparent background) is the product icon everywhere. `git-architecture-diagram-icon-pro.png` is the official master, unmodified. The derivatives in `public/assets/brand/icons/` were produced from it with Pillow (Lanczos). They are trimmed to the visible symbol and centered with 6% transparent padding, so no line touches the edge, with proportions and transparency kept:

| File | Use |
| --- | --- |
| `/favicon.ico` (16, 32, 48 px) and `gad-icon-16.png`, `gad-icon-32.png`, `gad-icon-48.png` | Browser favicons |
| `gad-icon-64.png`, `gad-icon-96.png` (header `srcset`) | Header mark: 36 px container (34 px icon) on desktop, 30 px on mobile, immediately before "Git Architecture Diagram" |
| `gad-icon-48.png` / `gad-icon-96.png` | Footer identity line and the ecosystem link to Git Architecture Diagram |
| `gad-icon-180.png` | Apple touch icon |
| `gad-icon-192.png`, `gad-icon-512.png` | Larger uses (install prompts, previews) |

If an icon ever fails to load, the header shows the vector mark instead of a broken image. The earlier white-line variant `git-architecture-diagram-icon.png` is kept for reference and is no longer referenced by the page.

## Local assets and provenance

Images are served from `public/assets/brand/` and are never hotlinked. If a file is missing, its card shows a labeled fallback instead of a broken image.

| File | Source | Use |
| --- | --- | --- |
| `nanokit-integrated-esp32.webp` | `Icon NanoKit Integrated ESP32.png` in the official repository [ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC](https://github.com/ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC), trimmed to the board and resized to 1200 px wide (WebP, quality 90). The same render is published at <https://proamine.tech/wp-content/uploads/2025/03/Icon-NanoKit-Integrated-ESP32.webp>. | Footer: NanoKit Integrated ESP32 |
| `git-architecture-diagram-icon-pro.png` | The official icon supplied by the owner ("Pro git-architecture-diagram-icon.png", 1254 × 1254, transparent) | Master for every favicon and product icon |
| `git-architecture-diagram-icon.png` | <https://proamine.tech/wp-content/uploads/2026/10/Icon-Git-Architecture-Diagram.png> (earlier white-line variant) | Not referenced; kept for reference |
| `nanokit-integrated-esp32-official.webp` | Official render committed by the owner | Not referenced yet; available as a higher-resolution replacement for the NanoKit image |
| `pro-amineumt-ide-ai.png` | <https://proamine.tech/wp-content/uploads/2026/09/with-deep-sek.png> | Footer: Pro_AmineUMT IDE with AI |
| `umt-16x16-bga-hybrid-mcu-soc.png` | <https://proamine.tech/wp-content/uploads/2026/09/UMT-16x16-BGA-IC.png> | Footer: UMT 16×16 BGA package |
| `pro-amine-logo.png` | <https://proamine.tech/wp-content/uploads/2023/03/logo-use-transparent-1024x468.png> | Footer: Pro_Amine LLC logo |

The owner committed the official images on October 4, 2026 (`90cb56d`). If a proamine.tech image is ever missing, restore it on a machine that can reach proamine.tech, check it, and commit it:

```bash
node scripts/fetch-brand-assets.mjs
```

The script saves each image exactly as published, checks that it really is a PNG or WebP under 8 MB, and leaves existing files alone unless `--force` is given. No page needs to change: the footer and the favicon pick the files up automatically.

## Links

Every link is listed once in `public/index.html` and checked by `tests/browser/genius.browser.mjs`.

| Link | Destination | Verified |
| --- | --- | --- |
| Home Page | <https://proamine.tech/> | Public site |
| About us | <https://proamine.tech/about-us/> | Public site |
| Contact us | <https://proamine.tech/contact-us/> | Public site |
| Projects | <https://proamine.tech/projects/> | As provided by the owner; not reachable from the sandbox |
| Store | <https://proamine.tech/shop/> | The store page is indexed at `/shop/` (titled "Store") |
| NanoKit Integrated ESP32 | <https://proamine.tech/product/nanokit-integrated-esp32-board-development-2/> | Public product page |
| UMT Platform | <https://proamine.tech/what-is-the-umt-platform/> | Public page "What is the UMT Platform?" |
| Telegram | <https://t.me/+tPVAK6lS7eZmODg0> | As provided by the owner |
| TikTok | <https://www.tiktok.com/@pro_amine.llc> | As provided by the owner |
| YouTube | <https://www.youtube.com/c/AMINESAOUD> | As provided by the owner |
| Facebook | <https://www.facebook.com/AmineSAOUD0> | As provided by the owner |
| Instagram | <https://instagram.com/pro_amine.llc> | As provided by the owner |
| GitHub | <https://github.com/ProAmineOfficial> | Official organization |
| X | <https://x.com/pro_amine_tech> | As provided by the owner |
| LinkedIn | <https://www.linkedin.com/company/pro-amine-llc/> | Listed on the official GitHub organization profile |

## Social dock

The eight social links sit under the ecosystem navigation as a dock labeled "Follow Pro_Amine", in this order: Telegram, TikTok, YouTube, Facebook, Instagram, GitHub, X, LinkedIn. Each is an ordinary link (`target="_blank"`, `rel="noopener noreferrer"`, `aria-label="Pro_Amine LLC on <network>"`) that the application router never intercepts.

- **Glass buttons:** circular, 44 × 44 px (46 px from 1536 px wide, 40 px on phones), `backdrop-filter: blur(18px) saturate(150%)`, a 1 px `rgba(255,255,255,.12)` border, and an inner highlight. Dark theme: graphite glass (`linear-gradient(145deg, rgba(255,255,255,.10), rgba(255,255,255,.035))`, shadow `0 8px 24px rgba(0,0,0,.28)`) with silver glyphs. Light theme: frosted white (`rgba(255,255,255,.55)`, border `rgba(255,255,255,.72)`) with dark graphite glyphs.
- **Magnification** (`public/social-dock.js`, fine pointer only): 1.28 for the button under the pointer, lifted 6 px; 1.12 for its neighbors, lifted 2 px; 1.04 for the next ones; 1.0 beyond. Transitions take 220 ms with `cubic-bezier(.22,1,.36,1)`. Hover brightens the glass and adds a small glow. Keyboard focus gets the same emphasis plus a `2px solid rgba(135,170,255,.8)` outline at a 3 px offset. Reduced motion turns magnification off.
- **Tooltips:** a glass pill above the button with the network's name (fades in from 4 px below).
- **Widths:** one row when it fits. In a narrow three-column card (1181–1440 px windows), the dock wraps into a centered 4 × 2 grid (container query). On a tablet, it spans the ecosystem card. On a phone, it becomes a horizontal snap row with a hidden scrollbar. No width causes page overflow.

### Platform glyphs

Each button has a slot for that network's official glyph. This project does not draw the networks' logos itself. Each network publishes its icon in its brand resources (for example GitHub's at <https://github.com/logos> and LinkedIn's at <https://brand.linkedin.com/>). Until a glyph is provided, the button shows a neutral typographic monogram (Tg, Tk, Yt, Fb, Ig, Gh, X, Li), and the tooltip and accessible name still give the full network name.

To add the official glyphs:

1. Download each network's official monochrome icon as SVG from its brand resources, and follow that network's usage guidelines.
2. Save the files as `public/assets/brand/social/<network>.svg` (`telegram`, `tiktok`, `youtube`, `facebook`, `instagram`, `github`, `x`, `linkedin`).
3. Run `npm run brand:social`. The script rejects scripts, event handlers, external references, embedded images, and files over 24 KB, then writes `glyphs.json`.
4. Commit the SVG files and `glyphs.json`. The dock renders each glyph locally as a CSS mask, tinted silver in the dark theme and graphite in the light theme. Nothing is loaded from a CDN, and `tests/social-dock.test.mjs` validates every listed file.
