// The signature's pen, four ways (score.ts PEN_PRESETS, issue #35), for Diego's ear as lettered clips.
// Renders one painting's film per preset with scripts/film.mjs --pen, cuts the signature window (a little before the
// hand starts to just after the title lands, so the pen is heard against the picture and the note), and with --upload
// puts each clip on Blob via scripts/check.mjs and prints A–D.
//   node --import ./scripts/_ts.mjs scripts/checks/pens.mjs [id] [--upload]
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PEN_PRESETS, SCORE } from '../../api/_lib/score.ts';
const args = process.argv.slice(2), upload = args.includes('--upload');
const id = args.find(a => !a.startsWith('--')) ?? 'mtq1fmci-pxhaot'; // After Sunday Dinner
const out = process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : 'out';
const letters = { quiet: 'A', pencil: 'B', brush: 'C', hush: 'D' };
const from = SCORE.signature.start - 0.8, to = SCORE.title.start + 3.2;
for (const [key, letter] of Object.entries(letters)) {
  execFileSync('node', ['--import', './scripts/_ts.mjs', 'scripts/film.mjs', id, '--pen', key, '--out', out], { stdio: ['ignore', 'ignore', 'inherit'] });
  const film = resolve(out, `${id}-pen-${key}.mp4`), clip = resolve(out, `pen-${letter}.mp4`);
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(from), '-to', String(to), '-i', film, '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', clip]);
  const url = upload ? execFileSync('node', ['scripts/check.mjs', clip, `pen-${letter}`]).toString().trim() : clip;
  console.log(`${letter}  ${key.padEnd(7)} ${String(PEN_PRESETS[key].gainDb).padStart(4)} dB  ${url}`);
}
