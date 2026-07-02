# AGENTS.md — For Any AI Agent (Claude, Codex, Gemini, ChatGPT, future models)

This repository is AI-maintained. The canonical operating instructions live in
**CLAUDE.md** (named that way because Claude Code auto-loads it — treat it as
the generic agent manual regardless of which model you are).

Read in this order before doing anything:

1. **CLAUDE.md** — operating rules, session protocol, deploy procedure, perf budget
2. **HANDOFF.md** — session log; the top entry is the current state
3. **VISION.md** — what this game is trying to become (don't drift from it)
4. **ARCHITECTURE.md** — why things are built this way (don't "improve" these away)
5. **ROADMAP.md** — the backlog; take the top unchecked item of the current milestone

Non-negotiables, whoever you are:

- The live game at https://fable-survival.vercel.app must never break.
- Mobile phone browser performance is the constraint that wins all arguments.
- Finish one roadmap item fully (implement → verify → deploy → document) rather
  than starting several. Then update HANDOFF.md + CHANGELOG.md, commit, push.
- Never rewrite git history at or before the tag `v0.1.0-foundation`.
