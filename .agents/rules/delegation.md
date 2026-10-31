---
trigger: model_decision
description: "작업을 다른 에이전트(Codex CLI, Antigravity CLI)에 맡기거나, 병렬 세션·PR·병합을 다룰 때 읽는다."
---

# 작업 위임과 병렬 진행

ADR-0004 기준. Claude(Opus)가 지휘·검수·최종 판단을 맡고, 실제 작업은 아래 CLI 에이전트에 맡긴다.

## 누가 무엇을

| 작업 | 담당 | 모델 |
| --- | --- | --- |
| 코딩 (클라이언트·서버·스크립트·테스트) | Codex CLI `codex exec` | `gpt-6.1-terra`, effort는 난이도로 정함 |
| 디자인·그래픽·아트 리소스 | Antigravity CLI `agy -p` | `gemini-4-argon-medium` (한도 도달 시 `gemini-3.8-flash-high`) |
| 작업 지시서, 검수, 병합, 최종 판단 | Claude (Opus) | — |
| 비밀값·배포·결제, 측정 수치 변경 승인 | 사람 | — |

## Codex (코딩)

- effort: 단순 수정·문서 `low`, 일반 기능 `medium`, 계산 규칙·보안·동시성 `high`. `xhigh` 이상은 Claude가 이유를 적을 때만.
- 호출 형식(작업 폴더는 그 작업의 worktree):

  ```
  codex exec -m gpt-6.1-terra -c model_reasoning_effort="medium" -s workspace-write -C <worktree> "<지시>"
  ```

- ponytail 플러그인(`ponytail@ponytail`)이 켜져 있어야 한다(`codex plugin list`). 과설계를 막는 용도다. 지시문에도 "가장 단순한 구현, 요청 범위 밖 추상화 금지"를 넣는다.
- 테스트는 핵심 동작만: 계산 규칙, 신뢰 경계(인증·입력 검증), 회귀가 실제로 난 곳. 게터·설정값·프레임워크 동작을 확인하는 테스트는 쓰지 않는다.

## agy (디자인·아트)

- 기본 `--model gemini-4-argon-medium`. 사용량 한도 오류가 나면 같은 지시로 `gemini-3.8-flash-high`로 다시 실행하고, 어느 모델로 만들었는지 결과 보고에 적는다.
- 새 작업을 시작할 때마다 argon을 먼저 시도한다(한도가 풀렸으면 자동으로 원래 모델로 돌아감).
- headless 권한: 명령은 정확한 문자열로, 파일 쓰기는 디렉터리 단위로 `--settings`에 허용한다 (`docs/memory/lessons.md` 참고).

## 병렬 세션과 PR

- 작업 하나 = 브랜치 하나 = worktree 하나 = PR 하나. 서로 다른 파일을 건드리는 작업만 동시에 돌린다.
- worktree 위치: `.claude/worktrees/<브랜치 이름>` (git 제외).
- 커밋·push·PR은 Claude가 검수 후 한다. 위임받은 에이전트는 커밋하지 않는다.
- `docs/memory/status.md`·`docs/devlog/`는 여러 PR이 함께 고쳐 충돌이 잦다. 위임 에이전트는 이 파일을 고치지 않고, Claude가 병합 직후 한 번에 갱신한다.

## 병합

- Claude가 CI 통과와 검수 보고서(`docs/reviews/`)를 확인하고 직접 병합한다(사람이 위임함, 2026-10-31).
- 그래도 사람 승인이 필요한 것: `game-design-policy.md` 수치 변경, 비밀값·배포·Firestore 규칙, 새 외부 서비스 연결.
