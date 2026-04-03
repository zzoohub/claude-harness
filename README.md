# Claude Harness

Claude Code를 위한 최소 멀티에이전트 오케스트레이션 하네스.

**핵심 원리: hooks + state machine**

- **Hooks** — Claude Code 라이프사이클의 *어디서* 개입할지
- **State machine** — 워크플로우가 *어디까지* 진행됐는지

이 두 가지가 합쳐져서 롱러닝 오케스트레이션이 가능해집니다.

---

## 파일 읽는 순서

처음 이 프로젝트를 이해하려면 아래 순서대로 읽으세요.

```
1단계: 데이터 모델
   core/types.ts          ← 먼저 읽기. 전체 타입이 여기 있음
   core/constants.ts      ← 공유 상수 (모드명, 이벤트명, 도구명)

2단계: 엔진 (hooks)
   core/hooks.ts          ← 이벤트 디스패치 엔진
   runtime/bridge.ts      ← Claude Code ↔ HookEngine 연결 (stdin/stdout)

3단계: 상태 머신 (state machine)
   core/paths.ts          ← 모든 파일 경로 한 곳에 정의
   core/state.ts          ← 모드, 페이즈, 전이. 디스크에 영속

4단계: 엔진 + 상태를 잇는 접착제
   hooks/builtins.ts      ← stop guard, prompt enhancer, session resume

5단계: 오케스트레이터 핵심 행동
   hooks/delegation.ts    ← "위임해, 직접 하지마"
   hooks/keywords.ts      ← 프롬프트 키워드 → 모드 활성화
   hooks/context.ts       ← AGENTS.md/CLAUDE.md 자동 주입

6단계: 실행 모드
   hooks/modes.ts         ← Loop(반복) + Pipeline(단계) 패턴

7단계: 품질 보증 + 에러 복구 + 장기 기억
   hooks/verification.ts  ← "서브에이전트는 거짓말한다"
   hooks/recovery.ts      ← 에러 감지 → 자동 복구 지시
   hooks/memory.ts        ← 컴팩션 생존 메모리 (<remember> 태그)

8단계: 병렬 스케일
   runtime/team.ts        ← tmux 리더/워커 프로토콜 (배치 분할 → 실행 → 재시도)

9단계: 조립
   index.ts               ← createHarness()가 전부를 연결함

나머지 (필요할 때 참조):
   core/config.ts         ← 설정 3단계 병합
   core/registry.ts       ← 에이전트 저장소
   core/prompt.ts         ← 시스템 프롬프트 생성
   runtime/install.ts     ← Claude Code settings.json 훅 등록
```

---

## 폴더 구조

```
src/
├── core/               ← 엔진. hooks + state machine의 기계 부분 (8개)
│   ├── types.ts            타입 정의 (Agent, Hook, State 등)
│   ├── constants.ts        공유 상수 (모드명, 이벤트명, 도구명)
│   ├── paths.ts            모든 파일 경로 (한 곳에서 관리)
│   ├── config.ts           설정 3단계 병합 (user → project → code)
│   ├── registry.ts         에이전트 등록소 (저장/조회/SDK 변환)
│   ├── prompt.ts           에이전트 목록 → 시스템 프롬프트 생성
│   ├── hooks.ts            훅 디스패치 엔진 (이벤트 → 핸들러 → 출력 병합)
│   └── state.ts            상태 머신 (모드/페이즈/전이, 디스크 영속)
│
├── hooks/              ← 행동. 각 라이프사이클 이벤트에서 뭘 할지 (8개)
│   ├── builtins.ts         stop guard + prompt enhancer + session resume
│   ├── delegation.ts       Write/Edit 가로채서 위임 강제
│   ├── keywords.ts         사용자 프롬프트에서 키워드 감지 → 모드 트리거
│   ├── context.ts          AGENTS.md / CLAUDE.md 자동 주입
│   ├── modes.ts            Loop(반복) + Pipeline(단계) 실행 패턴
│   ├── verification.ts     서브에이전트 완료 후 검증 강제
│   ├── recovery.ts         에러 감지 → 자동 복구 지시
│   └── memory.ts           컴팩션 생존 메모리 + <remember> 태그 캡처
│
├── runtime/            ← 연결. 외부 시스템과의 인터페이스 (3개)
│   ├── bridge.ts           Claude Code hook stdin/stdout 브릿지
│   ├── install.ts          settings.json에 훅 커맨드 등록
│   └── team.ts             tmux 리더/워커 프로토콜 (배치 분할 → 실행 → 재시도)
│
└── index.ts            ← 진입점. createHarness()로 전체 조립
```

