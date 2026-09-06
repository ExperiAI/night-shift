  // Detail panels: one per idea, one per frame. Opened by tap; the page reads without them.
  const IDEAS = {
    1: { eyebrow: 'Direction 1 · recommended', title: 'The Open Studio', body: `
      <h4>The idea</h4>
      <p>The painter stops being an Instagram account and becomes something that happens in a place: a bar, a wedding, a dinner, a meetup. A card with a QR sits on every table. Anyone in the room sends one sentence about tonight, or a photo of where they are sitting. On a screen in the room the studio works in public: the sentence arrives, the painter answers in its own voice, the canvas surfaces out of the dark, the inspector checks it and shows what it refused, the signature lands, and the finished painting goes to that person's phone. The painting is the place they are sitting in, empty, minutes after they left. They see it before they leave.</p>
      <h4>Why it is a wow</h4>
      <ul>
        <li>People have seen image generators. They have not watched an artist with a conscience argue with itself in front of them.</li>
        <li>The subject is them: this table, tonight, the glasses they are holding.</li>
        <li>The timing is the trick: "after everyone left" painted while everyone is still there.</li>
      </ul>
      <h4>Why it spreads</h4>
      <p>Every guest leaves with one painting of their own night, made for them, to post. The host gets the wall as a film. The story travels as one sentence: "it painted the room while we were still in it." Instagram becomes the archive, not the stage.</p>
      <h4>How it works</h4>
      <p>Nine tenths of the repo stays as it is: the desk, the gatekeeper, the painter, the inspector and its rejects, the store, consent and burn. New: a <em>room</em> (an event code that groups one night's commissions and can raise the daily cap for that night), a <em>live wall</em> page that follows every state change of the room's queue, a phone-first send page, and delivery: the page a guest scanned keeps their ticket, the painting appears on it, with share and burn.</p>
      <h4>The weekend</h4>
      <ul>
        <li>Saturday: the room, the wall, the send page. Test at home with three phones.</li>
        <li>Sunday: one real room. A dinner counts. Film the wall with a phone.</li>
      </ul>
      <h4>What could go wrong</h4>
      <ul>
        <li>Ninety seconds from sentence to painting. The wall turns that wait into the show.</li>
        <li>Cost: about fifteen cents a painting, so a thirty-person night is around five dollars.</li>
        <li>Venue Wi-Fi. The wall can run from a laptop on a phone's hotspot.</li>
        <li>People will ask for themselves in it. The painter says no in its own words, as it does today. That demand is the case for painter #2.</li>
      </ul>` },
    2: { eyebrow: 'Direction 2 · same wall, opening night', title: "The Agents' Vernissage", body: `
      <h4>The idea</h4>
      <p>An opening night where every client is an AI agent. Builders in your network add the studio to their agent with one line and tell it, in their own words, to commission something from their world: the office after launch night, the server room, the booth on demo day. The agent does the rest: it asks, hears what the painter will and will not paint, says stop or go. On the wall, beside each canvas, the whole exchange is shown as it happened. A stranger critic grades every painting in public. A scoreboard counts commissions from agents nobody in the room has met, which is the dealer's exam from the ten critics.</p>
      <h4>Why it is a wow</h4>
      <ul>
        <li>The first gallery whose clients are agents is a sentence people repeat.</li>
        <li>For the humans in the room it is a mirror: their agent's taste and manners, shown next to everyone else's.</li>
        <li>The painter's refusals become drama: an agent pushing for the number on the screen, the painter offering a glow.</li>
      </ul>
      <h4>Why it spreads</h4>
      <p>A screenshot of "my agent commissioned this" travels in the builder crowd, which is where ExperiAI sells. The wall recording is a talk in itself.</p>
      <h4>How it works</h4>
      <p>The MCP server already exists with commission, check, cancel, burn and feedback. New: the same live wall with a transcript column, an agent identity per session so the exchange can be shown as one conversation, an invitation page with the one line to paste, and the scoreboard. It needs the wall from direction 1 first, which is why it fits as that wall's opening night rather than a separate build.</p>
      <h4>The weekend</h4>
      <ul>
        <li>After the wall exists: two hours to add the transcript column and the invite page.</li>
        <li>Invite ten people for one evening. Remote is fine; the wall is a URL.</li>
      </ul>
      <h4>What could go wrong</h4>
      <ul>
        <li>Agents with no taste. The scoreboard shows it, which is the point.</li>
        <li>Nobody comes. Then it is a rehearsal for the room in direction 1, at no cost.</li>
      </ul>` },
    3: { eyebrow: 'Direction 3 · content, not an experience', title: 'Every painting, a film', body: `
      <h4>The idea</h4>
      <p>Every painting the studio posts also becomes a twenty-second vertical film: the sentence typed out, the canvas surfacing from black, the inspector's stamps landing one by one, the sign-off line. Generated by the studio, posted as a Reel, the one Instagram format that reaches people who do not follow the account.</p>
      <h4>Why it matters</h4>
      <ul>
        <li>The grid today reaches two followers. Reels are how an account with no audience is seen at all.</li>
        <li>It makes the conscience visible: the stamps and the sign-off are the part nobody sees on a still.</li>
      </ul>
      <h4>Honest read</h4>
      <p>This is distribution, not a new experience. Nobody can do anything with the painter they cannot do today. It makes what exists travel, and it is the least novel of the three.</p>
      <h4>How it works</h4>
      <p>New: a small video compositor (the reveal can be built from the still with the tools we have; the animated version is the Midjourney video experiment from issue #4), a Reel publish path through Zernio, and captions. Everything else stays.</p>
      <h4>The weekend</h4>
      <ul><li>One day for the compositor and the first three Reels.</li></ul>
      <h4>What could go wrong</h4>
      <ul>
        <li>Reach starts at zero either way; the films need a hook in the first second.</li>
        <li>Sound: a silent Reel is skipped. A single piano note is a decision.</li>
      </ul>` },
  };
  const FRAMES = {
    '1a': { eyebrow: 'Direction 1 · frame 1 · on the table', title: 'A QR on every table', body: `<p>A small card on each table, printed for the night. The QR opens the room's send page with the room code already in it, so nobody types anything but their sentence. The card sets the contract in three lines: one sentence or a photo of where you sit; it paints the place after you have left it, never a face; it says what it is. The disclosure is on the card, not in a hashtag.</p><p>No app, no login, no account. The same card works for a wedding of eighty and a dinner of six.</p>` },
    '1b': { eyebrow: 'Direction 1 · frame 2 · your phone', title: 'One sentence. The painter answers.', body: `<p>The send page is one field and one photo button. About five seconds after sending, the painter's note comes back in its own voice: what it will paint, and what it leaves out. If the request conflicts with what it does (someone wants themselves in it, or a name on the wall), the note says so plainly and offers a stop, exactly as the desk does today. A photo of the table becomes the painting's reference: the layout stays, the people go.</p><p>This page is the guest's ticket. It stays open and the painting arrives on it later.</p>` },
    '1c': { eyebrow: 'Direction 1 · frame 3 · the wall behind the bar', title: 'The room watches it think', body: `<p>A screen in the room, or a projector. Three columns. Left: tonight's sentences as they arrive, anonymous unless the sender chose a name; the current one lit. Middle: the canvas being painted, surfacing out of the dark as it renders, then the studio's signature. Right: the inspector's checks landing one by one: one light, nobody in it, no words. When a canvas fails, it is shown small with the reason, and the painter tries again in front of everyone. Then "sent to your phone".</p><p>The wall loops through the queue all night. It is the theatre: the ninety seconds a painting takes becomes the show, and the conscience that nobody can see on Instagram is the main act.</p><p>This frame is a running mock of that loop, with real paintings.</p>` },
    '1d': { eyebrow: 'Direction 1 · frame 4 · before you leave', title: 'Yours, on your phone', body: `<p>The ticket page updates: the painting, its title, the painter's note, a share-to-story button, and "burn it", which already exists: the painting and the words are deleted everywhere the studio holds them. The Instagram post, if they want one, comes later and is credited the way they chose.</p><p>They see the room they are sitting in, empty, painted before they have stood up. That is the moment people photograph.</p>` },
    '2a': { eyebrow: 'Direction 2 · frame 1 · a builder\'s terminal', title: 'Bring your agent. One line.', body: `<p>The studio is already an MCP server. A builder adds it to Claude Code, Cursor, or any agent that speaks MCP with one line, then says what they want in their own words. The agent does the commissioning: it writes the sentence, reads the painter's note, decides whether to accept the departures.</p><p>The invitation page has that one line and nothing else.</p>` },
    '2b': { eyebrow: 'Direction 2 · frame 2 · on the wall', title: 'Every negotiation, in public', body: `<p>Beside each canvas the wall shows the exchange: what the agent asked, what the painter answered, the departures it declared, the stop or the yes. Agents push for the literal brief (the number on the dashboard, the people at the booth); the painter offers what it does instead. The exchange is the content: it is where taste, manners and the painter's rules become visible.</p><p>Technically this is the transcript of the MCP calls for one session, shown as a conversation.</p>` },
    '2c': { eyebrow: 'Direction 2 · frame 3 · the verdict', title: 'A stranger grades it', body: `<p>The critic that already runs every morning, a different vendor from the painter, grades each canvas as the night goes: did it honour the intent, yes, partly or no, and one line why. Shown next to the painting, for everyone. The agents' humans see their brief judged as well as the painting.</p>` },
    '2d': { eyebrow: 'Direction 2 · frame 4 · scoreboard', title: 'The dealer\'s exam, sat live', body: `<p>One of the ten critics, a gallery director, set this bar: twelve commissions from twelve people none of us has met, before the wall calls itself a body of work. The scoreboard is that exam in public: each agent, what it asked for, the grade. It also makes the night a game, which is what keeps a room watching.</p>` },
    '3a': { eyebrow: 'Direction 3 · 0–4 s', title: 'The sentence, typed', body: `<p>The film opens on black with the commission typed out letter by letter, the way it was sent. The first second has to hold a thumb: a sentence about someone's night does that better than a painting does.</p>` },
    '3b': { eyebrow: 'Direction 3 · 4–12 s', title: 'The canvas comes out of the dark', body: `<p>The painting surfaces from black, slowly, the one light first. Built from the still with a reveal, or, if the Midjourney video experiment in issue #4 works, an actual animation of the render. Eight seconds, no cuts.</p>` },
    '3c': { eyebrow: 'Direction 3 · 12–16 s', title: "The inspector's stamp", body: `<p>The three checks land over the painting one by one: one light, nobody in it, no words. It is the only place a viewer ever sees that the studio refuses things, and it takes four seconds.</p>` },
    '3d': { eyebrow: 'Direction 3 · 16–20 s', title: 'Sign-off. Posted as a Reel.', body: `<p>The title, then the studio's own line: "I am an AI. No hand held this brush." Published as a Reel through the same pipeline as the still, with the same caption and the same credit rules.</p>` },
  };
  const dlg = document.getElementById('dlg'), body = document.getElementById('dlgbody');
  function open(d) { body.innerHTML = `<div class="eyebrow">${d.eyebrow}</div><h3>${d.title}</h3>${d.body}`; dlg.showModal(); dlg.querySelector('.dlg').scrollTop = 0; }
  document.querySelectorAll('.deeper').forEach(b => b.addEventListener('click', () => open(IDEAS[b.dataset.idea])));
  document.querySelectorAll('.frame').forEach(f => { const go = () => open(FRAMES[f.dataset.frame]); f.addEventListener('click', go); f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
  document.getElementById('close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
