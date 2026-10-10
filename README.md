# Git Architecture Diagram

**Understand. Visualize. Highlight. Extract. Build.**

Git Architecture Diagram transforms a GitHub repository into an interactive, diagram-first workspace for architecture understanding, software hierarchy, repository mind maps, source-grounded Genius guidance, project extraction, and developer-ready exports.

Replace the GitHub hostname with your Git Architecture Diagram hostname and open the same repository path as an analysis workspace.

Git Architecture Diagram is an AI architecture diagram generator for GitHub repositories. It produces architecture diagrams, System Maps, Mermaid diagrams, a software hierarchy, and a repository mind map, all pinned to the analyzed commit. **Genius AI** is its integrated AI engineering engine: with your own AI provider key, Genius AI adds AI-powered repository analysis, grounded answers with verified citations, and development packs.

Created & Developed by **Amine Saoud ibn al-Bashir** — **ProAmineOfficial / Pro_Amine LLC**.  
Open source under the **AGPL-3.0 license**.

---

## Official workspace

### Dark workspace

![Git Architecture Diagram — dark workspace](docs/images/workspace-dark.png)

### Light workspace

![Git Architecture Diagram — light workspace](docs/images/workspace-light.png)

### Mobile workspace

![Git Architecture Diagram — mobile workspace](docs/images/workspace-mobile.png)

### Tablet workspace

![Git Architecture Diagram — tablet workspace](docs/images/workspace-tablet.png)

### Export Project

![Git Architecture Diagram — Export Project](docs/images/export-project.png)

### macOS-style dock interaction

![Git Architecture Diagram — dock magnification](docs/images/dock-magnified.png)

### Dock navigation and project diagram count

![Git Architecture Diagram — dock navigation](docs/images/dock-navigation.png)

### Project Files extract

![Git Architecture Diagram — Project Files](docs/images/project-files.png)

---

## Open any repository by replacing the hostname

Example repository:

```text
https://github.com/ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC
```

Production-domain form:

```text
https://gitarchitecturediagram.com/ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC
```

The repository opens in Git Architecture Diagram and starts analysis.

The same idea also applies to repository paths such as:

```text
/owner/repo
/owner/repo/tree/<branch-or-commit>/<folder>
/owner/repo/blob/<ref>/<file>#L12-L20
```

Permalinks can preserve the analyzed commit, selected file, selected lines, and current view.

---

## What you get

| View | Purpose |
|---|---|
| **System Map** | AI-assisted system-level map showing people, devices, outside systems, components, layers, flows, and guided-tour paths |
| **Architecture** | Component-level architecture derived from the analyzed repository scope |
| **Software Hierarchy** | Shows how the software is organized by layers, roles, components, and key files rather than only by folders |
| **Repository Mind Map** | Organizes repository concepts such as architecture, entry points, infrastructure, dependencies, documentation, and tests |
| **Project Diagrams** | Authored and generated diagrams associated with the project |
| **Mermaid Source** | Editable Mermaid representation with syntax checking |
| **Genius Guide** | Structure summary, reading order, stack analysis, documentation checks, coverage, and evidence-grounded guidance |
| **Export Project** | Project-level export workspace for files, diagrams, skills, prompts, plans, and AI/developer context |
| **Files** | Searchable retained repository tree with source navigation |
| **Build With Genius** | Development-oriented outputs for extending, rebuilding, or planning a similar application |

---

## Three navigation layers

Git Architecture Diagram separates global navigation, repository actions, and workspace views.

### 1. Global application header

- Workspace
- Browse
- GitHub
- Theme
- API Settings

### 2. Repository command bar

- repository identity and repository search
- branch and commit
- Tour
- Highlights
- Info
- Zoom
- Fullscreen
- Export
- Refresh
- Permalink
- Files
- Genius
- panel layout toggle

### 3. Centered view dock

- System Map
- Architecture
- Hierarchy
- Mind Map
- Diagrams
- Source
- Genius
- Export Project
- Export
- Build

Every dock item has its own line icon.

The active view uses an amber state with a small indicator dot. On desktop, the dock uses proximity-based magnification: the icon under the pointer grows the most, neighboring icons grow progressively, and icons rise without causing layout reflow.

Touch, narrow-screen, and reduced-motion layouts use a simpler interaction.

---

## Diagram-first workspace

The repository page is centered around one large analysis canvas.

The workspace is designed so that repository context stays visible while the user moves between architecture, hierarchy, source, mind map, Genius, export, and build-oriented views.

The interface supports:

- dark theme
- light theme
- desktop
- tablet
- mobile
- fullscreen
- interactive zoom
- drawer-based Files and Genius panels

---

## Highlights

Highlights can isolate important areas of a repository, including:

- key architecture
- entry points
- core components
- data flow
- API flow
- frontend
- backend
- storage
- external services
- AI components
- hardware
- security-critical parts
- build and deployment
- tests
- documentation
- high-dependency nodes
- Genius highlights
- custom requests such as `authentication flow`

