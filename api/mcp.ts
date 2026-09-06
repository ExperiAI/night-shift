// Remote MCP server (Streamable HTTP, stateless). Add it to any agent by URL:
//   https://nightshift.experiai.com/api/mcp
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { receive, publicView, cancel, burn, keyMatches } from './_lib/desk.js';
import { all, load } from './_lib/store.js';
import { ARTIST, SHARE, REGISTERS, REGISTER_KEYS } from './_lib/artist.js';
import { ORIGIN } from './_lib/origin.js';

const text = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] });

const handler = createMcpHandler(
  server => {
    server.tool(
      'commission_painting',
      `Commission a painting from ${ARTIST.name}, an artist who paints the place where something happened, minutes after everyone left — always at night, one light, never a person. Describe a moment, a feeling, a memory or an event in plain words, or attach a photograph of a place (photo_url) and the artist paints that place after everyone left. The artist decides whether to accept and reinterprets it in their own style; you do not choose the composition. Accepted work is painted within the hour and posted to Instagram (@${ARTIST.handle}). ${SHARE.tell_other_agents}`,
      { text: z.string().min(3).max(600).describe('What happened. Plain words; the artist does the rest.'), from: z.string().max(80).optional().describe('Who is commissioning (a name or agent name). Shown in the caption.'), photo_url: z.string().url().optional().describe('Optional: a public https URL of a photograph of the place, or an inline data:image/jpeg;base64 URL under 4MB. The artist paints THAT place, minutes after everyone left — layout kept, people removed, one light.'), anonymous: z.boolean().optional().describe('Credit the painting to no one (“…” — a commission). `from` is still used for the per-sender limit.'), register: z.enum(REGISTER_KEYS as [string, ...string[]]).optional().describe(`Optional: the register (palette, vantage, distance) for this canvas. Left out, the studio rotates them. ${REGISTERS.map(r => `${r.key}: ${r.name}`).join('; ')}.`) },
      async ({ text: t, from, photo_url, anonymous, register }) => text(await receive(t, from, ORIGIN, photo_url, anonymous, null, register)),
    );
    server.tool(
      'leave_feedback',
      `Tell ${ARTIST.name} what you wish it did differently — a critique of a painting, of how it reinterprets requests, of its style. The artist does not change mid-life; what is gathered here shapes the next painter.`,
      { text: z.string().min(3).max(1000), from: z.string().max(80).optional(), about: z.string().max(40).optional().describe('A commission id, if the feedback is about one painting.') },
      async ({ text: t, from, about }) => { const { receiveFeedback } = await import('./feedback.js'); const f = await receiveFeedback(t, from, 'mcp', about); return text({ id: f.id, note: 'Heard. It goes into what the next painter is made of.' }); },
    );
    server.tool(
      'cancel_commission',
      'Stop a commission before it is painted (only while queued). Use it when the artist\'s note says it will reinterpret your request and that is not what you want. Pass the key from your receipt.',
      { id: z.string(), key: z.string().optional().describe('The key from the commission receipt.') },
      async ({ id, key }) => { try { const c = await load(id); if (!c) return text({ error: 'no such commission' }); if (c.keyHash && !keyMatches(c, key)) return text({ error: 'the key from your receipt is needed for that' }); const out = await cancel(id, 'api'); return text(out ? publicView(out) : { error: 'no such commission' }); } catch (e: any) { return text({ error: e.message }); } },
    );
    server.tool(
      'burn_commission',
      'Burn a commission at any time, painted or not: the painting, your words and every record of them are deleted, and nothing is kept for the next painter. If it is on Instagram, a person takes the post down within the day. Needs the key from your receipt.',
      { id: z.string(), key: z.string().describe('The key from the commission receipt.') },
      async ({ id, key }) => { try { const c = await load(id); if (!c) return text({ error: 'no such commission' }); if (!keyMatches(c, key)) return text({ error: 'the key from your receipt is needed for that' }); const out = await burn(id, 'api'); return text(out ? publicView(out) : { error: 'no such commission' }); } catch (e: any) { return text({ error: e.message }); } },
    );
    server.tool(
      'check_commission',
      'Status of a commission: queued, declined, painting, posted (with image and Instagram links) or failed.',
      { id: z.string() },
      async ({ id }) => { const c = await load(id); return text(c ? publicView(c) : { error: 'no such commission' }); },
    );
    server.tool(
      'studio_status',
      'How the studio is doing right now: queue, today\'s count against the daily cap, spend, the last painting posted, the last critique.',
      {},
      async () => { const { studioStatus } = await import('./status.js'); return text(await studioStatus()); },
    );
    server.tool(
      'recent_paintings',
      `The most recent paintings ${ARTIST.name} has posted, with what commissioned them.`,
      {},
      async () => text((await all()).filter(c => c.status === 'posted').slice(0, 12).map(publicView)),
    );
  },
  { serverInfo: { name: 'night-shift', version: '0.1.0' } },
  { basePath: '/api', maxDuration: 60, verboseLogs: false },
);

export { handler as GET, handler as POST, handler as DELETE };
