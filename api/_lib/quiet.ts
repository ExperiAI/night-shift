// A quiet studio commissions itself (issue #37). Instagram's own floor is ten Reels a month (docs/instagram.md);
// on 2026-09-26 the studio had posted two in seventeen days, so nothing it tried on the film could be read.
// Diego, 2026-09-26: "go ahead" on one a day at most, credited to the studio, never passed off as a person.
// The critic run calls this after the exams: when no one outside the studio has asked for anything in a day,
// the studio sends one ordinary moment through the public desk under its own name. The gatekeeper, the
// inspector and the studio cap judge it like anyone's, so a weak canvas is refused, not posted.
import { chatJSON } from './openrouter.js';
import { isStudioSender, isStudioPlumbing } from './artist.js';

/** A day with no outside commission is a quiet one. */
export const QUIET_HOURS = 24;
/** The studio's own last commission must be at least this old, so a re-run of the critic never files a second one. */
export const STUDIO_GAP_HOURS = 20;
/** Short enough to type in about a second and a half (issue #48: most viewers leave in the first three). */
export const MOMENT_MAX_CHARS = 60;

type Doc = { text: string; from?: string | null; created: string; status: string; seed?: string };

/** True when nobody outside the studio has had a commission accepted in the last day, and the studio has not
 *  commissioned itself recently. Declined and burned work does not count: it never became a painting. */
export function isQuiet(docs: Doc[], now = Date.now()): boolean {
  const within = (d: Doc, hours: number) => Date.parse(d.created) > now - hours * 3_600_000;
  const outside = docs.some(d => within(d, QUIET_HOURS) && !isStudioSender(d.from) && !isStudioPlumbing(d) && d.status !== 'declined' && d.status !== 'withdrawn');
  const studio = docs.some(d => within(d, STUDIO_GAP_HOURS) && isStudioSender(d.from));
  return !outside && !studio;
}

export function momentSystemPrompt(): string {
  return [
    'You pick tonight\'s subject for a painter who paints the place where something happened, minutes after everyone left: one light, at night, no people.',
    'Write ONE ordinary moment, the kind a stranger sends by DM: the moment itself, as it happened, shared and recognisable, a little specific ("a visit to the zoo", "first day of school", "sunday dinner with the family", "moving out of my first flat"). Never its aftermath: no "after", no "the last", no "gone home" — the painter adds the after.',
    `At most ${MOMENT_MAX_CHARS} characters, lowercase unless a proper noun, no full stop. It opens a short film, so the first words must make a stranger want to see it.`,
    'Never: news, disasters, deaths, illness, politics, brands, a named or real person, anything private or sad enough to exploit. Never a subject close to one already painted (listed below).',
    'Respond ONLY with JSON: {"moment": string}',
  ].join('\n');
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** One moment the studio has not painted before, or null when the model gives nothing usable twice. */
export async function pickMoment(docs: Doc[], ask: (system: string, user: string) => Promise<{ moment?: string }> = (s, u) => chatJSON(s, u)): Promise<string | null> {
  const recent = [...docs].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 40).map(d => `- ${d.text.slice(0, 80)}`).join('\n');
  const seen = new Set(docs.map(d => norm(d.text)));
  let user = `Already painted, newest first:\n${recent}`;
  for (let i = 0; i < 2; i++) {
    const m = String((await ask(momentSystemPrompt(), user).catch(() => ({})) as { moment?: string }).moment ?? '').trim().replace(/[.。]+$/, '');
    if (m.length >= 8 && m.length <= MOMENT_MAX_CHARS && !seen.has(norm(m))) return m;
    user += `\n\nNot "${m.slice(0, 80)}": it is empty, over ${MOMENT_MAX_CHARS} characters, or already painted. Another.`;
  }
  return null;
}