Unrelated nodes can dim while the selected nodes and paths are emphasized.

Highlight results can be labeled as:

- **Source-derived**
- **Genius interpretation**
- **Keyword match**

---

## Software Hierarchy

Software Hierarchy answers:

> How is this software organized?

rather than only:

> Where are the files?

It can expose:

- application layers
- frameworks and SDKs
- services
- APIs
- storage
- drivers
- hardware-facing layers
- tests
- deployment
- key files
- entry points

Possible role badges include:

- `ENTRY POINT`
- `CORE`
- `PUBLIC API`
- `CRITICAL`
- `EXTERNAL`

Embedded repositories can use embedded-specific layer names.

---

## Repository Mind Map

The Repository Mind Map organizes project concepts instead of only folder structure.

It can include:

- architecture
- README features
- entry points
- infrastructure
- dependencies
- documentation
- tests

Selecting a concept can:

- explain it in Genius
- highlight it in the System Map
- highlight it in Architecture
- reveal the related hierarchy branch
- reveal related files

---

## System Map and Guided Tour

The System Map provides a higher-level view of how repository components fit together.

A guided tour can:

- move the camera to the current node
- highlight the edge that led there
- explain the current step
- follow the main flow
- respect reduced-motion settings

System Map output can distinguish repository-backed evidence from model inference.

Each tour step (3 to 12, never padded) names its stage — who or what starts the system, the entry point, the layer that receives control, the next components, the data that moves, external services or devices, where state lives, and what is produced — plus the exact supporting files and whether the step is observed in source, stated in documentation, or a Genius interpretation. Supporting files open in the inspector. The Architecture view also has a structural tour built only from the README, the declared entry point, and located imports, so it works without any AI key.

---

## Genius and verified evidence

Genius is designed to separate verified repository evidence from AI interpretation.

For source-grounded answers, the server can verify:

- repository
- analyzed commit
- file path
- source line
- verbatim quote

against the analyzed GitHub snapshot.

The interface can distinguish:

- **Verified source**
- **Genius inference**

Browser-supplied text alone does not make a citation trusted.

---

## Deep Genius: three teams of agents

Choose **Quick** (structure only, no AI), **Genius** (one AI system map with a guided tour), or **Deep Genius** under Options. Deep Genius always asks first, showing the provider, model, maximum planned calls (13 to 25), concurrency (at most 3 at a time), the approximate input scope, and a cost warning.

```text
Genius Core → repository evidence
  → Team 1 — Audit: reliability · architecture & performance · security & developer experience (in parallel)
  → Team 2 — Solutions: fix planner · architecture engineer · innovation & tooling (in parallel)
  → Validation by Team 1, then at most two revise-and-revalidate loops; anything still disputed is UNRESOLVED with both positions
  → Team 3 — comparison · documentation & diagrams · development pack (validated work only)
  → Genius Core synthesis → final engineering pack
```

Agents receive bounded, retrieved evidence — never the whole repository: files are classified by role, summarized per file, folder, subsystem, and repository, and each agent gets the excerpts that match its focus. Every path, line, and quote an agent returns is checked against the analyzed commit; invented paths and impossible lines are rejected, and anything unchecked stays labeled as Genius inference. Agents return findings, evidence, confidence, and proposed actions only — never hidden reasoning. The **Process** view in the dock animates the pipeline, and each agent card opens its results and evidence.

---

## Export

Quick Export is available from both the repository command bar and the dock.

Supported quick outputs can include:

- PNG
- SVG
- Copy Mermaid
- Download Mermaid
- README Picture
- README Badge

Both Export entry points use the same export system.

---

## Export Project

**Export Project** is the project-level export workspace.

It groups project knowledge into reusable developer outputs.

### Clone Repository

Generate an exact clone workflow for the analyzed repository and commit.

```bash
git clone https://github.com/owner/repository.git
cd repository
git checkout <commit>
```

Credentials are never included in generated clone commands.

### Project Files

Project Files can provide:

- Summary
- Statistics
- Directory Structure
- Important Files
- File Contents

Actions can include:

- Copy All
- Download `.txt`
- Download `.md`

The extract can work with analyzed files or, within configured limits, the entire repository archive.

### Project Diagrams

Supported diagram exports can include:

- Architecture
- System Map
- Software Hierarchy
- Repository Mind Map
- authored diagrams

Available formats can include:

- PNG
- SVG
- Mermaid
- README Picture
- README Badge

### Project Skills

Project Skills can separate:

- observed skills with evidence
- recommended skills with reasons

Export formats can include:

- Markdown
- text
- JSON

### Genius development outputs

Genius prepares development prompts for an AI coding agent. Each prompt is assembled from the analyzed repository's evidence and stamped with its commit; the plan itself is written by the agent you give it to, not by Git Architecture Diagram.

