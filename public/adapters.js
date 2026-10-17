// Copyright © 2026 Pro_Amine LLC
// Created & Developed by Amine Saoud ibn al-Bashir
// Git Architecture Diagram · SPDX-License-Identifier: AGPL-3.0-only · Provenance ID: GAD-ENGINEERING-001
// Project: Git Architecture Diagram | Component: the Genius ToolHub domain-adapter catalogue.
//
// One adapter runs here today: the NanoKit Integrated ESP32 electronics adapter, which wraps the already-tested
// public/boards.js checks. Every other domain is registered as a descriptor with no backend, so the ToolHub reports it
// as planned or needs_tool or needs_approval and never offers a control that cannot work. Adding a real backend later
// means giving that descriptor an execute() and a worker, not changing the registry. Nothing here executes external
// tools, generated code, or uploaded files.
import { defineAdapter, createRegistry } from './toolhub.js';
import { validatePinUse, checkWiring, wiringTable, pinHeader, suggestPins, availablePins } from './boards.js';

/** The one adapter with a real backend. The caller passes the gad.board/1 profile in the job input (input.board). */
export const nanokitElectronicsAdapter = defineAdapter({
  id: 'electronics-nanokit',
  version: '1.0.0',
  displayName: 'NanoKit Integrated ESP32 electronics',
  domains: ['electronics', 'embedded'],
  capabilities: [
    { id: 'validate-pin', summary: 'Check one pin use against the board rules', input: '{ board, pin | gpio, role, signalVoltage? }', output: 'a verdict with its reasons' },
    { id: 'check-wiring', summary: 'Check a whole wiring plan for conflicts and electrical rules', input: '{ board, connections[] }', output: 'per-connection verdicts and an overall verdict' },
    { id: 'wiring-table', summary: 'Board pin, GPIO, VR, and component pin for each connection', input: '{ board, connections[] }', output: 'a wiring table' },
    { id: 'pin-header', summary: 'A C header of pin #defines (GPIO numbers; board pin in comments)', input: '{ board, connections[] }', output: 'C source text' },
    { id: 'suggest-pins', summary: 'Candidate pins for a role, best first', input: '{ board, role, exclude? }', output: 'ranked pin verdicts' },
    { id: 'available-pins', summary: 'Usable pins a plan has not taken', input: '{ board, connections[] }', output: 'a list of pins' },
  ],
  supportedInputs: ['application/json: a gad.board/1 profile and a list of connections'],
  supportedOutputs: ['verdicts', 'wiring table (JSON)', 'C header (text)'],
  requiredTools: [],
  dependencies: [{ name: 'public/boards.js', license: 'AGPL-3.0-only', scope: 'internal' }],
  environment: 'in-process (pure functions; no network, no filesystem, no execution of inputs)',
  validationMethods: ['published ESP32 and NanoKit pin rules — not an electrical measurement'],
  securityPolicy: 'reads the profile and the plan only; never executes an input',
  provenance: 'GAD-BOARD-BSP / GAD-ENGINEERING-001',
  notes: 'The checks are documentation rules; a passing result is never marked electrically verified.',
  execute(capability, input = {}) {
    const board = input.board;
    if (!board) throw new Error('input.board (a gad.board/1 profile) is required.');
    const connections = Array.isArray(input.connections) ? input.connections : [];
    switch (capability) {
      case 'validate-pin': return validatePinUse(board, input);
      case 'check-wiring': return checkWiring(board, connections);
      case 'wiring-table': return wiringTable(board, connections);
      case 'pin-header': return pinHeader(board, connections);
      case 'suggest-pins': return suggestPins(board, input, { exclude: input.exclude || [] });
      case 'available-pins': return availablePins(board, connections);
      default: throw new Error(`unknown capability ${capability}`);
    }
  },
});

/**
 * Descriptors with no backend here. Each is honest about what it would need to run: a tool to install, a credential, or
 * owner approval. The ToolHub reports them as planned / needs_tool / needs_approval, never as available, until a real
 * execute() and an isolated worker exist. No generated code, external tool, or uploaded file is run by any of these.
 */
