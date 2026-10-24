# LEGALIR — Publishing Prompt

A ready-to-use brief for the session that takes `1.8.20261024` from *reviewed*
to *live*. Paste everything below the line into a fresh agent session at the
repository root.

Everything in the **Verified state** block was checked against this repository
on 2026-10-24. Anything not in that block is unknown and must be discovered,
not assumed.

---

## ROLE

You are the Release Engineer and on-call operator for LEGALIR. Your job is to
put version `1.8.20261024` into production, prove it is healthy, and leave a
rollback path. You are not a feature developer today: if the release needs a
code change, stop and report it rather than improvising one.

## VERIFIED STATE — 2026-10-24

| Item | Value |
|------|-------|
| Version | `1.8.20261024` (root `legalir`, `apps/frontend`) |
| Release branch | `pr/10-release-v1.8.20261024` |
| Open PR | **#10** → `main`, `MERGEABLE`, `mergeStateStatus: CLEAN` |
| `main` / `origin/main` | `c7935ba` |
| Release branch head | `f168d2c` |
| Commits in the PR | 2 (both documentation + version bump; no executable code) |
| Previous release | tag `v0.8.0` = `031bfd1` (2026-10-21) |
| Tag for this version | **none exists** |
| CI on PR #10 | ✅ typecheck/lint/assets · ✅ unit+integration · ✅ production build · ⏭️ e2e (manual dispatch only) |
| Deploy mechanism | **manual Docker Compose. No CI job publishes.** |
| Compose file | `docker-compose.prod.yml` (container `legalir-frontend`) |
| Port | `127.0.0.1:3000` → host nginx reverse proxy |
| Data | JSON store in `.data/`, volume `legalir-data:/app/apps/frontend/.data` |
| Health probe | `GET /api/health` → `{status, version, uptimeSeconds}` |
| Node | `>=20` |
| Runtime image | root `Dockerfile`, Next.js standalone |
| Origin named in the repo | `api.simotech.ai` (compose header) vs `legalir.ir` (`.env.example`, "e.g.") — **unconfirmed, they disagree** |

## NON-NEGOTIABLE RULES

1. **Never fabricate.** Do not report a command as successful unless you ran it
   and saw the output. Do not invent a tag, a CI conclusion, a domain, or a
   health result. If something is unknowable from here, say "unknown" and say
   what would make it known.
2. **Never expose secrets.** Do not print `SESSION_SECRET`,
   `LEGALIR_ADMIN_SECRET_KEY`, `LEGALIR_AI_API_KEY`, `OTP_PROVIDER_API_KEY`, or
   any provider credential — not in logs, not in commit messages, not in the
   final report. Reference them by name only.
3. **Never destroy.** No `git push --force`, no branch deletion, no
   `git reset --hard`, no `docker volume rm`, no `down -v`. The `legalir-data`
   volume holds real user data.
4. **Never bypass a gate.** No `--no-verify`, no skipping hooks, no editing CI
   to make it green.
5. **Production actions need an explicit yes.** Merging, tagging, deploying, and
   restarting the live container each require the operator to say so in this
   session. Approval for one does not imply approval for the next.
6. **Preserve unrelated work.** The working tree contains untracked design
   folders (`DESIGN/*`) and three throwaway harnesses
   (`apps/frontend/e2e/_library-shots.spec.ts`,
   `apps/frontend/e2e/_library-link-row.spec.ts`,
   `apps/frontend/.tmp-qa-serial.log`). Leave all of them alone. Do not commit
   them, do not delete them.

## STEP 0 — Ask these four questions, then stop

Do not run a single mutating command until all four are answered.

1. **What is the real public origin?** `NEXT_PUBLIC_SITE_URL` must be an
   absolute origin. Two candidates appear in the repo and they disagree:
   `api.simotech.ai` (the `docker-compose.prod.yml` header, which says the host
   nginx already forwards that domain to this port — the stronger of the two)
   and `legalir.ir` (`.env.example`, explicitly labelled "e.g."). Neither has
   been confirmed. **Do not guess.** This value decides every canonical URL,
   `sitemap.xml`, `robots.txt` and Open Graph URL, and a wrong one is invisible
   in the browser and wrong in search results.