### 왜 이렇게 나눴나

| 폴더 | 질문 | 변경 빈도 |
|---|---|---|
| `core/` | "기계가 어떻게 작동하나?" | 거의 안 바뀜 |
| `hooks/` | "각 이벤트에서 뭘 하나?" | 자주 추가/수정 |
| `runtime/` | "외부와 어떻게 연결되나?" | 가끔 바뀜 |

---

## 전체 흐름: 기획 → 완료까지

사용자가 `autopilot 인증 모듈 리팩토링해줘` 를 입력했을 때:

```
사용자 입력
    │
    ▼
┌─ SessionStart ──────────────────────────────────────────────┐
│  index.ts          시스템 프롬프트 주입 (에이전트 목록)        │
│  hooks/context.ts  AGENTS.md / CLAUDE.md 주입                │
│  hooks/builtins.ts 이전 세션 모드 복원 (있으면)                │
│  hooks/memory.ts   디스크 메모리 재주입 (있으면)               │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ UserPromptSubmit ──────────────────────────────────────────┐
│  hooks/keywords.ts  "autopilot" 감지                         │
│  → core/state.ts    startMode("pipeline", ["분석","설계","구현","검증"]) │
│  hooks/builtins.ts  "[Phase 1/4: 분석]" 컨텍스트 주입         │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ PreToolUse (Claude가 Agent 도구로 탐색 위임) ─────────────┐
│  hooks/delegation.ts  Agent 도구 → 통과 (위임이니까 OK)       │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ PreToolUse (Claude가 직접 Write 시도) ─────────────────────┐
│  hooks/delegation.ts  Write("src/auth.ts")                   │
│                       → 소스 파일 → "위임하세요!" 경고/차단    │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ PostToolUse (서브에이전트 작업 완료) ──────────────────────┐
│  hooks/verification.ts  "서브에이전트는 거짓말한다.            │
│                          직접 테스트 돌리고, 코드 읽어라."     │
│                          + git diff 요약                     │
│  hooks/recovery.ts      에러 감지 시 → 복구 지시 자동 주입    │
│                          (context limit, edit conflict, agent error) │
│  hooks/memory.ts        <remember> 태그 캡처 → 디스크 저장   │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ Stop (분석 phase 완료, Claude가 멈추려 함) ────────────────┐
│  hooks/modes.ts (pipeline)                                   │
│  → core/state.ts    isLastPhase()? → No                      │
│  → core/state.ts    transition() → phase: "설계"              │
│  → decision: "block"  "분석 완료. 설계 phase로 이동."          │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
Claude가 다시 작업 시작 (설계 → 구현 → 검증)
    │
    ▼
┌─ 검증 phase에서 실패 발견 ──────────────────────────────────┐
│  hooks/modes.ts (pipeline fix loop)                          │
│  → core/state.ts    transition("구현")  ← 구현으로 되돌아감   │
│  → "[Fix loop 1/3: 구현 phase로 복귀]"                        │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
수정 후 다시 검증 → 성공
    │
    ▼
┌─ Stop (검증 phase, 마지막) ─────────────────────────────────┐
│  hooks/modes.ts     isLastPhase()? → Yes                     │
│  → core/state.ts    endMode()                                │
│  → {} (stop 허용)                                             │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
완료 (검증됨, 메모리 저장됨)
```

---

## 세션이 중단됐다가 재개될 때

```
세션 1: pipeline "구현" phase 진행 중 → 세션 종료
         core/state.ts → .harness/state.json에 상태 저장
         hooks/memory.ts → .harness/memory.json에 기억 저장

세션 2: Claude Code 재시작
    │
    ▼
┌─ SessionStart ──────────────────────────────────────────────┐
│  hooks/builtins.ts   "[Resuming mode: pipeline, phase: 구현] │
│                       Phases: [분석 → 설계 → *구현* → 검증]"  │
│  hooks/memory.ts     "[Working Memory]                       │
│                       ## Priority                            │
│                       - auth 모듈은 레거시 세션 방식 사용      │
│                       ## Working Memory                      │
│                       - [14:30] 토큰 갱신 로직에 race condition│
│                       발견"                                   │
└──────────────────────────────────────────────────────────────┘
    │
    ▼
Claude가 구현 phase부터, 이전 발견 사항을 기억한 채로 이어서 작업
```

