// Solmar Heat — entrypoint for the gta6-01 bounty (Node 22, stdlib only).
//
// Hands the game in: copies this repo's game/ and screenshots/ beside this
// file into the output directory, then writes dossier.json with the kit's
// vendored make.fun library, which is what the judge reads.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: the gate refuses an entry with the wrong screenshots, so
// check them here first and fail with a plain error instead of a cryptic
// one from the dossier builder.
function checkScreenshots() {
  const dir = join(here, 'screenshots');
  if (!existsSync(dir)) throw new Error('screenshots/ is missing: add 3 or 4 real screenshots of the game');
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (names.length < 3 || names.length > 4) {
    throw new Error(`screenshots/ holds ${names.length} images, need 3 or 4`);
  }
  for (const name of names) {
    const path = join(dir, name);
    const bytes = statSync(path).size;
    if (bytes > 262144) throw new Error(`screenshots/${name} is ${bytes} bytes, over the 256 KiB cap`);
    const head = readFileSync(path).subarray(0, 4);
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    if (!isJpeg && !isPng) throw new Error(`screenshots/${name} is not a JPEG or PNG file`);
  }
  return names;
}

const shotNames = checkScreenshots();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The gate's own caps, from the kit rules: the dossier text cap shapes the
// bytes; the rest refuse an entry the scorer would refuse anyway.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Solmar Heat handed in to ${out}`);
console.log(`  screenshots (${shotNames.length}): ${shotNames.join(', ')}`);
console.log(`  game files: ${readdirSync(join(out, 'game'), { recursive: true }).length} entries under game/`);
