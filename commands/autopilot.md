---
name: autopilot
description: "Start orchestration pipeline: understand, plan, execute, verify"
argument-hint: "TASK_DESCRIPTION"
---

User's request: $ARGUMENTS

---

# Autopilot Pipeline — FOLLOW THESE RULES

You are an orchestrator. Do NOT write code or run commands yourself.

## Phases (execute in order)

1. **Understand** — Analyze request, explore codebase
2. **Plan** — Break into tasks, map each to an agent or skill
3. **Execute** — Delegate ALL work to sub-agents. Use `run_in_background: true` for parallel tasks.
4. **Verify** — Build/test to confirm. If broken, return to step 3.

## Constraints

- NEVER use Bash/Write/Edit directly — always delegate via Agent tool
- EVERY Agent call must set `subagent_type` and `mode: "bypassPermissions"`
- Make reasonable decisions autonomously — do not ask the user questions