---

## 대규모 작업: tmux team 리더/워커 프로토콜

```
기획: "20개 API 엔드포인트를 v1 → v2로 마이그레이션"

runTeam(tasks, { concurrency: 4, maxRetries: 2 }) 호출 한 번이면:

  배치 1 (자동):
    ├── tmux pane 1: claude --print "users 마이그레이션"
    ├── tmux pane 2: claude --print "orders 마이그레이션"
    ├── tmux pane 3: claude --print "products 마이그레이션"
    └── tmux pane 4: claude --print "payments 마이그레이션"
    → 자동 폴링, 완료 대기

  배치 2 (자동):
    ├── tmux pane 1: claude --print "auth 마이그레이션"
    ├── ...
    → 실패한 태스크 자동 재시도 (최대 2회)

  최종: TeamReport { succeeded: [...], failed: [...], totalTime: ... }

리더가 알아서: 배치 분할 → 스폰 → 폴링 → 실패 감지 → 재시도 → 결과 병합
오케스트레이터는 runTeam() 한 번 호출만 하면 됨
```

---

## 모듈 의존성

```
core/types.ts ──────── 모든 파일이 참조하는 기반
core/constants.ts ──── modes.ts, delegation.ts, recovery.ts가 참조
core/paths.ts ──────── config.ts, state.ts, memory.ts, team.ts가 참조
    │
    ├── core/config.ts ────────┐
    ├── core/registry.ts ──────┤
    ├── core/prompt.ts ────────┤
    ├── core/hooks.ts ─────────┤
    ├── core/state.ts ─────────┤
    │       ↑                  │
    │       ├─ hooks/builtins  │
    │       ├─ hooks/modes     │
    │       └─ hooks/recovery  │
    │                          ▼
    ├── hooks/* ─────────── index.ts ← createHarness()
    │                          ↑
    └── runtime/install.ts     │
        runtime/bridge.ts ─────┘
        runtime/team.ts (독립)
```

---

## 두 가지 실행 모드

### Loop (반복 실행)

```
OMC 이름: ralph
트리거:   "loop", "계속" (커스텀 가능)

execute → verify → 안 됨 → execute → verify → 됨 → 완료
          iteration 1              iteration 2

상태: { mode: "loop", phase: "execute"|"verify", data: { iteration: N } }
제한: maxIterations (기본 20)
```

### Pipeline (단계별 실행)

```
OMC 이름: autopilot
트리거:   "autopilot", "auto", "파이프라인" (커스텀 가능)

understand → plan → execute → verify → 완료
                       ↑         │
                       └─ fix ───┘  (검증 실패 시, 최대 3회)

상태: { mode: "pipeline", phase: "...", data: { retries: N } }
제한: maxRetries (기본 3)
```

---

## 10개 빌트인 훅

`createHarness()`가 자동으로 등록하는 훅 목록 (실행 순서):

| # | 이벤트 | 훅 | 역할 |
|---|---|---|---|
| 1 | SessionStart | system prompt | 에이전트 목록 주입 |
| 2 | SessionStart | context loader | AGENTS.md / CLAUDE.md 주입 |
| 3 | SessionStart | session resume | 이전 모드/phase 복원 |
| 4 | SessionStart | memory hook | 디스크 메모리 재주입 |
| 5 | UserPromptSubmit | prompt enhancer | 현재 모드/phase 컨텍스트 주입 |
| 6 | PreToolUse | delegation guard | Write/Edit 위임 강제 |
| 7 | PostToolUse | verification | 서브에이전트 검증 강제 |
| 8 | PostToolUse | recovery | 에러 감지 → 자동 복구 지시 |
| 9 | PostToolUse | memory capture | `<remember>` 태그 저장 |
| 10 | Stop | stop guard | 미완료 phase면 중단 차단 |

사용자 정의 훅은 이 10개 뒤에 실행됩니다.

---

## 빠른 시작

```bash
npm install
npm run build
```

### 설정 작성 — 두 가지 방법

#### 방법 1: JSON + Schema (기본, npm 설치 불필요)

`.claude/harness.json`에 `$schema`를 추가하면 VSCode 자동완성 + 유효성 검사가 동작합니다:

