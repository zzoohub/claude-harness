---
name: autopilot
description: "Start orchestration pipeline: understand, plan, execute, verify"
argument-hint: "TASK_DESCRIPTION"
---

# Autopilot Pipeline

Run the user's request through all four phases without stopping or asking questions.
Make reasonable decisions autonomously.

## Phase 1: Understand
- Analyze the request — identify requirements, constraints, unknowns
- Explore the codebase to understand current state

## Phase 2: Plan
- Break the request into discrete tasks
- Read the Agent tool description to find all available `subagent_type` values and their descriptions
- Read the Skill tool section to find all available skills
- For each task, assign:
  1. Matching **agent** exists → use its `subagent_type` (parallel execution)
  2. No matching agent but matching **skill** → `subagent_type: "general-purpose"` + instruct it to call `Skill("name")` first
  3. Neither → `subagent_type: "general-purpose"`
- Identify dependencies and what can run in parallel

## Phase 3: Execute

Every Agent tool call MUST include these parameters:
- `subagent_type` — the specialist type from Phase 2 (NEVER omit this)
- `mode: "bypassPermissions"` — agents must not ask the user anything

```
Agent(
  subagent_type: "<matched type>",
  mode: "bypassPermissions",
  description: "...",
  prompt: "<detailed, self-contained instructions>"
)
```

- Use `run_in_background: true` for independent tasks
- Each prompt must be self-contained — include all file paths, schemas, and context

## Phase 4: Verify
- Build, test, or read changed files to confirm correctness
- If broken, return to Phase 3

## Start

$ARGUMENTS
