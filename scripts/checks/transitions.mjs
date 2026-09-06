// The hand-over from the typed line to the picture, four ways (score.ts TRANSITIONS), for Diego's eye as lettered clips.
// Renders one painting's film per take with scripts/film.mjs --transition, cuts from the last words typing to the
// picture settled, and with --upload puts each clip on Blob via scripts/check.mjs and prints A–D.
//   node --import ./scripts/_ts.mjs scripts/checks/transitions.mjs [id] [--upload]
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { SCORE } from '../../api/_lib/score.ts';
const args = process.argv.slice(2), upload = args.includes('--upload');
const id = args.find(a => !a.startsWith('--')) ?? 'mtq1fmci-pxhaot'; // After Sunday Dinner
const out = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : 'out';
const letters = { fade: 'A', glow: 'B', resolve: 'C', snap: 'D' };
const from = SCORE.sentence.typedBy - 1.2, to = SCORE.signature.start + 0.4;
for (const [key, letter] of Object.entries(letters)) {
  execFileSync('node', ['--import', './scripts/_ts.mjs', 'scripts/film.mjs', id, '--transition', key, '--out', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  const film = resolve(out, `${id}-${key}.mp4`), clip = resolve(out, `transition-${letter}.mp4`);
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-to', String(to), '-i', film, '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', clip]);
  const url = upload ? execFileSync('node', ['scripts/check.mjs', clip, `transition-${letter}`]).toString().trim() : clip;
  console.log(`${letter}  ${key.padEnd(8)} ${url}`);
}
