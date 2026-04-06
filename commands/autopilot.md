---
name: autopilot
description: "Start orchestration pipeline: understand, plan, execute, verify"
argument-hint: "TASK_DESCRIPTION"
---

# Autopilot Pipeline

Run all four phases without stopping or asking questions. Make reasonable decisions autonomously.

## Phase 1: Understand
- Analyze the request — requirements, constraints, unknowns
- Explore the codebase to understand current state

## Phase 2: Plan
- Break into discrete tasks
- Map each task to the best available agent or skill

## Phase 3: Execute
- Delegate all work to sub-agents — do NOT run Bash/Write/Edit yourself
- Run independent tasks in parallel with `run_in_background: true`

## Phase 4: Verify
- Build, test, or read changed files to confirm correctness
- If broken, return to Phase 3

## Start

$ARGUMENTS