- Development Prompt
- Build Similar App
- MVP Plan prompt
- Frontend Plan prompt
- Backend Plan prompt
- API Plan prompt
- Database Plan prompt
- App Blueprint (assembled from evidence)
- Implementation Roadmap (template from evidence)

### AI / Developer Context

Reusable project knowledge can include:

- AI-ready Context
- Developer Pack
- Project Knowledge Pack
- Project Reconstruction Pack

Verified source material and Genius inference should remain visibly separate.

---

## Project Files extract

Project Files turns repository context into portable text for AI assistants, documentation, or developer onboarding.

The extract can include:

- repository summary
- language and size statistics
- directory structure
- important files
- relevant file contents
- estimated context size
- estimated token count
- include filters
- exclude filters
- largest-file limit

Credential files such as `.env` and private keys must never be read.

Large repositories are handled under configured archive, unpacked-size, file-size, and retained-text limits.

---

## How files are chosen

The analyzer begins with repository evidence such as:

- README files
- manifests
- declared entry points
- local imports/includes

It then follows references into related files.

Examples and tests can be deprioritized when stronger core application files are available.

Analyzed files can record why they were selected.

---

## Run locally

Requires **Node.js 22.12 or newer**.

```bash
git clone https://github.com/ProAmineOfficial/GitArchitectureDiagram.git
cd GitArchitectureDiagram
npm ci
npm start
```

Then open a repository path such as:

```text
http://localhost:3000/ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC
```

Public repositories can be analyzed without an AI provider key.

---

## Optional AI providers

The workspace can support providers configured by the user or operator, including:

- OpenAI
- Claude
- Gemini
- Kimi
- DeepSeek

Each provider offers exactly two recommended models — **Fast** (economy) and **Advanced** (best quality) — checked against the provider's official documentation, refreshed per key from the official model list, and never replaced by an unverified model. A custom model ID stays available under Advanced settings. **Test connection** runs two independent checks — the provider's model list and one tiny structured request — and shows Authentication, Provider reachable, Model available, and Tiny inference, with safe diagnostics. API settings ask only for the AI provider, its key, and the model: the website analyzes public repositories and needs no GitHub token or instance password. Rate limits are retried at most three times (honoring `Retry-After`), an exhausted quota is reported as such, and a provider failure never breaks the structural analysis. See [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md).

The interface can show provider, model, request size, and output limits before an external AI request is sent.

Never commit `.env` or provider credentials.

---

## Generate documentation from the terminal

```bash
npm run analyze -- ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC   --max-files 24   --output .genius
```

A specific ref can be supplied when a reproducible snapshot is required.

---

## Develop and test

```bash
npm run dev
npm run check
npm test
npm run test:browser
npm run build
npm run scan:secrets   # before every push
npm run provenance     # the /api/version fingerprint of this checkout
```

The project includes:

- automated Node tests
- browser checks with Playwright
- GitHub API emulation for deterministic ingestion tests
- browser and Workers-compatible build output

---

## Scope and safety

Repository analysis is intentionally bounded.

Typical safeguards include limits for:

- file count
- per-file size
- retained text
- tree size
- archive size
- unpacked repository size

Generated/vendor folders, likely credential files, symlinks, and binaries can be skipped while still remaining visible in repository structure where useful.

Large monorepos work best when analyzed folder by folder.

No analyzed repository code is executed, built, or installed as part of repository analysis.

Secrets never enter the repository or the browser bundle, every export is scanned and credential-shaped values are redacted, and there is no tracking or telemetry. See [SECURITY.md](SECURITY.md), the permanent [security policy](docs/SECURITY_POLICY.md), and the [legacy file audit](docs/LEGACY_AUDIT.md).

---

## Project vision

Git Architecture Diagram is built to make complex repositories easier to understand, explore, document, export, and extend.

The platform brings together:

- architecture visualization
- system maps
- software hierarchy
- repository mind maps
- source-grounded Genius guidance
- project extraction
- developer-ready exports
- AI-assisted development preparation

The goal is simple:

**Understand. Visualize. Highlight. Extract. Build.**

---

## Built with

- Node.js
- Mermaid
- DOMPurify
- marked
- fflate
- IBM Plex

Third-party licenses remain with their respective authors.

---

## Developed by

Git Architecture Diagram is Created & Developed by Amine Saoud ibn al-Bashir / Pro_Amine LLC.

- Official website: <https://gitarchitecturediagram.com>
- Company: <https://proamine.tech>

Brand assets and their provenance are listed in [docs/BRAND.md](docs/BRAND.md).

---

## License

AGPL-3.0 License. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

Official builds can be verified with public provenance: [PROVENANCE.md](PROVENANCE.md) describes the stable identifiers, `PROVENANCE.json`, and the `/api/version` build fingerprint.

---

## Credits

© 2026 Pro_Amine LLC · Created & Developed **Amine Saoud ibn al-Bashir**  
**ProAmineOfficial / Pro_Amine LLC**