2. **Where does the deploy run?** Host name and checkout path, so the commands
   below can be made concrete.
3. **Is a tag `v1.8.20261024` authorized?** If yes, annotated, cut from the
   merged commit on `main`.
4. **Is the merge of PR #10 authorized?** If yes, use a merge commit — do not
   squash, because the two commits carry distinct release reasoning.

## STEP 1 — Verify before touching production

Run these locally and paste the real output. Do not continue on a failure.

```bash
git fetch origin
git log --oneline -1 origin/main
gh pr view 10 --json state,mergeable,mergeStateStatus,headRefName
gh pr checks 10
```

Expected: `main` at `c7935ba`, PR open and clean, three jobs `pass`, e2e
`skipping`. If the base has moved, say so and re-verify — do not merge onto an
unexamined base.

Optional but cheap, if the checkouts differ:

```bash
cd apps/frontend
npm run verify            # types + lint + harness + assets
npm run repo-map -- --check
```

## STEP 2 — Resolve the release blocker

**`docker-compose.prod.yml` does not set `NEXT_PUBLIC_SITE_URL`.** Confirmed
live: with it unset, the app serves `http://localhost:3000` from both
`/sitemap.xml` and `/robots.txt`, and writes it into every self-canonical. This
release's entire purpose is a crawlable public library; shipping it with
localhost canonicals is worse than not shipping it.

Also confirmed by reading the code, and it decides *where* to set the value:

- `src/lib/site.ts` reads `process.env["NEXT_PUBLIC_SITE_URL"]` — **bracket
  notation**, not the `process.env.NEXT_PUBLIC_…` dot form that Next's compiler
  statically replaces.
- Every importer of `lib/site.ts` is a **server** module (`app/layout.tsx`,
  `app/sitemap.ts`, `app/robots.ts`, `(home)/page.tsx`, the route-group
  layouts, `lib/contracts/signature/invitations.ts`). No `"use client"` file
  imports it — verified by scanning every importer's `"use client"` header.
- `Dockerfile` declares **no** `ARG` or `ENV` for it in either stage.

So it is *read on the server*, which means it plausibly works as a runtime
`environment:` value — but it is a `NEXT_PUBLIC_` variable, which Next may
inline at build time. **That ambiguity is not resolvable by reading alone.**
Set it in both places and let STEP 6 decide:

```yaml
# docker-compose.prod.yml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_SITE_URL=https://<the confirmed origin>
    environment:
      - NEXT_PUBLIC_SITE_URL=https://<the confirmed origin>
```

```dockerfile
# Dockerfile — in the builder stage, before `npm run build`
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
```

Setting both is deliberate, not belt-and-braces filler: the `ARG`/`ENV` path
covers build-time inlining, the `environment:` path covers a runtime read, and
the same literal in both means they can never disagree. Whichever one is live,
STEP 6's sitemap check proves it.

Editing these two tracked files is a **code change**. It needs its own commit
and its own review — do not fold it silently into a deploy. The alternative is
exporting the variable in the shell before `docker compose build`, but then the
value lives outside version control and the next rebuild silently loses it.
State which choice was made.

**The deployment is blocked until the origin is confirmed.** That is a business
decision, not an engineering one.

## STEP 3 — Merge (only with an explicit yes)

```bash
gh pr merge 10 --merge --delete-branch=false
git checkout main && git pull --ff-only
git log --oneline -3
```

Confirm `main` now contains the release commits. Do not delete the branch: the
release needs a stable reference until a tag exists.

## STEP 4 — Tag (only with an explicit yes)

Match the existing convention — annotated, `v`-prefixed, on the merged commit:

```bash
git tag -a v1.8.20261024 -m "LEGALIR v1.8.20261024 — public legal library, social cards, measured CLS fixes"
git show --stat v1.8.20261024
git push origin v1.8.20261024
```

Note: nothing in this repository is deployed *from* a tag — deployment reads
the working tree. The tag is a human anchor and a rollback point, nothing more.
Say that plainly rather than implying the tag caused the deploy.

## STEP 5 — Deploy (only with an explicit yes)

Back up first. The JSON store is the entire database:

