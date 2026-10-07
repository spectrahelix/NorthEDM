# NorthEDM — agent instructions

**Read [`AGENTS.md`](../AGENTS.md) in the repository root before writing any code.**
It is the single source of truth for this project and is shared by every coding
agent (Claude reads it through `CLAUDE.md`, Codex reads it natively). Keep it
that way: put new project rules in `AGENTS.md`, not in this file.

Copilot does not follow that link on its own, so the four rules that cost this
project the most are repeated here. The reasoning behind each is in `AGENTS.md`.

1. **This is not the Next.js in your training data.** It is a modified Next 16
   with breaking changes. Read the relevant guide in `node_modules/next/dist/docs/`
   before writing code against the framework.

2. **Don't guess — verify, or say you haven't.** A claim about the live site is
   only as good as the check behind it, and the check must be able to fail. Ask
   what you would have seen if it were broken; if the answer is "the same
   thing", the check proved nothing. Pushed, merged, deployed and verified are
   four different things, and only the last is "fixed".

3. **Run `npm run check` before shipping an edit.** It catches the one failure
   nothing else catches — an edit landing in code that isn't the live path. A
   missing App Router route returns 200 with the HTML shell, not a 404, so a
   form posting to a route that doesn't exist hangs silently forever. That
   discarded every promoter application for months.

4. **Look for it before you write it.** Duplicate implementations are this
   repo's most expensive recurring bug: two copies of `WeatherStrip`, a shadow
   `/crowdwave/forum`, two bot-defense modules. Grep for the *behaviour*, not
   just the filename, and if a second copy is right, delete the first in the
   same change.
