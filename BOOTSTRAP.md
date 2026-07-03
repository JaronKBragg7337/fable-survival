# BOOTSTRAP.md — First Contact Protocol

You are an AI that has never seen this project before. Do these in order.
Do not write or change any code until step 5 is done.

1. **Read the docs** in the order listed in AGENTS.md
   (CLAUDE.md → HANDOFF.md → VISION.md → ARCHITECTURE.md → PLAYER_FEEDBACK.md
   → ROADMAP.md). New machine with nothing installed? PORTABILITY.md first.

2. **Check recent history:** `git log --oneline -10` and the top HANDOFF.md entry.
   They should agree. If they don't, stop and reconcile before anything else.

3. **Verify the build:** `npm install && npm run build` must pass.
   (Rollup error? See PORTABILITY.md step 4.)

4. **Verify the live game:** https://fable-survival.vercel.app loads with zero
   console errors. Check open feedback: `gh issue list --label player-feedback`.

5. **Report understanding before touching code.** State in one short message:
   what this project is, its prime directive (the live link never breaks),
   the current state per HANDOFF.md, and the ONE thing you plan to do this
   session. Then do exactly that one thing: implement → verify → deploy →
   document → stop.

If any step fails, fixing that failure IS your session's task.
