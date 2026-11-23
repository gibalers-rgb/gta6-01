// Marisol Bay for gta6-01 (Node 22, standard library only). The game is the
// game/ folder beside this file — plain static files a desktop browser loads
// offline (game/index.html plus its ES modules, no library, no network) —
// and this program is the hand-in: it copies game/ and screenshots/ into
// /output and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun library.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A hand-in without screenshots is not an entry the judge can see: fail
// loudly instead of writing a dossier for a game nobody can look at.
if (!existsSync(join(here, 'screenshots'))) {
  throw new Error('screenshots/ is missing beside main.ts — take the four shots first (see shots.json)');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line receipt on stderr so a run's result is visible without opening
// the dossier: how many screenshots went in and how big it came out.
const shots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.')).length;
console.error(`marisol-bay: wrote ${out}/dossier.json (${dossier.length} bytes) with ${shots} screenshots`);