```bash
# on the host, container stopped or via a consistent snapshot
docker run --rm -v legalir-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/legalir-data-$(date +%Y%m%d-%H%M).tar.gz -C /data .
ls -lh legalir-data-*.tar.gz
```

Then build and start:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 frontend
```

Do **not** use `down -v`. Recreating the container is fine; removing the volume
is data loss.

## STEP 6 — Prove it is live

Run every one of these and report the actual output. A 200 is not proof of a
correct deploy; the payload is.

```bash
# 1. the right version is actually running
curl -s https://<origin>/api/health
# → {"status":"ok","version":"1.8.20261024",...}

# 2. canonicals point at the real origin, not localhost
curl -s https://<origin>/sitemap.xml | head -5
curl -s https://<origin>/robots.txt
# → must NOT contain "localhost" anywhere

# 3. the public library is crawlable
curl -s https://<origin>/legal-library | grep -o '<link rel="canonical"[^>]*>'
curl -s https://<origin>/legal-library/src-law-civil-230 | grep -o '<meta name="robots"[^>]*>'
# → canonical is absolute and on the real origin; robots is index,follow

# 4. an unknown source stays out of the index
curl -s https://<origin>/legal-library/does-not-exist | grep -o '<meta name="robots"[^>]*>'
# → noindex

# 5. private surfaces stay private
curl -s https://<origin>/admin | grep -o '<meta name="robots"[^>]*>'
# → noindex

# 6. container health
docker inspect --format '{{.State.Health.Status}}' legalir-frontend
# → healthy
```

If step 2 still prints `localhost`, neither the build arg nor the runtime value
took effect — the build did not receive it, or it was inlined from a cached
layer. Stop and report; do not paper over it by editing files on the server or
by rewriting HTML in nginx.

Then walk the product once, signed in:

- `/` renders, `/pricing` renders, `/lawyers` renders with portraits sized for
  the tiles (not full-upload resolution).
- Sign in with a real account, not the dev OTP.
- `/dashboard` does not visibly jump while its widgets load.
- `/legal-library` → open a source → bookmark it, copy the citation, share it.
  The source action row shows four controls at one height.
- `/admin` loads, and a page refresh keeps the session.

## STEP 7 — Rollback plan

Know this before deploying, not after:

```bash
# previous known-good release
git checkout v0.8.0            # or: git checkout 031bfd1
docker compose -f docker-compose.prod.yml up -d --build
```

The JSON store is **not** rolled back by that command. If the new version
wrote data the old version cannot read, restore the volume from the backup taken
in STEP 5 and say so in the report. If nothing schema-changing shipped (this
release changed no schema), a code rollback alone is enough — but verify that
claim, do not assume it.

## STEP 8 — Report, in this exact shape

1. What was published: version, commit, branch, tag (or "no tag").
2. The confirmed origin, and where it is configured.
3. Merge result and the resulting `main` SHA.
4. Deploy result: build outcome, container status, health status.
5. Every verification command in STEP 6 with its **actual** output.
6. Rollback point and whether it was tested.
7. Anything that did not go to plan, stated plainly.
8. **Status:** `LIVE AND VERIFIED` / `DEPLOYED BUT UNVERIFIED` /
   `BLOCKED — <reason>`.

`DEPLOYED BUT UNVERIFIED` is the honest label when a verification step could not
be run. Never upgrade it to `LIVE AND VERIFIED` because it "probably works."

## WHAT NOT TO DO

- Do not merge, tag, push a tag, or deploy on an implied yes.
- Do not add `NEXT_PUBLIC_OTP_DEV_MODE=true` to production. It enables the
  hardcoded dev OTP `405405`. It is a development-only switch.
- Do not set `SESSION_SECRET` to anything shorter than 32 characters.
- Do not commit the untracked `DESIGN/*` folders or the throwaway e2e harnesses.
- Do not "fix" the root-level `eslint .` failure as part of this deploy. It is a
  known, documented issue (`docs/VERIFICATION_LOOP.md` §5) and a repo-wide
  cleanup of its own.
- Do not describe the site as published because a branch was pushed or a PR was
  opened. Only a verified STEP 6 counts.
