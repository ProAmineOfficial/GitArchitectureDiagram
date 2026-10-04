# Brand and footer

Git Architecture Diagram is developed by Amine Saoud ibn al-Bashir / Pro_Amine LLC.

- Official website: <https://gitarchitecturediagram.com>
- Company: <https://proamine.tech>

The footer connects the workspace to the wider Pro_Amine ecosystem: a Pro_Amine LLC card, an ecosystem card (Pro_AmineUMT IDE with AI, site navigation, social profiles), and a NanoKit / UMT card, followed by the copyright line `© 2026 Amine Saoud ibn al-Bashir | Pro_Amine LLC`. There is no "All rights reserved" line, because the project is MIT licensed.

## Local assets and provenance

Images are served from `public/assets/brand/` and are never hotlinked. Until a file exists, its card shows a labeled fallback instead of a broken image, and the favicon and header keep the vector mark until the official icon loads.

| File | Source | Use |
| --- | --- | --- |
| `nanokit-integrated-esp32.webp` | `Icon NanoKit Integrated ESP32.png` in the official repository [ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC](https://github.com/ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC), trimmed to the board and resized to 1200 px wide (WebP, quality 90). The same render is published at <https://proamine.tech/wp-content/uploads/2025/03/Icon-NanoKit-Integrated-ESP32.webp>. | Footer: NanoKit Integrated ESP32 |
| `git-architecture-diagram-icon.png` | <https://proamine.tech/wp-content/uploads/2026/10/Icon-Git-Architecture-Diagram.png> | Favicon, touch icon, header mark |
| `pro-amineumt-ide-ai.png` | <https://proamine.tech/wp-content/uploads/2026/09/with-deep-sek.png> | Footer: Pro_AmineUMT IDE with AI |
| `umt-16x16-bga-hybrid-mcu-soc.png` | <https://proamine.tech/wp-content/uploads/2026/09/UMT-16x16-BGA-IC.png> | Footer: UMT 16×16 BGA package |
| `pro-amine-logo.png` | <https://proamine.tech/wp-content/uploads/2023/03/logo-use-transparent-1024x468.png> | Footer: Pro_Amine LLC logo |

The four proamine.tech files could not be downloaded from the development sandbox, whose network policy blocks that host. To add them, run this on a machine that can reach proamine.tech, check the images, and commit them:

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
| Telegram, TikTok, YouTube, Facebook, Instagram, X | As listed on the public site by the owner | The GitHub organization profile lists TikTok `@pro_amine.llc` and YouTube `/c/AMINESAOUD`; confirm which handles are current |
| GitHub | <https://github.com/ProAmineOfficial> | Official organization |
| LinkedIn | <https://www.linkedin.com/company/pro-amine-llc/> | Listed on the official GitHub organization profile |

Social buttons use generic line icons (paper plane, note, video, people, camera, code, X, briefcase) with accessible labels such as "Pro_Amine on GitHub", rather than reproductions of each network's logo.
