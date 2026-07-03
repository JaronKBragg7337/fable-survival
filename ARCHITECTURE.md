# ARCHITECTURE.md — Why It's Built This Way

Decisions below are deliberate. Don't "improve" them away without a strong,
documented reason and an entry in HANDOFF.md explaining the change.

**Why web/Three.js instead of Unity/Unreal/native?**
The entire point is playing from a link on any phone. Native builds, APKs, and
app stores are explicitly out of scope (owner's hard rule from day one).

**Why Vite?**
Instant dev server, tiny config, static `dist/` output that deploys anywhere.
No framework (React etc.) because the game UI is a handful of DOM panels —
a framework adds bundle weight and abstraction for zero gain here.

**Why one module per system?**
So an AI session can change the trader without reading the zombie AI. Every
module has a header comment saying how to expand it. Never merge systems into
one file; never let main.js grow beyond bootstrapping + the loop.

**Why custom circle/AABB collision instead of a physics engine?**
Phones. A physics lib costs bundle size, CPU, and tuning pain, and this game
only needs "don't walk through things." `collision.js` is ~50 lines and fast.
Revisit only if a feature truly needs dynamics (it probably doesn't).

**Why a seeded/deterministic world instead of saving the whole map?**
Saves stay tiny (localStorage) because tree/rock/house positions regenerate
identically from the seed in world.js. Only dynamic state (player, inventory,
buildings, vehicles, time) is saved. If you change worldgen, old saves must
still load — dynamic state doesn't reference node indices, keep it that way.

**Why localStorage instead of a backend?**
Zero cost, zero accounts, works offline, good enough for per-device progress.
A backend only enters the picture if/when multiplayer or leaderboards are
built (see ROADMAP Milestone 4 — research first).

**Why emoji icons and flat-colored low-poly meshes?**
No texture downloads, no asset pipeline, instant load, and a coherent style
that hides the absence of AAA art. Visual upgrades should be procedural
(vertex colors, runtime-generated canvas textures) before ever adding image
assets — and any image asset must be small (≤256px).

**Why InstancedMesh for trees/rocks/fence?**
Draw calls are the #1 phone bottleneck. 70 trees = 2 draw calls, not 140.
Any new repeated object should follow this pattern (see world.js).

**Why object pooling for zombies?**
No allocation/GC hitches during play, capped worst-case cost (12 active).
Anything that spawns repeatedly (projectiles, particles) must be pooled too.

**Why deploy the prebuilt dist/ to Vercel instead of git-integration builds?**
The machine already has an authenticated Vercel CLI, static deploys take
seconds, and there's no CI to break. If the repo later gets Vercel git
integration, keep `base: './'` in vite.config.js so nothing else changes.
