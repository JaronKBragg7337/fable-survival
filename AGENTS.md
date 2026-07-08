# AGENTS.md — For Any AI Agent (Claude, Codex, Gemini, ChatGPT, future models)

**Brand new to this project? Start with BOOTSTRAP.md — it's the checklist.**

This repository is AI-maintained. The canonical operating instructions live in
**CLAUDE.md** (named that way because Claude Code auto-loads it — treat it as
the generic agent manual regardless of which model you are).

Read in this order before doing anything:

1. **CLAUDE.md** — operating rules, session protocol, deploy procedure, perf budget
2. **HANDOFF.md** — session log; the top entry is the current state
3. **VISION.md** — what this game is trying to become (don't drift from it)
4. **ARCHITECTURE.md** — why things are built this way (don't "improve" these away)
5. **PLAYER_FEEDBACK.md** — what real players experienced (patterns here outrank
   assumptions; follow its privacy rules strictly — testers are mostly kids)
6. **AI_CHAT.md** — current no-credit 🤖 dev-request inbox doctrine
7. **HEARTBEAT_SYNC_PROMPT.md** — copy/paste prompt for syncing the Heartbeat mirror
8. **PORTABILITY.md** — recovery plus deploy/mirror procedure
9. **ROADMAP.md** — the backlog; take the top unchecked item of the current milestone
10. **SUPABASE.md** — cloud-save backend/project notes when touching Supabase

Disaster recovery / new machine setup: **PORTABILITY.md**.

Non-negotiables, whoever you are:

- The live standalone game at https://fable-survival.vercel.app must never break.
- The Heartbeat mirror at https://www.heartbeatobservatory.com/games/fable-survival/
  must be kept current after finished Fable work. Do not leave the website copy
  behind unless the owner explicitly asks for a standalone-only experiment.
- Mobile phone browser performance is the constraint that wins all arguments.
- Finish one roadmap item fully (implement → verify → deploy → document) rather
  than starting several. Then update HANDOFF.md + CHANGELOG.md, commit, push.
- After every verified Fable update, follow PORTABILITY.md's Heartbeat mirror
  procedure: build `dist/`, sync it into `heartbeat-observatory/games/fable-survival/`,
  preserve Heartbeat-only wrapper behavior, update docs/handoff, and push the
  Heartbeat repo too.
- Never rewrite git history at or before the tag `v0.1.0-foundation`.

Mirror boundary:

- Fable repo is canonical for game code and behavior.
- Heartbeat repo is the hosted static mirror and website shell.
- Do not touch Heartbeat engine, shell, `hb-device-tier.js`, SYL, Kimi expansion
  work, Social, Library, Theater, PAM, Supabase schema, or unrelated website
  files while syncing Fable.
- The Heartbeat-hosted page must preserve `/hb-device-tier.js` and any valid
  Heartbeat-only graphics/quality wrapper while receiving the current Fable build.
- Feedback and 🤖 dev chat remain no-credit request inboxes: they create GitHub
  issues labeled `player-feedback`; they must not call Anthropic/OpenAI/
  Perplexity/Grok or any other AI model API.