```jsonc
// .claude/harness.json
{
  "$schema": "~/.claude/plugins/claude-harness/harness.schema.json",
  "agents": {
    "explorer": {
      "description": "코드베이스 탐색",
      "prompt": "코드 패턴, 파일 구조, 의존성을 빠르게 파악합니다.",
      "model": "haiku"    // ← "haiku" | "sonnet" | "opus" 자동완성
    },
    "coder": {
      "description": "구현 전문",
      "prompt": "file:agents/coder.md",
      "model": "sonnet"
    }
  }
}
```

npm 패키지로 설치한 경우 schema 경로:
```
"$schema": "./node_modules/claude-harness/harness.schema.json"
```

#### 방법 2: defineConfig + .mjs (파워유저, 완전한 타입 체크)

```bash
npm i -D claude-harness
```

```typescript
// .claude/harness.config.ts
import { defineConfig } from 'claude-harness';

export default defineConfig({
  agents: {
    explorer: {
      description: '코드 탐색',       // ← TS 타입 체크 + 자동완성
      prompt: 'file:agents/explorer.md',
      model: 'haiku',
    },
    coder: {
      description: '구현 전문',
      prompt: 'file:agents/coder.md',
      model: 'sonnet',
    },
  },
  systemPromptSuffix: '항상 한국어로 응답하세요.',
});
```

`.ts`를 `.mjs`로 빌드한 뒤 `.claude/harness.config.mjs`에 두면 bridge가 자동으로 로드합니다.
로드 우선순위: `.claude/harness.config.mjs` > `.claude/harness.json`

### 코드로 모드까지 설정:

```ts
import {
  createHarness, install,
  createLoopMode, createPipelineMode, createKeywordDetector,
} from 'claude-harness';

const loop = createLoopMode({ maxIterations: 10 });
const pipeline = createPipelineMode({
  phases: ['분석', '설계', '구현', '검증'],
});

const harness = createHarness({
  agents: {
    explorer:  { description: '코드 탐색', prompt: 'file:agents/explorer.md', model: 'haiku' },
    architect: { description: '설계 분석', prompt: 'file:agents/architect.md', model: 'opus' },
    coder:     { description: '구현',      prompt: 'file:agents/coder.md',     model: 'sonnet' },
  },
  hooks: [
    createKeywordDetector([...loop.keywords, ...pipeline.keywords]),
    ...loop.hooks,
    ...pipeline.hooks,
  ],
});

install('./dist/runtime/bridge.js');
```

---

## OMC와의 관계

이 프로젝트는 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)의
오케스트레이터 핵심 메커니즘을 추출하여 단순하게 재구현한 것입니다.

```
OMC (v4.9.0)              Harness
──────────────             ──────────
200+ 파일, 수만 줄          19개 파일, 2,371줄
19개 에이전트               사용자 정의
30개 스킬                   사용자 정의
35개 MCP 도구               없음 (Claude Code 내장 사용)
```

**남긴 것 (핵심 메커니즘):**
- 설정 3단계 병합 + 경로/상수 중앙 관리
- 에이전트 레지스트리 + 시스템 프롬프트 생성
- 훅 디스패치 엔진 (이벤트 매칭 + 출력 병합)
- 디스크 기반 상태 머신 (모드 + 페이즈 + 전이)
- 위임 강제 ("직접 하지 마")
- 키워드 감지 → 모드 트리거
- 프로젝트 컨텍스트 자동 주입
- Loop / Pipeline 실행 모드
- 서브에이전트 검증 강제
- 에러 감지 + 자동 복구
- 컴팩션 생존 메모리
- tmux 리더/워커 프로토콜 (배치 분할 + 재시도)

**뺀 것 (파인튜닝/도메인 특화):**
- 구체적 에이전트 프롬프트 (explorer, architect, executor 등)
- 스킬 시스템 (ultrawork, ralph의 구체적 프롬프트)
- MCP 도구 서버 (LSP, AST, Python REPL)
- 모델 라우팅 (3-tier + escalation + alias)
- 외부 AI 연동 (Codex, Gemini)
- 가드 시스템 (factcheck, sentinel)
- 태스크 사이즈 감지

---

## TypeScript strict 설정

가장 까다로운 strict 옵션으로 타입 체크됩니다:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noPropertyAccessFromIndexSignature": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true
}
```
# claude-harness
