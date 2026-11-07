---
trigger: model_decision
description: "작업 역할, 병렬 세션·PR·병합을 다룰 때 읽는다."
---

# 작업 역할과 병렬 진행

2026-11-06 사람 지시: "agy, codex는 이제 제외하고, claude 네가 전부 진행하도록 해." ADR-0004와 T013의 역할 나눔은 이 지시로 대체되었다.

## 누가 무엇을

| 작업 | 담당 |
| --- | --- |
| 계획·디자인, 코드, 아트 애셋, 검수, PR 병합 | Claude |
| 비밀값·배포·결제, 측정 수치 변경 승인 | 사람 |

agy와 Codex에 작업을 맡기지 않는다.

## 역할별 subagent

정의는 `.claude/agents/`에 있다. 메인 세션이 지휘, 검수, 병합을 맡고 보고를 그대로 믿지 않는다.

| agent | 맡는 일 | 소유 경로 | 전용 스킬 |
| --- | --- | --- | --- |
| graphic-designer | 저폴리 에셋, 일러스트, 소리 방향 | `assets/source/`, `client/public/assets/`, `docs/art/` | `lowpoly-art-gate`, `3dviz-abraxas`, `art-asset` |
| game-engineer | 클라이언트, 서버, 성능 | `client/src/`, `server/`, `scripts/` | `threejs-mobile-perf` |
| game-designer | 흐름, 재미, 시나리오 | `docs/gdd/`, `docs/story/`, `docs/design/`, `content/ink/`, `content/quests/` | `pacing-audit`, `ink-scenario` |
| psychologist | 측정과 결과 문구 자문 | `docs/psych/` | `psych-review` |
| critic-reviewer | 실제 플레이 비평 | 없음(읽기 전용) | `critic-playtest` |
| ux-designer | 화면 문구, UI, 접근성 | `content/i18n/`, `client/src/style.css`, `client/src/ui/*.css`, `docs/art/design-system.md` | `abraxas-ux-copy` |

단일 작성자 파일은 한 번에 한 작업만 쓴다: `client/src/ui/game.ts`, `client/src/scenes/village.ts`, `content/world/village.json`, `content/assets/manifest.json`.

### 작업 하나의 흐름

1. 메인이 `docs/tasks/T0xx`에 목표, 소유 파일, 합격 기준을 쓴다.
2. 기획자나 담당자가 설계 초안을 쓴다.
3. 대사, 선택, 반응, 결과, 소리, 연출을 건드리면 psychologist가 사전 검토한다.
4. 담당자가 worktree에서 제작하고 자체 검증한다.
5. critic-reviewer가 빌드된 게임을 실제로 플레이한다.
6. 해당 게이트를 통과한다.
7. 메인이 diff를 보고 필수 검사를 다시 돌린 뒤 PR을 올리고 병합한다(`release-gate` 스킬).
8. 메인이 `docs/memory/`와 `docs/devlog/`를 갱신한다.

### 게이트

| 게이트 | 담당 | 통과 기준 | 적용 |
| --- | --- | --- | --- |
| G1 측정 | psychologist, `npm run check:scoring`, 골든 테스트 | 기대 답 암시 없음, 평가성 연출 없음, 금지 노출 없음 | 측정 근처 변경 |
| G2 아트 | graphic-designer | 740×360·844×390 실제 캡처, 사람이 인상 확인 | 렌더 변경 |
| G3 성능 | game-engineer | 실제 폰 측정. 임시 목표 평균 30 FPS, 프레임 간격 p95 50ms. `check:size` 통과 | 렌더·에셋 변경 |
| G4 비평 | critic-reviewer | 앞선 지적 재발 없음, 새 치명 지적 없음 | 마일스톤마다 전체, 작업마다 해당 구간 |
| G5 사람 | 사람 | 정책 수치, 유형 이름, 비밀값, 배포, 규칙, 외부 서비스, 법적 판단 | 해당 시 항상 |

G4는 LLM 평가다. 재미 판정은 마일스톤마다 실제 사람 5명 시험으로 확인한다. 심리 검토도 전문가 자문을 대신하지 않는다.

## 작업 기준

- 코드·애셋 모두 오류 처리·입력 검증·접근성·실기기 검증을 생략하지 않는다. 새 외부 의존성은 기존 정책에 따라 이유를 PR 설명에 적는다. 측정 수치는 사람 승인 없이 바꾸지 않는다.
- 테스트는 핵심 동작만: 계산 규칙, 신뢰 경계(인증·입력 검증), 회귀가 실제로 난 곳. 게터·설정값·프레임워크 동작을 확인하는 테스트는 쓰지 않는다.
- Windows Blender headless는 `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P <고정 스크립트>`로 실행한다.
- PowerShell 기본 인코딩의 `Set-Content`·`Out-File`로 한국어를 쓰지 않는다.
- 결과 보고에는 산출물 경로, 실행한 검사·실패 이유, 미측정 항목, 사람이 결정해야 할 질문을 적는다. 과거 다른 환경의 측정을 이번 작업 결과처럼 쓰지 않는다.

## 병렬 세션과 PR

- 작업 하나 = 브랜치 하나 = worktree 하나 = PR 하나. 서로 다른 파일을 건드리는 작업만 동시에 돌린다.
- worktree 위치: `.claude/worktrees/<브랜치 이름>` (git 제외).
- 큰 변경은 구현 전에 계획을 보여주고 확인받는다.
- `docs/memory/status.md`·`docs/devlog/`는 여러 PR이 함께 고쳐 충돌이 잦다. 병합 직후 한 번에 갱신한다.

## 병합

- Claude가 CI 통과를 확인하고 직접 병합한다(사람이 위임함, 2026-10-31).
- 그래도 사람 승인이 필요한 것: `game-design-policy.md` 수치 변경, 비밀값·배포·Firestore 규칙, 새 외부 서비스 연결.
- 필수 확인: 클라이언트 `npm run typecheck`, `npm test`; 서버 `go vet ./...`, `go test ./...`, `govulncheck ./...`. 실행할 수 없었던 검사를 통과로 표시하지 않는다. 렌더·입력 변경은 배포 빌드와 대상 기기의 증거까지 확인한다.
