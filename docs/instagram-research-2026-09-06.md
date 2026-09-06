# Instagram growth mechanics for @nightshift.paints — research note (2026-09-06)

Scope: how Reels distribution works per Instagram's own documentation, what an API-driven
zero-follower painter account can actually use, and what the Graph API exposes for measurement.
"Instagram says" = Meta/Instagram first-party (docs, Help Center, creators.instagram.com,
about.fb.com, Mosseri's own posts). "Creators say" = third-party reporting or creator anecdotes;
treat as hypotheses to test, not facts. Several Help Center pages render only via JS and could not
be read by the fetcher; where so, the URL is given and the content is taken from a quoting article.

## 1. Reels ranking signals

### Instagram says
- Reels ranking predicts "how likely you are to reshare a reel, watch a reel all the way through,
  like it, and go to the audio page". Demoted: "low-resolution or watermarked reels, reels that are
  muted or contain borders, reels that are majority text, or reels that have already been posted on
  Instagram". https://about.instagram.com/blog/announcements/instagram-ranking-explained
- Mosseri, 22 Jan 2025: "The top three signals that matter most for ranking are watch time, likes
  and sends. So when looking at your insights, pay close attention to average watch time, likes per
  reach, and sends per reach." "Likes are slightly more important for connected content, and sends
  are slightly more important for unconnected content." https://www.instagram.com/p/DFFyRp-pINJ/
  (quoted at https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/).
  Comments are not in his top three.
- Mosseri, Oct 2024 reel on hooks: the first three seconds are "the hook"; put text on the video
  because many scroll with sound off; set expectations about what the reel is; experiment with hook
  styles. https://www.instagram.com/mosseri/reel/DA0ua3-yuDg/
- Creators FAQ (creators.instagram.com/faq): "Make sure the first 3 seconds of your reel are
  engaging, so that people don't move on." "Video quality matters. Upload the highest resolution
  possible." "Using trending audio can also impact distribution. We consider the popularity of
  trends on Reels to determine how to rank and deliver content." "Ditch the watermark! The 3rd
  party watermark on your reel may be impacting its reach." "Like or authentically reply to
  comments on your reel within the first 7 days to generate more engagement." "We recommend videos
  to unconnected audiences that are 3 minutes or less." https://creators.instagram.com/faq?locale=en_US
- Recommendation eligibility (non-followers): 9:16 vertical, high-res, no borders, no watermark,
  not "already available on Instagram", public account only; signals named include "how fast how
  many people like a post", saves, shares.
  https://creators.instagram.com/blog/instagram-recommendations-eligibility-tips-creators
- Originality (30 Apr 2024): "If we find two or more identical pieces of content on Instagram, we
  only recommend the original." Accounts reposting others' content "10 or more times in the last
  30 days" without material edits are removed from recommendations; reposts get a label pointing
  to the original. https://creators.instagram.com/blog/recommendations-and-originality
- Originality extended to photos and carousels (30 Apr 2026). Original = "works you completely
  created yourself or that reflect your individual perspective", incl. "content you designed".
  Adding "a frame, watermark, subtitle, or a note in the caption" is not enough. Eligibility
  returns when most posts in a rolling 30 days are original.
  https://creators.instagram.com/blog/rewarding-original-creators-on-instagram ;
  https://creators.instagram.com/original-content-guidelines . Neither text mentions AI-generated
  content; an AI painter's own paintings are "content you designed" by that definition.
- Search / keywords: "be discoverable through search" with relevant keywords "in your content,
  captions, bio and hashtags"; Reels max 3 minutes to be recommended.
  https://creators.instagram.com/blog/tips-for-improving-your-reach
- Hashtags: limit cut to 5 per post (Dec 2025). Instagram: "using fewer (up to 5) more targeted
  hashtags, rather than many generic ones, can improve both your content's performance and people's
  experience". https://www.socialmediatoday.com/news/instagram-implements-new-limits-on-hashtag-use/808309/
  FAQ: "Trending hashtags that are relevant to the topics in your reel can help you reach more
  people"; avoid irrelevant ones. https://creators.instagram.com/faq?locale=en_US
- Google/Bing index public posts and reels from public professional accounts by default since
  10 Jul 2025 (stories excluded). https://help.instagram.com/147542625391305/ (JS page; reported at
  https://ppc.land/instagram-content-becomes-searchable-on-google-starting-july-10/)
- "Views" is the primary metric since Aug 2024; a view = a reel starts to play or replay, so
  replays count. https://www.socialmediatoday.com/news/instagram-updates-metrics-to-focus-creators-on-views/723645/ ;
  Help Center definitions: https://help.instagram.com/202865988324236/ (JS page)
- Carousels and photos with music are eligible for the Reels tab; a carousel a viewer did not
  swipe is often re-shown "starting on the second slide"; more media = more interactions = more
  reach on average (Mosseri, Nov 2024, via Instagram's own @instagramcreators):
  https://www.tiktok.com/@instagramcreators/video/7436051560481934638 ;
  https://www.socialmediatoday.com/news/ig-chief-recommends-posting-carousels-improve-reach/730232/

### Creators say (unconfirmed by Instagram)
- Sends are worth "3-5x" a like for non-follower reach; 7-15 s reels have the best completion;
  60%+ 3-second hold is the bar. Repeated across agency blogs with no Meta source, e.g.
  https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers . Treat as
  folklore; measure your own.
- Mosseri (2024, widely quoted, original post not located): "think about creating something people
  want to send to a friend". https://influencermarketinghub.com/instagram-sends-per-reach-playbook/

## 2. Cadence and timing

### Instagram says
- "When we look at creators with the greatest net follower growth rates we see, on average, they
  post 10 or more reels per month." Post "when your audience is awake and most active. Use your
  insights". Some follower loss right after a reel is normal ("people regularly curate the accounts
  they follow"). https://creators.instagram.com/faq?locale=en_US
- No first-party statement that N posts/day dilutes reach. Hard caps that exist: 100 API-published
  posts per 24 h (carousel = 1) https://developers.facebook.com/docs/instagram-platform/content-publishing/ ;
  20 trial reels per day https://www.socialmediatoday.com/news/instagram-trial-reels-increase-reach-tests/750121/
- Mosseri, Dec 2024 reel "Posting often generally helps with reach but..." — posting more does not
  cost reach, each post is ranked on its own; the only real cost is quality and burnout: "I'd rather
  you post twice a week for two years than every day for two months and then quit."
  https://www.instagram.com/mosseri/reel/DDPU_hfSgnZ/ (quoted at
  https://techissuestoday.com/adam-mosseri-instagram-posting-schedule-advice/)
- Timing: no first-party "best hour". The FAQ's only guidance is audience-active time from
  Insights. With 86% of views from non-followers in the Reels tab, follower-active time is close to
  meaningless for this account today.
- Trial reels (Dec 2024): "Trial reels will first be shown to people who don't follow you";
  not on your grid or followers' Reels tab; "Approximately 24 hours after you share a trial reel,
  you can view key engagement metrics ... including views, likes, comments and shares"; optional
  auto-share to followers "if we determine it's performing well based on the views it receives
  within the first 72 hours". https://creators.instagram.com/blog/instagram-trial-reels ;
  https://about.fb.com/news/2024/12/trial-reels-try-content-non-followers-first-see-what-perfoms-best/
- Trial reels results (Jun 2025): "After trying trial reels, 40% of creators started posting reels
  more often and of those who did, 80% saw an increase in reels reach from non-followers."
  Requires a professional account. https://www.socialmediatoday.com/news/instagram-trial-reels-increase-reach-tests/750121/ ;
  Help Center: https://help.instagram.com/835643311711702/ (JS page)
- Trial reels ARE in the API: `trial_params: {graduation_strategy: "MANUAL" | "SS_PERFORMANCE"}`
  on `POST /{ig-user-id}/media` with `media_type=REELS`; SS_PERFORMANCE "will be automatically
  graduated if the trial reel performs well".
  https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/

### Creators say
- 1,000-follower minimum for trial reels (many blogs, e.g. https://postfa.st/blog/instagram-trial-reels);
  not in any first-party text read here. Verify by attempting a `trial_params` publish.
- 3-5 posts/week "sweet spot" (Buffer, 2M posts) https://buffer.com/resources/how-often-to-post-on-instagram/ ;
  working painters say 1-2 reels/day (see §4).
- "Post before your audience peaks" logic only applies to follower reach; Reels are distributed
  over days, so timing matters less for them. https://later.com/blog/best-time-to-post-on-instagram/

## 3. Formats for a zero-follower account

### Instagram says
- People "look for their closest friends in stories, use explore to discover new content and
  creators, and be entertained in reels". Stories rank posts from accounts you follow; there is no
  stories recommendation surface. https://about.instagram.com/blog/announcements/instagram-ranking-explained
  => with 2 followers a Story reaches ~2 people plus profile visitors. Stories are also excluded
  from search-engine indexing (§1).
- "The most effective way to grow your followers is to consistently create engaging reels, as reels
  are the best way to reach new audiences." https://creators.instagram.com/faq?locale=en_US
- Carousel > single image on average (second-chance re-show, more interactions); needs music to
  enter the Reels tab (§1, Mosseri). Photos and carousels are now under the same originality rule
  as reels (§1).
- API: `collaborators` (up to 3 usernames) on feed images, reels, carousels; not on Stories.
  https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/

### Creators say
- Stories are "the wrong format for reach and the best format for deepening the followers you
  already have". https://later.com/blog/how-instagram-algorithm-works/

## 4. Concrete accounts (all "creators say"; numbers are self-reported)
- @chelsea_explains: 450k followers in two months by re-posting old videos as trial reels
  (Jan 2025). https://www.tubefilter.com/2025/01/23/instagram-trial-reels-growth-hacking-creator-economy/
- Kapwing (brand account): one trial reel hit 1.4M views -> 8,600 profile visits, 290 link taps,
  130 followers. Small A/B: trial 2,258 views / 1 follower vs regular 949 views / 0. Lesson: trial
  reach converts poorly unless the content itself invites a follow.
  https://www.kapwing.com/resources/instagram-trial-reels-study-what-we-learned-after-a-trial-reel-hit-1-million-views/
- Nire Donahue ("smaller creator"): 9 consecutive trial reels, 2.3M+ impressions in 14 days;
  repurposed casual footage, posted follow-ups linking back to the ones that ran.
  https://niredonahue.com/instagram-trial-reels-case-study/
- Samuel Earp (landscape painter, 100k+): minimum 1 reel/day (aims 2), 2-3 stories/day, 1-2 feed
  posts/week; a painting-reveal reel did 1.4M views, re-posted a year later 2.2M; "if it doesn't
  have a good hook in the first second, people will swipe"; 3-5 hashtags or none; heart + reply
  comments in the first 30-60 min; one painting session batched into several reels (sketch, colour
  mixing, details, reveal). https://samuelearp.com/blog/how-to-grow-an-instagram-following-as-an-artist/
- Elisa Capitanio (painter, 400+ videos): reels of 3-14 s, best one 19 s ("20 hours painting
  shrunk to 20 seconds"), fast cuts, "skip introductions but add subtitles", close-ups of detail;
  reels brought "more followers in a month than anything else". https://elisacapitanio.com/blogs/blog/reels-for-artists
- Artist-growth blogs (unverified anecdotes): a watercolourist at 4 process reels/week reached 47k
  in six months; "90%+ of growing art accounts' content is Reels".
  https://artisticmasterclass.com/how-to-grow-your-instagram-as-an-artist-in-2026-a-step-by-step-guide/
- No documented 0-to-thousands case for an AI-painter account with numbers was found; the closest
  are AI-persona influencers (not art) and aggregator "AI art" feeds, which the Apr 2026 originality
  rule now demotes. https://techcrunch.com/2026/04/30/instagram-restricts-reach-of-content-aggregators-in-new-crackdown/

## 5. Professional-account features: API vs app-only
Source for all API rows: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
and https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Reels via API: `media_type=REELS`, `video_url`, `caption` (2200 chars, 30 hashtags, 20 @tags),
  `cover_url` (public image, overrides `thumb_offset`), `thumb_offset` (ms), `share_to_feed`
  (false = Reels tab only), `audio_name` (renames YOUR original audio), `collaborators` (<=3),
  `location_id`, `user_tags`, `trial_params` (§2), `is_ai_generated` ("self-disclosure of AI
  usage"). Video: 3 s to 15 min, 23-60 fps, 9:16 recommended.
- Carousel via API: up to 10 items, cropped to the first item's ratio. Images JPEG only.
- Stories via API: `media_type=STORIES`, video 3-60 s; no `collaborators`, no `alt_text`.
- `alt_text` (<=1000 chars): images only since 24 Mar 2025; "Reels and stories are not supported".
- Not in the API (by absence from the parameter reference): licensed/trending music (audio must be
  in the file; `audio_name` only labels original audio), Reel title/text overlays and stickers
  (bake into the video), story stickers incl. "Add Yours", Notes, Broadcast channels, "Highlights",
  name/bio edits, filters, shopping tags.
- AI labelling: Meta adds "AI info" when it detects C2PA/IPTC markers or when you self-disclose;
  self-disclosure required for photorealistic video/realistic audio.
  https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/
  Account-level "AI Creator" label being tested (2026):
  https://www.socialmediatoday.com/news/instagram-adds-ai-creator-labels/819267/
- Zernio note: whatever Zernio passes through, the three fields that matter for this account are
  `cover_url`, `trial_params` and `is_ai_generated`; check its request builder exposes them.

## 6. Measurement via the Graph API
Source: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights
and https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/
- Per Reel (`GET /{ig-media-id}/insights?metric=...`): `views` (plays incl. replays), `reach`,
  `likes`, `comments`, `saved`, `shares`, `reposts`, `total_interactions`,
  `ig_reels_avg_watch_time` (milliseconds), `ig_reels_video_view_total_time` (ms, incl. replays),
  `reels_skip_rate` ("Percentage of views from people who skipped during the first 3 seconds";
  estimated, in development), `crossposted_views`, `facebook_views`. `plays` and `impressions`
  are deprecated (media after 2 Jul 2024; sunset 21 Apr 2025).
- Per feed image/carousel: `views`, `reach`, `likes`, `comments`, `saved`, `shares`, `follows`,
  `profile_visits`, `profile_activity` (breakdown `action_type`).
- Per Story: `reach`, `views`, `replies`, `shares`, `navigation` (breakdown
  `story_navigation_action_type`: SWIPE_FORWARD, TAP_BACK, TAP_EXIT, TAP_FORWARD), `follows`,
  `profile_visits`, `link_clicks`.
- Account (`GET /{ig-user-id}/insights`, period=day): `reach` (breakdowns `media_product_type`,
  `follow_type` = follower vs non-follower), `views` (breakdowns `follower_type`,
  `media_product_type`), `accounts_engaged`, `likes`, `comments`, `shares`, `saves`, `replies`,
  `total_interactions`, `profile_links_taps`, `follows_and_unfollows` (needs 100+ followers),
  `follower_demographics` (100+), `engaged_audience_demographics`. Data "may be delayed up to
  48 hours"; user metrics kept 90 days. `online_followers` is a legacy metric not in the current
  reference; use `reach`/`views` by `follow_type` instead.
- What the API does NOT give: the per-second retention curve (the "57% gone by 0:02" graph) and
  per-reel follower vs non-follower split. Proxies: `reels_skip_rate` (first 3 s),
  `ig_reels_avg_watch_time / duration` (completion), `shares/reach` (sends per reach),
  `likes/reach`. Mosseri's three headline numbers are all computable from this endpoint.

## What a zero-follower automated painter account should do, ranked by expected effect per unit of work
1. Kill the black-screen open: frame 0 is the painting (or its most striking crop) with the typed
   sentence as on-screen text over it; the reveal is the hook, not the payoff. (Mosseri hooks reel;
   FAQ "first 3 seconds"; own 57%-by-0:02.)
2. Pull `reels_skip_rate`, `ig_reels_avg_watch_time`, `shares/reach`, `likes/reach` per reel into
   the studio automatically and let the existing A/B-by-id decide openings. (§6; Mosseri Jan 2025.)
3. Publish every reel with `trial_params: {graduation_strategy: "SS_PERFORMANCE"}` — non-followers
   first is the only audience that exists, and it returns comparable 24 h numbers. If the API
   rejects it, that answers the 1,000-follower question. (§2 trial reels; API reference.)
4. Cadence: aim for >=10 reels/month floor and let commissions set the ceiling; there is no
   documented per-day penalty, only the 100/24 h API cap, 20 trial reels/day, and the quality bar.
   Skip a weak painting rather than post it. (FAQ 10+/month; Mosseri Dec 2024.)
5. Design for sends: give each reel one line a viewer would forward ("painted from a stranger's
   one-sentence brief", the commission prompt itself, a "send me yours" close). Sends outrank likes
   for unconnected reach. (Mosseri Jan 2025.)
6. Caption line 1 in plain search words (subject, "oil painting", "AI painter", the commission
   sentence); keywords in name/bio; <=5 targeted hashtags; posts are Google-indexed by default.
   (tips-for-improving-your-reach; 5-hashtag rule; help 147542625391305.)
7. Set `cover_url` to the finished painting every time so the grid reads as a gallery and the
   Reels-tab thumbnail is the artwork, not a black frame. (API reference; ranking-explained demotes
   majority-text/low-quality.)
8. Reply to (and like) every comment within 7 days via the comments endpoint, in the painter's
   voice, disclosed as AI. (FAQ 7-day rule.)
9. Stop the daily Story cron until there are followers to see it; Stories are not recommended, not
   indexed, and reach followers + profile visitors only. Re-enable at a few hundred followers.
   (ranking-explained; help 147542625391305.)
10. Ship a weekly carousel of stills (detail crops -> full painting) as a second format only if
    music can be attached (app step); without music it never reaches the Reels tab. Never re-post
    an identical reel — only the original gets recommended. Pass `is_ai_generated=true`.
    (Mosseri carousels; recommendations-and-originality; API `is_ai_generated`.)
