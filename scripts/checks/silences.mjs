// The five silences alone (score.ts SILENCES), 8 s each, no keys and no pen, for Diego's ear as lettered clips.
// Writes silence-<key>.m4a into the given dir and, with --upload, puts each on Blob via scripts/check.mjs and prints A–E.
//   node --import ./scripts/_ts.mjs scripts/checks/silences.mjs <outdir> [--upload]
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { soundtrack } from '../../api/_lib/sound.ts';
import { SILENCE_KEYS, SILENCES } from '../../api/_lib/score.ts';
const out = process.argv[2] || '.', upload = process.argv.includes('--upload');
const letters = 'ABCDE';
SILENCE_KEYS.forEach((k, i) => {
  const wav = `${out}/silence-${k}.wav`, m4a = `${out}/silence-${k}.m4a`;
  writeFileSync(wav, soundtrack({ id: 'mtq1fmci-pxhaot', cues: [], ink: null, silence: k }));
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-t', '8', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', m4a]);
  const url = upload ? execFileSync('node', ['scripts/check.mjs', m4a, `silence-${letters[i]}`]).toString().trim() : m4a;
  console.log(`${letters[i]}  ${k.padEnd(9)} ${SILENCES[k].name.padEnd(26)} ${url}`);
});
