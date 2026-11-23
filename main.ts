// Solara Heat — the entry program for make.fun's gta6-01 bounty.
// Node 22 standard library only. It copies game/ and screenshots/ from this
// repository into the output directory and writes the dossier that
// vendor/makefun-game.ts builds from them, byte for byte the way the sealed
// scorer builds it. Run it twice and both runs write the same bytes.

import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = new URL('.', import.meta.url).pathname;
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Verify the write before reporting success: the dossier must parse back,
// and the two trees it covers must be the ones we just copied.
const roundTrip = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8'));
if (roundTrip.schema !== 'makefun/dossier/v1') {
  throw new Error(`unexpected dossier schema: ${String(roundTrip.schema)}`);
}
const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true });
const shotFiles = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.'));
if (!gameFiles.includes('index.html')) throw new Error('game/index.html missing from output');
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`expected 3-4 screenshots, found ${shotFiles.length}`);
}

console.log(`solara-heat: wrote ${outDir} (dossier ${dossier.length} bytes, ${gameFiles.length} game entries, ${shotFiles.length} screenshots)`);
