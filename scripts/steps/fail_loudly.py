#!/usr/bin/env python3
"""Night Shift fails loudly (issue #43): the two things only Diego can do, in one step.

1. The project's OpenRouter key had a $20 cap with ~$1.20 left on 2026-10-16 (runs out ~24 Oct at the trailing
   week's spend). Raising it is a dashboard edit no local credential can make (no management key exists here, by
   design). The step does not change it; it READS it back with the project key and refuses until it is raised.
2. The alert code (api/_lib/alarm.ts) sends through Resend, and this project has no Resend key. The step takes a
   new sending-only key, proves Resend accepts it, writes it to Vercel production and redeploys.

verify sends one email labelled TEST through the deployed studio to admin@experiai.com: the end-to-end proof.
Values arrive on stdin (the human-step contract) and are never printed.
"""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

ORIGIN = "https://nightshift.experiai.com"
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def out(ok, checks=None, outcome=None, message=None):
    payload = {"ok": ok}
    if checks:
        payload["checks"] = checks
    if outcome:
        payload["outcome"] = outcome
    if message:
        payload["message"] = message
    print(json.dumps(payload))
    sys.exit(0 if ok else 1)


def dotenv(name):
    try:
        for line in open(os.path.join(REPO, ".env")):
            m = re.match(r'^%s="?(.*?)"?\s*$' % re.escape(name), line)
            if m:
                return m.group(1)
    except OSError:
        pass
    return ""


def http(url, headers=None, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "night-shift-step", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}
    except Exception as e:  # noqa: BLE001 — the message is what the person reads
        return 0, {"error": str(e)}


def key_limit():
    code, body = http("https://openrouter.ai/api/v1/key", {"Authorization": f"Bearer {dotenv('OPENROUTER_API_KEY')}"})
    d = (body or {}).get("data") or {}
    return code, d.get("limit"), d.get("limit_remaining")


def resend_accepts(key):
    """A sending-only key is refused on /api-keys with `restricted_api_key`; an invalid one with a validation error."""
    code, body = http("https://api.resend.com/api-keys", {"Authorization": f"Bearer {key}"})
    name = (body or {}).get("name", "")
    if code == 200 or name == "restricted_api_key":
        return True, "Resend knows this key" + (" (sending only)" if name == "restricted_api_key" else "")
    return False, f"Resend refused it: HTTP {code} {name} {str((body or {}).get('message', ''))[:120]}".strip()


def phase_check(values):
    checks = []
    want = max(40.0, float(values.get("LIMIT") or 40))  # ~3 months at the trailing week's spend (Diego, 2026-10-16)
    code, limit, left = key_limit()
    if code != 200:
        out(False, [{"name": "the OpenRouter key can be read", "status": "fail", "detail": f"HTTP {code} from /api/v1/key with the project key in .env"}])
    if limit is None or float(limit) < want:
        out(False, [{"name": f"the Night Shift key's limit is at least ${want:.0f}", "status": "fail",
                     "detail": f"it is still {'no limit' if limit is None else f'${float(limit):.0f}'} — raise it first (see the first field's instructions), then run this again"}])
    checks.append({"name": f"the Night Shift key's limit is at least ${want:.0f}", "status": "pass", "detail": f"limit ${float(limit):.2f}, ${float(left):.2f} left"})
    ok, detail = resend_accepts((values.get("RESEND_API_KEY") or "").strip())
    if not ok:
        out(False, checks + [{"name": "Resend accepts the key", "status": "fail", "detail": detail}])
    checks.append({"name": "Resend accepts the key", "status": "pass", "detail": detail})
    out(True, checks)


def run(args, stdin=None, timeout=900):
    p = subprocess.run(args, input=stdin, capture_output=True, text=True, timeout=timeout, cwd=REPO)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def phase_apply(values):
    key = (values.get("RESEND_API_KEY") or "").strip()
    checks = []
    run(["vercel", "env", "rm", "RESEND_API_KEY", "production", "--yes"])  # a re-run replaces, never stacks a second value
    code, log = run(["vercel", "env", "add", "RESEND_API_KEY", "production"], stdin=key)
    if code != 0:
        out(False, [{"name": "RESEND_API_KEY is set in Vercel", "status": "fail", "detail": log.strip()[-300:]}])
    checks.append({"name": "RESEND_API_KEY is set in Vercel", "status": "pass", "detail": "production"})
    code, log = run(["./scripts/deploy-prod.sh"])
    if code != 0:
        out(False, checks + [{"name": "redeployed so the key is live", "status": "fail", "detail": log.strip()[-400:]}])
    checks.append({"name": "redeployed so the key is live", "status": "pass", "detail": "scripts/deploy-prod.sh: deployed and verified"})
    out(True, checks)


def phase_verify(values):
    secret = dotenv("CRON_SECRET")
    if not secret:
        out(False, message="CRON_SECRET is not in .env, so the studio cannot be asked to send the test")
    code, body = http(f"{ORIGIN}/api/critic?alert=test", {"Authorization": f"Bearer {secret}"}, timeout=90)
    test = (body or {}).get("test") or {}
    if code != 200 or not test.get("sent"):
        out(False, [{"name": "the studio sent a TEST alert", "status": "fail", "detail": f"HTTP {code}: {test.get('reason') or body}"[:300]}])
    _, limit, left = key_limit()
    out(True, [
        {"name": "the studio sent a TEST alert", "status": "pass", "detail": f"Resend id {test.get('id')}"},
        {"name": "the key's limit, read back", "status": "pass", "detail": f"${float(limit):.2f} limit, ${float(left):.2f} left"},
    ], outcome=("Night Shift paints past 24 October, and when a painting fails or the money runs low an email "
                "titled \"Night Shift: …\" reaches admin@experiai.com. A TEST one just arrived."))


def main():
    req = json.load(sys.stdin)
    phase, values = req.get("phase"), req.get("values") or {}
    {"check": phase_check, "apply": phase_apply, "verify": phase_verify}.get(phase, lambda v: out(False, message=f"unknown phase {phase!r}"))(values)


if __name__ == "__main__":
    main()
