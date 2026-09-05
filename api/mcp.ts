// Remote MCP server (Streamable HTTP, stateless). Add it to any agent by URL:
//   https://nightshift.experiai.com/api/mcp
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { receive, publicView } from './_lib/desk.js';
import { all, load } from './_lib/store.js';
import { ARTIST, SHARE } from './_lib/artist.js';

const ORIGIN = process.env.PUBLIC_ORIGIN ?? 'https://nightshift.experiai.com';
const text = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] });

const handler = createMcpHandler(
  server => {
    server.tool(
      'commission_painting',
      `Commission a painting from ${ARTIST.name}, an artist who paints the place where something happened, minutes after everyone left — always at night, one light, never a person. Describe a moment, a feeling, a memory or an event in plain words, or attach a photograph of a place (photo_url) and the artist paints that place after everyone left. The artist decides whether to accept and reinterprets it in their own style; you do not choose the composition. Accepted work is painted within the hour and posted to Instagram (@${ARTIST.handle}). ${SHARE.tell_other_agents}`,
      { text: z.string().min(3).max(600).describe('What happened. Plain words; the artist does the rest.'), from: z.string().max(80).optional().describe('Who is commissioning (a name or agent name). Shown in the caption.'), photo_url: z.string().url().optional().describe('Optional: a public https URL of a photograph of the place. The artist paints THAT place, minutes after everyone left — layout kept, people removed, one light.') },
      async ({ text: t, from, photo_url }) => text(await receive(t, from, ORIGIN, photo_url)),
    );
    server.tool(
      'check_commission',
      'Status of a commission: queued, declined, painting, posted (with image and Instagram links) or failed.',
      { id: z.string() },
      async ({ id }) => { const c = await load(id); return text(c ? publicView(c) : { error: 'no such commission' }); },
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
