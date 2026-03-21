# cc-scope

[![npm version](https://img.shields.io/npm/v/cc-scope.svg)](https://www.npmjs.com/package/cc-scope)
[![npm downloads](https://img.shields.io/npm/dm/cc-scope.svg)](https://www.npmjs.com/package/cc-scope)

How many files does Claude touch per session? Tracks unique file paths across Read, Edit, and Write calls to measure your session's "blast radius."

```
npx cc-scope
```

Zero dependencies. Reads `~/.claude/projects/` directly.

## Output

```
cc-scope — File Scope per Session
==================================================
Sessions: 1,710 | Files touched per session:
  Median 4  ·  Mean 10.5  ·  p90 16  ·  max 1,288

Scope distribution:
  1 file     ███████░░░░░░░░░░░░░     242   14.2%  (single-file focus)
  2–5 files  ████████████████████     734   42.9%  (focused)
  6–15       ███████████████░░░░░     548   32.0%  (moderate scope)
  16–30      ███░░░░░░░░░░░░░░░░░     119    7.0%  (broad)
  31+        ██░░░░░░░░░░░░░░░░░░      67    3.9%  (sweeping)

Most-touched file types (by access count):
  .py           16,769
  .gd           12,687
  .md           11,994
  .html          3,927
  .yaml          2,273
```

## What it tells you

- **43% of sessions touch 2–5 files** — most Claude Code work is focused, not sweeping
- **14% are single-file sessions** — targeted edits or quick lookups
- **Only 4% touch 31+ files** — broad refactors are rare
- **Max 1,288 files in one session** — outliers exist for massive refactors or codebase exploration
- **p90 is 16 files** — even heavy sessions stay surprisingly contained

## Flags

```bash
npx cc-scope          # scope distribution
npx cc-scope --json   # raw JSON output
```

## Browser version

**[yurukusa.github.io/cc-scope](https://yurukusa.github.io/cc-scope/)** — drag and drop your projects folder.

Part of [cc-toolkit](https://yurukusa.github.io/cc-toolkit/) — tools for understanding your Claude Code sessions.

---


### Want to optimize how Claude Code uses its tools?

**[Claude Code Ops Kit](https://yurukusa.github.io/cc-ops-kit-landing/?utm_source=github&utm_medium=readme&utm_campaign=cc-scope)** ($19) — 16 production hooks + 5 templates + 3 tools. Built from 160+ hours of autonomous operation.

---

*Source: [yurukusa/cc-scope](https://github.com/yurukusa/cc-scope)*
