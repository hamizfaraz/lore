# LORE — Project Context Log

> **Purpose.** A running, always-current record of everything done on this repo, the exact current
> state, and the context a new person or coding agent needs to resume work mid-stream. Update it at
> the end of every task and at every meaningful step. Newest log entries go at the **bottom** of the
> log section; the "Current state" section is rewritten in place.

## How to resume (read this first)

1. Read `docs/IMPLEMENTATION_PLAN.md` (the source of truth; sections 1–9 shared, 10 task list, 13 merge).
2. Read the **Current state** section below, then the last few **Log** entries.
3. Check `docs/HANDOFF.md` (cross-computer requests) and `docs/CONTRACTS.md` (contract changes).
4. Toolchain on the original machine: Node 22 is installed user-local at `~/.local/node/bin`
   (added to `~/.zshrc`); pnpm 9 is installed globally in that Node. Run
   `export PATH="$HOME/.local/node/bin:$PATH"` in non-login shells.
5. `pnpm install`, then continue the first unchecked task in the task tracker below.

## Repo + branches

- GitHub: `hamizfaraz/lore` (private).
- `main` — C1-0a and C1-0b land here directly (per plan). After that, `main` moves only via merges (section 13).
- `c1/platform` — Computer 1 (this machine's agent) works here from C1-1 on.
- `c2/intelligence` — Computer 2's branch (created by Computer 2).

## Current state

_Rewritten after each step._

- Phase: C1-0a in progress.

## Computer 1 task tracker

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| C1-0a | Bootstrap repo | in progress | |
| C1-0b | Full scaffold on main | pending | |
| C1-1 | Auth | pending | |
| C1-2 | Media pipeline | pending | |
| C1-3 | Social core | pending | |
| C1-4 | Chat | pending | |
| C1-5 | Group accounts | pending | |
| C1-6 | Infra | pending | |
| C1-7 | Game engine + One-Word Story | pending | |
| C1-8 | Meme Battle | pending | |
| C1-9 | Reels, Explore, notifications | pending | |
| C1-10 | Graph import | pending | |
| C1-11 | Pictionary | pending | |
| C1-12 | Solana keepsakes | pending | |
| C1-13 | Polish | pending | |

## Things that need a human (cannot be done by the agent)

- Add the teammate (Computer 2) as a collaborator on `hamizfaraz/lore` — GitHub username not known to the agent.
- Accounts/keys from plan section 14 (C2-0 provisions them): Meta API, Facebook app, Tiger Data, Vultr, domain, etc.

## Deviations from the plan

_Every deviation is also recorded in `docs/IMPLEMENTATION_PLAN.md` (section 18, "Implementation notes") so the plan stays the truth._

## Log

- **2026-10-24 · C1-0a** — Installed Node 22 (official nodejs.org tarball, checksum verified) to
  `~/.local/node` and pnpm 9.15.9 because the machine had no Node. Initialized git repo at
  `/Users/hamiziqbal/Documents/hack_tx_project` (repo root = `lore/` in the plan). Wrote root config
  (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`,
  `lefthook.yml`, `.gitignore`, `.nvmrc`), empty workspace packages, and docs
  (`IMPLEMENTATION_PLAN.md`, `CONTRACTS.md`, `HANDOFF.md`, this log).
