/** The studio's public address. Never derive it from `req.headers.host`: Vercel's cron calls a function on the
 *  deployment hostname (night-shift-<hash>-experiai-projects.vercel.app), which sits behind Deployment Protection
 *  and answers 401 to anything the function posts back to itself. The 04:30 exam sat against that host every day
 *  from 2026-09-05 and never filed a commission; nothing recorded the failure. */
export const ORIGIN = process.env.PUBLIC_ORIGIN ?? 'https://nightshift.experiai.com';
