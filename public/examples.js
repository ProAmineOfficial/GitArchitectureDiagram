// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-WORKSPACE-UI-001
// Project: Git Architecture Diagram | Component: Saved example snapshots | Author: Amine Saoud ibn al-Bashir.
// Each entry was measured by running this analyzer (see "analyzer") on the pinned commit. The counts describe what the
// analyzer read and found; they are not stars, usage numbers, or test results. Previews are the generated overview or the
// repository author's own Mermaid, stored so the Browse page can draw them without a new analysis.
export const EXAMPLES = [
 {
  "title": "NanoKit · Ultrasonic sensor project",
  "description": "A complete PlatformIO example: firmware, wiring guide, and the author's own colored flowchart and connection diagram.",
  "kind": "Embedded project",
  "repository": "ProAmineOfficial/NanoKit-ESP32",
  "sha": "17834db850daec9b450239069c4aa2e758bf0644",
  "scope": "examples_on_platformio/ultrasonic_distance",
  "maxFiles": 24,
  "readFiles": 12,
  "listedFiles": 13,
  "relationships": 0,
  "diagrams": 2,
  "components": 9,
  "checkedAt": "2026-09-29T04:29:28.817Z",
  "analyzer": "0.4.0",
  "preview": "flowchart TD\n%% Component overview. Folders come from the file tree, and arrows come only from located imports or includes.\nsubgraph g0[\"External, imported\"]\n  n10[\"Arduino.h<br/>used 1×\"]:::external\nend\nn0[/\"NanoKit-ESP32 / ultrasonic_distance root<br/>3 files · 2 read\"/]:::config\nn1>\"docs<br/>2 files · 2 read\"]:::docs\nn2>\".genius<br/>1 file · 1 read\"]:::docs\nn3[/\".vscode<br/>1 file · 1 read\"/]:::config\nn4[(\"assets<br/>1 file · 1 read\")]:::assets\nn5[(\"images<br/>1 file · 1 read\")]:::assets\nn6>\"include<br/>1 file · 1 read\"]:::docs\nn7>\"lib<br/>1 file · 1 read\"]:::docs\nn8[\"src<br/>1 file · 1 read\"]:::source\nn9{{\"test<br/>1 file · 1 read\"}}:::tests\nn8 -->|uses| n10\nclassDef entry fill:#12334c,stroke:#66d4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef source fill:#123638,stroke:#55d6ca,stroke-width:1.6px,color:#f3f7ff\nclassDef ui fill:#3c2349,stroke:#e3a0ed,stroke-width:1.6px,color:#f3f7ff\nclassDef hardware fill:#173d2c,stroke:#79d99b,stroke-width:1.6px,color:#f3f7ff\nclassDef service fill:#1c2f4d,stroke:#8fb3ff,stroke-width:1.6px,color:#f3f7ff\nclassDef data fill:#2a2f3d,stroke:#9fb0c8,stroke-width:1.6px,color:#f3f7ff\nclassDef config fill:#44341b,stroke:#f2c66d,stroke-width:1.6px,color:#f3f7ff\nclassDef docs fill:#2d2550,stroke:#b9a4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef tests fill:#2f3a17,stroke:#c3e36b,stroke-width:1.6px,color:#f3f7ff\nclassDef examples fill:#1d3340,stroke:#6fc3df,stroke-width:1.6px,color:#f3f7ff\nclassDef automation fill:#45281c,stroke:#ff9f68,stroke-width:1.6px,color:#f3f7ff\nclassDef assets fill:#26303b,stroke:#8aa0b6,stroke-width:1.6px,color:#f3f7ff\nclassDef external fill:#1b212b,stroke:#8a96a8,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4\nclassDef concept fill:#1f2430,stroke:#b0b8c6,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4"
 },
 {
  "title": "NanoKit · Ultrasonic workflow",
  "description": "Just the documentation folder, so the author's Mermaid flowchart opens first with its original styles.",
  "kind": "Documented workflow",
  "repository": "ProAmineOfficial/NanoKit-ESP32",
  "sha": "17834db850daec9b450239069c4aa2e758bf0644",
  "scope": "examples_on_platformio/ultrasonic_distance/docs",
  "maxFiles": 12,
  "readFiles": 2,
  "listedFiles": 2,
  "relationships": 0,
  "diagrams": 1,
  "components": 0,
  "checkedAt": "2026-09-29T04:29:28.838Z",
  "analyzer": "0.4.0",
  "preview": "flowchart TD\n  A([Start loop]) --> B{250 ms elapsed?}\n  B -- No --> A\n  B -- Yes --> C(Send trigger pulse)\n  C --> D[/Measure echo pulse/]\n  D --> E{Echo received?}\n  E -- No --> F(Print no echo warning)\n  E -- Yes --> G(Convert time to distance)\n  G --> H(Median filter readings)\n  H --> I[/Print distance/]\n  F --> A\n  I --> A\n\n  classDef start fill:#17303b,stroke:#61cef3,stroke-width:1.8px,color:#f3fbff\n  classDef process fill:#1a2631,stroke:#7b9bb0,stroke-width:1.6px,color:#f4f8fb\n  classDef decision fill:#362f18,stroke:#e0c45b,stroke-width:1.8px,color:#fff9de\n  classDef io fill:#15313c,stroke:#43d5ca,stroke-width:1.8px,color:#f3fffd\n  classDef safety fill:#3a2025,stroke:#ef747d,stroke-width:1.8px,color:#fff3f4\n  class A start\n  class B,E decision\n  class C,G,H process\n  class D,I io\n  class F safety\n  linkStyle default stroke:#7894a5,stroke-width:1.4px\n"
 },
 {
  "title": "Express",
  "description": "Follows package.json to index.js and into lib/, then shows how the examples and tests reach the core.",
  "kind": "Web framework",
  "repository": "expressjs/express",
  "sha": "98bd4cd96b250d25e1672c36f49cfc743bc801e7",
  "scope": "",
  "maxFiles": 32,
  "readFiles": 32,
  "listedFiles": 214,
  "relationships": 35,
  "diagrams": 0,
  "components": 4,
  "checkedAt": "2026-09-29T04:29:29.018Z",
  "analyzer": "0.4.0",
  "preview": "flowchart TD\n%% Component overview. Folders come from the file tree, and arrows come only from located imports or includes.\nsubgraph g0[\"External, imported · 34 more\"]\n  n5[\"morgan<br/>used 4×\"]:::external\n  n6[\"debug<br/>used 2×\"]:::external\n  n7[\"escape-html<br/>used 2×\"]:::external\n  n8[\"express-session<br/>used 2×\"]:::external\n  n9[\"http-errors<br/>used 2×\"]:::external\nend\nn0([\"express root<br/>10 files · 3 read\"]):::entry\nn1[[\"examples<br/>80 files · 20 read\"]]:::examples\nn2[\"lib<br/>6 files · 6 read\"]:::source\nn3[\\\".github<br/>6 files · 2 read\"\\]:::automation\nn4{{\"test<br/>112 files · 1 read\"}}:::tests\nn0 -->|imports| n2\nn4 -->|imports| n0\nn1 -->|imports ×18| n0\nn1 -->|uses ×4| n5\nn2 -->|uses ×2| n6\nn2 -->|uses| n7\nn1 -->|uses| n7\nn1 -->|uses ×2| n8\nn2 -->|uses| n9\nn1 -->|uses| n9\nclassDef entry fill:#12334c,stroke:#66d4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef source fill:#123638,stroke:#55d6ca,stroke-width:1.6px,color:#f3f7ff\nclassDef ui fill:#3c2349,stroke:#e3a0ed,stroke-width:1.6px,color:#f3f7ff\nclassDef hardware fill:#173d2c,stroke:#79d99b,stroke-width:1.6px,color:#f3f7ff\nclassDef service fill:#1c2f4d,stroke:#8fb3ff,stroke-width:1.6px,color:#f3f7ff\nclassDef data fill:#2a2f3d,stroke:#9fb0c8,stroke-width:1.6px,color:#f3f7ff\nclassDef config fill:#44341b,stroke:#f2c66d,stroke-width:1.6px,color:#f3f7ff\nclassDef docs fill:#2d2550,stroke:#b9a4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef tests fill:#2f3a17,stroke:#c3e36b,stroke-width:1.6px,color:#f3f7ff\nclassDef examples fill:#1d3340,stroke:#6fc3df,stroke-width:1.6px,color:#f3f7ff\nclassDef automation fill:#45281c,stroke:#ff9f68,stroke-width:1.6px,color:#f3f7ff\nclassDef assets fill:#26303b,stroke:#8aa0b6,stroke-width:1.6px,color:#f3f7ff\nclassDef external fill:#1b212b,stroke:#8a96a8,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4\nclassDef concept fill:#1f2430,stroke:#b0b8c6,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4"
 },
 {
  "title": "NanoKit-ESP32 monorepo",
  "description": "Dozens of PlatformIO projects in one repository; the overview groups them into project collections.",
  "kind": "Embedded monorepo",
  "repository": "ProAmineOfficial/NanoKit-ESP32",
  "sha": "17834db850daec9b450239069c4aa2e758bf0644",
  "scope": "",
  "maxFiles": 40,
  "readFiles": 40,
  "listedFiles": 195,
  "relationships": 34,
  "diagrams": 4,
  "components": 13,
  "checkedAt": "2026-09-29T04:29:29.210Z",
  "analyzer": "0.4.0",
  "preview": "flowchart TD\n%% Component overview. Folders come from the file tree, and arrows come only from located imports or includes.\nsubgraph g0[\"External, imported · 3 more\"]\n  n14[\"Arduino.h<br/>used 10×\"]:::external\n  n15[\"freertos/FreeRTOS.h<br/>used 2×\"]:::external\n  n16[\"freertos/queue.h<br/>used 2×\"]:::external\n  n17[\"WebServer.h<br/>used 2×\"]:::external\n  n18[\"ESPmDNS.h<br/>used 1×\"]:::external\nend\nn0[/\"NanoKit-ESP32 root<br/>10 files · 1 read\"/]:::config\nn1[[\"open_source_projects<br/>71 files · 27 read\"]]:::examples\nn2[[\"examples_on_platformio<br/>37 files · 8 read · 3 projects\"]]:::examples\nn3[[\"applications_on_platformio<br/>18 files · 3 read\"]]:::examples\nn4>\"docs<br/>14 files · 1 read\"]:::docs\nn5>\"graduation_projects<br/>9 files · not read\"]:::docs\nn6>\"articles<br/>8 files · not read\"]:::docs\nn7[(\"assets<br/>7 files · not read\")]:::assets\nn8>\"tutorials<br/>6 files · not read\"]:::docs\nn9>\"simulator<br/>5 files · not read\"]:::docs\nn10>\"templates<br/>5 files · not read\"]:::docs\nn11[\\\".github<br/>2 files · not read\"\\]:::automation\nn12[\\\"tools<br/>2 files · not read\"\\]:::automation\nn13[\\\".githooks<br/>1 file · not read\"\\]:::automation\nn2 -->|uses ×3| n14\nn3 -->|uses| n14\nn1 -->|uses ×6| n14\nn1 -->|uses ×2| n15\nn1 -->|uses ×2| n16\nn1 -->|uses ×2| n17\nn1 -->|uses| n18\nclassDef entry fill:#12334c,stroke:#66d4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef source fill:#123638,stroke:#55d6ca,stroke-width:1.6px,color:#f3f7ff\nclassDef ui fill:#3c2349,stroke:#e3a0ed,stroke-width:1.6px,color:#f3f7ff\nclassDef hardware fill:#173d2c,stroke:#79d99b,stroke-width:1.6px,color:#f3f7ff\nclassDef service fill:#1c2f4d,stroke:#8fb3ff,stroke-width:1.6px,color:#f3f7ff\nclassDef data fill:#2a2f3d,stroke:#9fb0c8,stroke-width:1.6px,color:#f3f7ff\nclassDef config fill:#44341b,stroke:#f2c66d,stroke-width:1.6px,color:#f3f7ff\nclassDef docs fill:#2d2550,stroke:#b9a4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef tests fill:#2f3a17,stroke:#c3e36b,stroke-width:1.6px,color:#f3f7ff\nclassDef examples fill:#1d3340,stroke:#6fc3df,stroke-width:1.6px,color:#f3f7ff\nclassDef automation fill:#45281c,stroke:#ff9f68,stroke-width:1.6px,color:#f3f7ff\nclassDef assets fill:#26303b,stroke:#8aa0b6,stroke-width:1.6px,color:#f3f7ff\nclassDef external fill:#1b212b,stroke:#8a96a8,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4\nclassDef concept fill:#1f2430,stroke:#b0b8c6,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4"
 },
 {
  "title": "NanoKit USB driver package",
  "description": "Mostly binaries: Windows driver files and PCB footprints. The analyzer reads the text it can and labels the rest.",
  "kind": "Hardware package",
  "repository": "ProAmineOfficial/Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC",
  "sha": "4fddb896b515fc31896737c2fbe9b71478947969",
  "scope": "",
  "maxFiles": 12,
  "readFiles": 5,
  "listedFiles": 18,
  "relationships": 0,
  "diagrams": 0,
  "components": 2,
  "checkedAt": "2026-09-29T04:29:29.249Z",
  "analyzer": "0.4.0",
  "preview": "flowchart TD\n%% Component overview. Folders come from the file tree, and arrows come only from located imports or includes.\nn0[/\"Driver-NanoKit-ESP32-of-T.U.M-Pro_Amine-IC root<br/>5 files · 1 read\"/]:::config\nn1[/\"Nanokit ESP32 Driver Install<br/>11 files · 4 read\"\\]:::hardware\nn2[/\"Libraries Nanokit 40 Pins SMD Pcb Footprint<br/>2 files · not read\"\\]:::hardware\nclassDef entry fill:#12334c,stroke:#66d4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef source fill:#123638,stroke:#55d6ca,stroke-width:1.6px,color:#f3f7ff\nclassDef ui fill:#3c2349,stroke:#e3a0ed,stroke-width:1.6px,color:#f3f7ff\nclassDef hardware fill:#173d2c,stroke:#79d99b,stroke-width:1.6px,color:#f3f7ff\nclassDef service fill:#1c2f4d,stroke:#8fb3ff,stroke-width:1.6px,color:#f3f7ff\nclassDef data fill:#2a2f3d,stroke:#9fb0c8,stroke-width:1.6px,color:#f3f7ff\nclassDef config fill:#44341b,stroke:#f2c66d,stroke-width:1.6px,color:#f3f7ff\nclassDef docs fill:#2d2550,stroke:#b9a4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef tests fill:#2f3a17,stroke:#c3e36b,stroke-width:1.6px,color:#f3f7ff\nclassDef examples fill:#1d3340,stroke:#6fc3df,stroke-width:1.6px,color:#f3f7ff\nclassDef automation fill:#45281c,stroke:#ff9f68,stroke-width:1.6px,color:#f3f7ff\nclassDef assets fill:#26303b,stroke:#8aa0b6,stroke-width:1.6px,color:#f3f7ff\nclassDef external fill:#1b212b,stroke:#8a96a8,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4\nclassDef concept fill:#1f2430,stroke:#b0b8c6,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4"
 },
 {
  "title": "Git Architecture Diagram",
  "description": "This analyzer, analyzing itself: a Node server, a Workers entry point, and the browser workspace.",
  "kind": "Web application",
  "repository": "ProAmineOfficial/GitArchitectureDiagram",
  "sha": "7479a8dc36a179fd2b86c2ee09e48c6af4cfde1d",
  "scope": "",
  "maxFiles": 32,
  "readFiles": 32,
  "listedFiles": 41,
  "relationships": 28,
  "diagrams": 1,
  "components": 7,
  "checkedAt": "2026-09-29T04:29:29.356Z",
  "analyzer": "0.4.0",
  "preview": "flowchart TD\n%% Component overview. Folders come from the file tree, and arrows come only from located imports or includes.\nsubgraph g0[\"External, imported\"]\n  n8[\"esbuild<br/>used 2×\"]:::external\n  n9[\"miniflare<br/>used 1×\"]:::external\nend\nn0([\"GitArchitectureDiagram root<br/>14 files · 7 read\"]):::entry\nn1(\"public<br/>7 files · 6 read\"):::ui\nn2{{\"tests<br/>6 files · 6 read\"}}:::tests\nn3[\"src<br/>5 files · 5 read\"]:::source\nn4>\"docs<br/>5 files · 4 read\"]:::docs\nn5[\\\"scripts<br/>2 files · 2 read\"\\]:::automation\nn6[\\\".github<br/>1 file · 1 read\"\\]:::automation\nn7[\".openai<br/>1 file · 1 read\"]:::source\nn0 -->|imports ×6| n3\nn2 -->|imports ×2| n1\nn2 -->|imports ×6| n3\nn2 -->|imports ×2| n0\nn5 -->|uses| n8\nn2 -->|uses| n8\nn2 -->|uses| n9\nclassDef entry fill:#12334c,stroke:#66d4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef source fill:#123638,stroke:#55d6ca,stroke-width:1.6px,color:#f3f7ff\nclassDef ui fill:#3c2349,stroke:#e3a0ed,stroke-width:1.6px,color:#f3f7ff\nclassDef hardware fill:#173d2c,stroke:#79d99b,stroke-width:1.6px,color:#f3f7ff\nclassDef service fill:#1c2f4d,stroke:#8fb3ff,stroke-width:1.6px,color:#f3f7ff\nclassDef data fill:#2a2f3d,stroke:#9fb0c8,stroke-width:1.6px,color:#f3f7ff\nclassDef config fill:#44341b,stroke:#f2c66d,stroke-width:1.6px,color:#f3f7ff\nclassDef docs fill:#2d2550,stroke:#b9a4ff,stroke-width:1.6px,color:#f3f7ff\nclassDef tests fill:#2f3a17,stroke:#c3e36b,stroke-width:1.6px,color:#f3f7ff\nclassDef examples fill:#1d3340,stroke:#6fc3df,stroke-width:1.6px,color:#f3f7ff\nclassDef automation fill:#45281c,stroke:#ff9f68,stroke-width:1.6px,color:#f3f7ff\nclassDef assets fill:#26303b,stroke:#8aa0b6,stroke-width:1.6px,color:#f3f7ff\nclassDef external fill:#1b212b,stroke:#8a96a8,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4\nclassDef concept fill:#1f2430,stroke:#b0b8c6,stroke-width:1.6px,color:#f3f7ff,stroke-dasharray:5 4"
 }
];
