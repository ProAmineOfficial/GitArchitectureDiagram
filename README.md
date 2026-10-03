# Git Architecture Diagram

**Understand the repository. Follow the evidence. Keep the documentation.**

Replace `github.com` in any repository link with this site's address, and the repository opens as a component diagram, a file-level import graph, a mind map, a classic file tree, and a source-grounded Genius guide.

Created by **Amine Saoud ibn al-Bashir — [ProAmineOfficial](https://github.com/ProAmineOfficial)**. Open source under the MIT license.

[Architecture](docs/ARCHITECTURE.md) · [Deployment and domains](docs/DEPLOYMENT.md) · [AI providers](docs/AI_PROVIDERS.md) · [Privacy and limits](docs/PRIVACY.md) · [Validation](docs/VALIDATION.md) · [Contributing](CONTRIBUTING.md)

![Git Architecture Diagram workspace](docs/images/workspace.png)

## Replace the hostname

```text
https://github.com/ProAmineOfficial/NanoKit-ESP32/tree/main/examples_on_platformio/ultrasonic_distance
https://git-architecture-diagram.pro-amine.chatgpt.site/ProAmineOfficial/NanoKit-ESP32/tree/main/examples_on_platformio/ultrasonic_distance
```

The second link opens the workspace and starts analysis. The address you arrived with stays in the address bar.

| You open | What happens |
| --- | --- |
| `/owner/repo` | The default branch, whole repository |
| `/owner/repo/tree/<branch, tag, or commit>/<folder>` | That folder at that ref. Branch names containing `/` are resolved through GitHub's ref list |
| `/owner/repo/blob/<ref>/<file>#L12-L20` | The file's nearest project folder (the one holding `package.json`, `platformio.ini`, and similar), with the file read first and lines 12–20 highlighted |
| `/owner/repo/pulls/3` and other GitHub pages | An explanation of which repository, folder, or file to open instead |

Refresh, Back, and Forward work; analyses already shown in the tab are reused. **Copy permalink** pins the exact commit and keeps the selected file and lines. The hosted address above is live; custom-domain status is in [Deployment](docs/DEPLOYMENT.md#custom-domain).

## What you get

| View | Built from | Honest limits |
| --- | --- | --- |
| **System map** (AI, opens first when available) | A model reads the files already analyzed and returns people, devices, outside systems, components in layers, the main flow, and a guided tour; every path is checked against the commit before drawing | Solid arrows cite a line the model was shown; dotted arrows are inference; dashed shapes have no file |
| **Components** (opens first without AI) | Top-level folders of the analyzed scope, classified by name and contents; arrows only from located imports/includes; external modules actually imported | Folder roles are hints; an import is not proof of a runtime call |
| **Files and imports** | File-level import graph, with drill-down per component | Bounded preview; lexical extraction for JS/TS, Python, C/C++ |
| **Genius interpretation** (optional AI) | A component graph from your chosen model, validated against the commit before drawing | Dotted arrows are inference; dashed nodes have no verified file |
| **Mind map** | Folder hierarchy from the tree | Up to 14 folders and 5 files each |
| **Authored diagrams** | Mermaid blocks in Markdown and `.mmd` files, with the author's own styles | Documented intent, not runtime verification |
| **Mermaid source** | Any of the above, editable with syntax checking | Edited nodes lose source links by design |
| **Files** | The full retained tree with search and Read/Code/Docs filters; read files are marked | Listing, not content, for unread files |
| **Genius** | Structure summary, suggested reading order with reasons, stack and documentation checks, coverage | Reading order comes from files read, not an execution trace |
| **Ask** | **Search sources** (free, local) or **Ask your provider** with cited findings | Citations outside the sent excerpts are removed |

Clicking a diagram node selects the real file or folder in the tree and opens the inspector, with a GitHub link pinned to the analyzed commit. Exports: Mermaid, SVG, PNG, and a `.genius` ZIP containing the guide, overview, file graph, mind map, authored diagrams, reading order, tree, and evidence JSON. Nothing is written back to the analyzed repository.

## Diagram-first workspace

A repository page is built around one large diagram. A glass action bar above it holds the repository, branch and commit, **Tour**, **Info** (a one-paragraph summary, structure, and where to start), **Fullscreen**, **Export** (PNG, SVG, Mermaid, the `.genius` package), **Refresh**, and **Permalink**. **Files** and **Genius** slide in as drawers; the panel button pins them side by side instead, and the choice is remembered. Scrolling over the diagram scrolls the page until you click the diagram; Ctrl or ⌘ + scroll zooms at any time. On the home page the repository input sits at the center.

## Understand, highlight, extract, build

- **Highlights** (action bar): isolate key architecture, entry points, core components, data flow, API flow, frontend, backend, storage, external services, AI components, hardware, security-critical parts, build and deployment, tests, documentation, high-dependency nodes, or Genius highlights, or type a request such as "authentication flow". Unrelated nodes dim and the selected paths animate. Every result is labeled **Source-derived**, **Genius interpretation**, or **Keyword match**.
- **Software hierarchy**: how the software is organized (layers, components, key files) rather than where files are, with badges such as ENTRY POINT, CORE, PUBLIC API, CRITICAL, and EXTERNAL. Embedded projects get embedded layer names. A Genius version appears when a system map exists.
- **Repository mind map**: concepts (architecture, README features, entry points, infrastructure, imported dependencies, documentation, tests). Selecting one explains it in Genius and can highlight it in the System map, Architecture, and hierarchy, or reveal its files.
- **Build with Genius** (Genius drawer) and **Export** (four groups): development prompt in 11 modes, development skills (observed with evidence, recommended separately), app blueprint, implementation roadmap, AI-ready context, project extract, project reconstruction pack, clone command, README picture, README badge, and Mermaid for each view. These are generated from the analysis without a model call.
- **Verified answers**: Genius citations are checked on the server against the file on GitHub at the analyzed commit (path, line, verbatim quote). Answers show **Verified source** and **Genius inference** separately; text supplied by the browser never makes a citation trusted.

## Three navigation layers and the view dock

The page keeps three layers with separate jobs:

1. **Global header** (application): Workspace, Browse, GitHub, theme, API settings.
2. **Repository command bar** (the analyzed repository): repository and search, branch and commit, Tour, Highlights, Info, Zoom, Fullscreen, Export, Refresh, Permalink, Files, Genius, and the panel layout toggle.
3. **View dock** (centered under the command bar): System Map (AI badge), Architecture, Software Hierarchy, Repository Mind Map │ Project Diagrams (count badge), Mermaid Source, Genius Guide │ Export Project, Export, Build With Genius.

Every dock item has its own line icon. The active view is amber with a dot beneath it. Moving the mouse across the dock magnifies icons by distance along one continuous curve: about 1.48× under the pointer, 1.22× for neighbors, 1.07× for the next ones. Icons rise as they grow, using transforms only, so nothing reflows. Arrow keys move focus, and Enter or Space activates. Magnification is off for touch, narrow screens (where the dock scrolls horizontally), and reduced motion.

The dock's Export and the command bar's Export open **the same** menu: PNG, SVG, Copy Mermaid, Download Mermaid, README picture, and README badge. **Zoom** makes scrolling zoom the diagram without clicking it first. **Permalink** pins the commit and keeps the selected file, lines, and view.

## Export Project

**Export Project** (dock) is the project-level export workspace, in six cards:

- **Clone Repository:** the exact command (`git clone`, then `git checkout <commit>`), with no credentials ever included, and the difference from project reconstruction explained.
- **Project Files:** the project extract described below.
- **Project Diagrams:** PNG, SVG, Copy Mermaid, or a Mermaid file for Architecture, System Map, Software Hierarchy, Repository Mind Map, and each authored diagram, rendered off-screen without leaving the view; plus README picture and README badge.
- **Project Skills:** observed skills with evidence, recommended skills with reasons; Markdown, text, or JSON.
- **Genius:** development prompt, Build Similar App, MVP plan, frontend, backend, API, and database plans, app blueprint, and implementation roadmap.
- **AI / Developer Context:** AI-ready context, Developer Pack, Project Knowledge Pack (labels each section *[verified source]* or *[Genius inference]*), and the Project Reconstruction Pack.

## Project files (extract)

The **Project Files** card turns the repository into text you can copy into any AI assistant or keep as documentation. It is built into this site and uses no outside ingestion service. It has five sections, each with **Copy**: Summary, Statistics (languages by size, largest files, and what was left out and why), Directory structure, Important files (from the analysis: reading order, entry points, most-imported modules), and File contents. **Copy all**, **Download .txt**, and **Download .md** cover everything.

- **Analyzed files:** instant, using the files the analysis already read.
- **Entire repository:** the server asks GitHub for this commit's archive in **one request**, then reads it as a stream. The redirect is followed only to `https://codeload.github.com`; the visitor's GitHub token is sent to `api.github.com` only; nothing is stored. Limits: 120 MB compressed / 800 MB unpacked / 20 MB of text on the Node server; 30 MB / 200 MB / 6 MB on the hosted Worker.
- **Filters:** Include and Exclude take comma-separated patterns. `*.md` matches file names anywhere, `src/` matches a folder at any depth, `/src/` only at the root, and `docs/**/*.md` a path. Defaults exclude dependencies and build output (`node_modules/`, `vendor/`, `dist/`, lock files…). **Largest file** ranges from 10 KB to 1 MB. Credential files such as `.env` and private keys are never read.

On `inngest/inngest` (an 80 MB archive), the Node server listed 13,143 files and included 3,024 (13.9 MB of text) in 2.3 seconds. The hosted limits refused the same archive at once, with a message, before downloading it.

## System map and guided tour

The **System map** tab answers "what is this repository, and how do its parts fit together?" in one picture. It is a Mermaid flowchart compiled by this application from a validated graph, never raw model output. People and devices are circles, outside systems are dashed, subsystems are translucent groups, and the main flow animates. **Play tour** walks through that flow step by step: the camera glides to each node, the edge that led there lights up, and a caption explains what happens. Arrow keys, Space, and Escape control it; reduced-motion settings turn the animation off.

Maps are generated in one of two ways, and the cost is shown before either runs:

- **Your key:** add a provider key and model in **API settings**, then choose **Generate**.
- **This site's key, for everyone:** the operator sets `GENIUS_PUBLIC_AI=1` with a server key and model. Public repositories then get a map automatically. Each commit, folder, and model is generated once and saved, so later visitors see it without another model call; `GENIUS_PUBLIC_DAILY_LIMIT` caps new maps per UTC day. Private repositories never use the site's key, and maps paid with a visitor's own key are not saved for others.

## How files are chosen

Genius reads the scope's README and manifests first, then **follows the evidence**: the entry points a manifest declares (`main`/`exports`/`bin` in `package.json`, `platformio.ini` sources, `pyproject.toml` scripts, Cargo, Go, CMake) and the local files each read file imports. Examples and tests are demoted when a core exists to read instead. Every file records why it was read. On `expressjs/express` this reads `index.js` and all of `lib/` before any example.

## Run it

Requires **Node.js 22.12 or newer**.

```bash
git clone https://github.com/ProAmineOfficial/GitArchitectureDiagram.git
cd GitArchitectureDiagram
npm ci
npm start
```

Open **http://localhost:3000/ProAmineOfficial/NanoKit-ESP32**. Public repositories need no key. GitHub allows 60 unauthenticated API requests per hour per IP address; add a fine-grained token with **Contents: read** in **API settings** for a higher allowance or for private repositories.

Optional AI: choose OpenAI, Claude, Gemini, or Kimi in **API settings**, paste your key and a model ID, then either check **Add a Genius AI interpretation** under Options or use **Ask** in the Genius panel. The request size, provider, model, and output limit are shown before anything is sent. See [AI providers](docs/AI_PROVIDERS.md).

A protected self-hosted instance can hold its own provider key:

```dotenv
OPENAI_API_KEY=your-key
GENIUS_PROVIDER=openai
GENIUS_MODEL=your-explicit-model-id
GENIUS_ACCESS_TOKEN=your-instance-access-password
```

The server key is used for web requests only with the instance password. Never commit `.env`.

## Generate documentation from the terminal

```bash
npm run analyze -- ProAmineOfficial/NanoKit-ESP32 \
  --scope examples_on_platformio/ultrasonic_distance --max-files 24 --output .genius
```

Add `--ref COMMIT_SHA` to reproduce a snapshot and `--ai` to include a model interpretation using the environment settings above.

## Scope and limits

- Default budget 32 files: 1–40 on the hosted Worker, 1–120 locally. Per file 96 KB, 900 KB total, 12,000 tree entries. Generated/vendor folders, likely credential files, symlinks, and binaries are skipped; binaries still appear in the tree and component counts.
- Large monorepos work best folder by folder: open a component and choose **Analyze this folder**.
- No code is executed, built, or installed. No automatic webhooks: **Refresh** re-resolves the branch on demand.
- Narrated video tours (as on GitDiagram) are **not implemented**; see [Validation](docs/VALIDATION.md#deferred).

## Develop and test

```bash
npm run dev     # watch mode
npm run check   # syntax
npm test        # 67 Node tests, no network or credentials
npm run test:browser  # 26 browser checks with Playwright Chromium (npx playwright install chromium)
npm run build   # browser bundle + Workers-compatible server in dist/
```

Tests run the real ingestion code against temporary Git repositories through `tests/support/github-emulator.mjs`, a local implementation of the GitHub REST routes the reader uses.

## Why this project

[GitDiagram](https://github.com/ahmedkhaleel2004/gitdiagram) showed how useful replacing a hostname to get a diagram can be. [NanoKit-ESP32](https://github.com/ProAmineOfficial/NanoKit-ESP32) showed the value of organized Mermaid documentation and reproducible guides. This independent implementation brings those together around verifiable source evidence. It is not affiliated with GitDiagram and does not copy its code.

Built with Node.js, Mermaid, DOMPurify, marked, fflate, and IBM Plex (SIL Open Font License, `public/fonts/OFL.txt`). Their licenses remain their authors'.