const planned = [
  { id: 'firmware-platformio', displayName: 'PlatformIO firmware build', domains: ['electronics', 'embedded', 'firmware'], requiredTools: [{ name: 'platformio', purpose: 'build and test ESP32 firmware' }], capabilities: [{ id: 'build', summary: 'Compile a PlatformIO project and report the real build log' }], validationMethods: ['pio run exit code and log'], securityPolicy: 'runs generated code; requires an isolated, network-off worker', notes: 'Needs a sandboxed build worker; not installed here.' },
  { id: 'pcb-kicad', displayName: 'KiCad schematic, PCB, and manufacturing outputs', domains: ['electronics', 'pcb'], requiredTools: [{ name: 'kicad-cli', purpose: 'ERC, DRC, Gerber, drill, BOM, STEP' }], capabilities: [{ id: 'erc', summary: 'Electrical rules check' }, { id: 'drc', summary: 'Design rules check' }, { id: 'fabrication', summary: 'Gerber, drill, BOM, pick-and-place from a valid board' }], validationMethods: ['kicad-cli ERC/DRC reports and exit codes'], securityPolicy: 'runs a desktop tool in a worker', notes: 'Needs kicad-cli in a worker. Generated files are not valid KiCad designs until KiCad accepts them. Altium libraries need conversion and verification, not direct consumption.' },
  { id: 'mechanical-blender', displayName: 'Blender 3D and enclosures', domains: ['mechanical', '3d'], requiredTools: [{ name: 'blender', purpose: 'headless Python scripting, STL/GLTF export, renders' }], capabilities: [{ id: 'model', summary: 'Run a generation script and export geometry' }], validationMethods: ['blender -b -P exit code and exported geometry'], securityPolicy: 'runs generated Python in a worker', notes: 'A render is never a manufacturing-ready CAD model.' },
  { id: 'mechanical-freecad', displayName: 'FreeCAD parametric CAD', domains: ['mechanical', 'cad'], requiredTools: [{ name: 'freecadcmd', purpose: 'parametric solids, STEP/STL export' }], capabilities: [{ id: 'model', summary: 'Build a parametric model and export STEP/STL' }], validationMethods: ['FreeCADCmd exit code and geometry checks'], securityPolicy: 'runs generated Python in a worker', notes: 'Not installed here.' },
  { id: 'software-web', displayName: 'Web application preview and tests', domains: ['software', 'web'], requiredTools: [{ name: 'node', purpose: 'build' }, { name: 'playwright', purpose: 'browser tests' }], capabilities: [{ id: 'preview', summary: 'Sandboxed preview' }, { id: 'test', summary: 'Automated browser tests' }], validationMethods: ['Playwright results'], securityPolicy: 'runs generated code in an isolated, network-off preview', notes: 'Needs a sandboxed preview worker.' },
  { id: 'software-flutter', displayName: 'Flutter application', domains: ['software', 'mobile'], requiredTools: [{ name: 'flutter', purpose: 'analyze, test, build' }], capabilities: [{ id: 'analyze', summary: 'flutter analyze' }, { id: 'test', summary: 'flutter test' }], validationMethods: ['flutter analyze and test output'], securityPolicy: 'runs in a worker', notes: 'A signed app is never claimed without the platform build.' },
  { id: 'science-python', displayName: 'Python scientific computing', domains: ['science', 'mathematics', 'physics'], requiredTools: [{ name: 'python', purpose: 'NumPy/SciPy/SymPy/Jupyter' }], capabilities: [{ id: 'run', summary: 'Run a reproducible notebook or script' }], validationMethods: ['execution record: inputs, code hash, package versions'], securityPolicy: 'runs generated code in a network-off worker', notes: 'A simulation is never presented as a physical result.' },
  { id: 'construction-bim', displayName: 'Construction and BIM', domains: ['construction', 'bim'], requiredTools: [{ name: 'ifcopenshell', purpose: 'read and inspect IFC' }], capabilities: [{ id: 'inspect', summary: 'Read supported IFC models' }], validationMethods: ['IfcOpenShell parse results'], securityPolicy: 'reads files in a worker', notes: 'No native DWG generation without licensed tooling.' },
  { id: 'semiconductor-eda', displayName: 'Semiconductor Studio (RTL to layout)', domains: ['semiconductor'], requiredTools: [{ name: 'yosys', purpose: 'synthesis' }, { name: 'openroad', purpose: 'place and route' }, { name: 'verilator', purpose: 'simulation' }], capabilities: [{ id: 'simulate', summary: 'RTL simulation' }, { id: 'synthesize', summary: 'Logic synthesis' }, { id: 'implement', summary: 'Physical design to a layout' }], validationMethods: ['tool logs, timing, DRC, LVS'], securityPolicy: 'runs an EDA toolchain in a worker with a PDK', notes: 'A generated GDSII is never fabrication-ready without independent signoff. Needs owner-approved PDK access.', requiresApproval: 'semiconductor-pdk-and-toolchain' },
  { id: 'algorithm-intelligence', displayName: 'Algorithm Intelligence', domains: ['software', 'analysis'], capabilities: [{ id: 'analyze', summary: 'Identify and explain algorithms from accessible source, with evidence' }], validationMethods: ['source citations with file and line'], securityPolicy: 'source-grounded; no execution of the analysed project', notes: 'Planned. Inaccessible proprietary algorithms are never claimed as recovered.', requiresApproval: 'algorithm-intelligence' },
  { id: 'reverse-engineer', displayName: 'Reverse Engineer Any Product (REP)', domains: ['software', 'analysis'], requiredTools: [{ name: 'authorized-disassembler', purpose: 'inspect authorized binaries in a sandbox' }], capabilities: [{ id: 'inspect', summary: 'Inspect authorized, user-owned artifacts only, with evidence and confidence' }], validationMethods: ['tool metadata and evidence, clearly labelled'], securityPolicy: 'authorized artifacts only; uploads are never executed; isolated worker; owner approval required', notes: 'Planned and gated. Limited to lawful, authorized analysis; respects licenses, attribution, and access controls.', requiresApproval: 'rep-authorized-analysis' },
];

export const PLANNED_ADAPTERS = Object.freeze(planned.map(descriptor => defineAdapter({
  version: '0.0.0',
  supportedInputs: [],
  supportedOutputs: [],
  ...descriptor,
})));

/** Every adapter the ToolHub knows: the working one first, then the planned descriptors. */
export const CATALOG = Object.freeze([nanokitElectronicsAdapter, ...PLANNED_ADAPTERS]);

/** A registry built from the catalogue. */
export const defaultRegistry = () => createRegistry(CATALOG);
