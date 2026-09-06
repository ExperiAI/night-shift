#!/usr/bin/env bash
#
# Deploy Night Shift to production, and prove it.
#
# Issue #15: 20+ deploys on 2026-09-05 were each `npm test && vercel --prod --yes`
# typed by hand with a curl afterwards. This is that, with the check made honest:
#
#   THE MARKER MUST BE ABSENT FROM PRODUCTION BEFORE THE DEPLOY.
#
# A marker already live passes whether or not the upload worked. So the script
# refuses a marker it can already see. Pick the marker by reading the diff: a
# string that is in the new build and not the old one.
#
#   ./scripts/deploy-prod.sh                                              # build id is the marker
#   ./scripts/deploy-prod.sh "Tools, plain HTTP, and how I work"          # plus a marker on /
#   ./scripts/deploy-prod.sh '"critic"' /api/status                       # plus a marker on another path
#
# Every deploy gets a BUILD_ID (commit + time) as a runtime env var, and /api/status reports it,
# so a deploy always has a marker of its own even when nothing visible changed (a prompt, a cap).
# An optional second marker checks a specific page.
#
# Not gated: nightshift.experiai.com is an ExperiAI Lab piece, not a client system.

set -euo pipefail

MARKER="${1:-}"
PATH_TO_CHECK="${2:-/}"
HOST="https://nightshift.experiai.com"
TRIES=24
INTERVAL=5

fail() { printf '\n\033[31mFAILED\033[0m  %s\n' "$1" >&2; exit 1; }
ok()   { printf '\033[32mok\033[0m      %s\n' "$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

cd "$(dirname "$0")/.."
BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)-$(date +%s)"
[ -d .vercel ] || fail "No .vercel directory — this checkout is not linked to the Vercel project."
command -v vercel >/dev/null || fail "vercel CLI not on PATH."

step "1/5  markers must NOT be live yet"
if curl -fsSL "$HOST/api/status" | grep -qF -- "\"build\":\"$BUILD_ID\""; then fail "build id $BUILD_ID is already live, which cannot happen; refusing to trust the check."; fi
if [ -n "$MARKER" ] && curl -fsSL "$HOST$PATH_TO_CHECK" | grep -qF -- "$MARKER"; then
  fail "\"$MARKER\" is already on $HOST$PATH_TO_CHECK. A check that passes before the deploy proves nothing. Pick a marker from the diff."
fi
ok "build id $BUILD_ID${MARKER:+ and marker} absent from production"

step "2/5  tests and types"
npm test 2>&1 | tail -8
npm run check
ok "green"

step "3/5  deploy"
# A non-zero exit from the CLI is not proof the deploy did not happen: on 2026-09-06 it printed "Error: Not
# authorized" after the build had already gone live (the build id was on /api/status seconds later). The exit
# code is reported; production decides (step 3).
OUT=$(vercel --prod --yes -e "BUILD_ID=$BUILD_ID" 2>&1) || printf '\n\033[33mvercel exited non-zero\033[0m — checking whether the build went live anyway:\n%s\n' "$OUT"
URL=$(printf '%s\n' "$OUT" | grep -Eo 'https://night-shift-[a-z0-9-]+\.vercel\.app' | head -1 || true)
ok "deployed ${URL:-(url not parsed)}"

step "4/5  the domain serves the new build"
i=0
until curl -fsSL "$HOST/api/status?b=$BUILD_ID" | grep -qF -- "\"build\":\"$BUILD_ID\""; do
  i=$((i+1)); [ $i -ge $TRIES ] && fail "$HOST/api/status still does not report build $BUILD_ID after $((TRIES*INTERVAL))s. The deploy went somewhere; the domain is not serving it."
  sleep $INTERVAL
done
ok "build $BUILD_ID live on $HOST"
if [ -n "$MARKER" ]; then
  i=0
  until curl -fsSL "$HOST$PATH_TO_CHECK" | grep -qF -- "$MARKER"; do
    i=$((i+1)); [ $i -ge $TRIES ] && fail "$HOST$PATH_TO_CHECK still does not contain \"$MARKER\" after $((TRIES*INTERVAL))s."
    sleep $INTERVAL
  done
  ok "marker live on $HOST$PATH_TO_CHECK"
fi

step "5/5  /api/status answers"
STATUS=$(curl -fsSL "$HOST/api/status") || fail "/api/status did not answer"
printf '%s\n' "$STATUS" | grep -q '"today"' || { printf '%s\n' "$STATUS" | head -c 400; fail "/api/status answered but not with the studio's state"; }
ok "$(printf '%s' "$STATUS" | head -c 200)…"

printf '\n\033[32mDEPLOYED AND VERIFIED\033[0m  %s\n' "$HOST"
