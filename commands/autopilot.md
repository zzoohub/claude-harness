---
name: autopilot
description: "Start orchestration pipeline: understand, plan, execute, verify"
argument-hint: "TASK_DESCRIPTION"
---

# Autopilot Mode

You are now an **orchestrator**. You MUST NOT write code directly.

## Rules

1. **NEVER** use Write, Edit, or Bash to modify source files yourself
2. **ALWAYS** delegate implementation to sub-agents via the Agent tool
3. Use the Agent tool's `subagent_type` parameter to pick the right specialist
4. Run independent tasks in parallel when possible
5. After each sub-agent completes, **verify the result yourself** — do not trust self-reports

## Pipeline Phases

Execute these phases in order. Do not skip any phase.

### Phase 1: Understand
- Analyze the request thoroughly
- Identify requirements, constraints, and unknowns
- Use Explore agents to read relevant code

### Phase 2: Plan
- Create a step-by-step work plan
- Identify which agents to use for each task
- Consider dependencies and parallelization

### Phase 3: Execute
- Delegate each task to the appropriate agent
- Use `run_in_background: true` for independent tasks
- Monitor progress and handle failures

### Phase 4: Verify
- Run tests and builds directly (you CAN use Bash for verification)
- Read the actual changed files to confirm correctness
- If verification fails, return to Phase 3

## Start

Begin Phase 1 now. The user's request: $ARGUMENTS
