# T016 검수 — 시나리오를 게임 대사·장면으로

2026-11-04 · 검수 Claude · 판정 **승인**

## 범위

사람 요청(`docs/tasks/T016-user-brief-scenario-to-game.md`)에 따라 T015 시나리오를 실제 게임으로 옮겼다. 첫 장면(알 낙하~데미 조우)은 사람이 시네마틱 영상으로 만들고, 게임은 영상 자리와 그 이후 장면을 맡는다. 계획은 `docs/design/t016-dialogue-plan.md`에 있다.

## 작업자

| 패키지 | 내용 | 담당 |
| --- | --- | --- |
| 계획 | 구조 분석, 매핑, 패키지 분할 | Codex `gpt-6-astra` high |
| P1 | 한/영 대사 302줄씩, 42문항별 반응, UI 문구 | agy `gemini-3.8-flash-high` (Argon4는 429 한도) |
| P3 | 축제 동행·고백·결과·처음의 나 서버 판정 | Codex `gpt-6.1-terra` high |
| P4 | 데미 절차적 메시·동행 모드, 하얀 주인공, 우체부 | Codex `gpt-6.1-terra` medium |
| P5 | 시네마틱 영상 자리·대체 카드 | Codex `gpt-6.1-terra` medium |
| P6 | 대사 계약 검사, E2E 새 흐름 | Codex `gpt-6.1-terra` high |
| P2 | UI 통합(0·A·B·C 네 단계) | Codex `gpt-6.1-terra` high |

## 감독이 찾아 고친 것

- 대기 명령 검증(`pending.ts`)에 `festival_companion`, `confess`가 빠져 있었다. 그래서 축제 동행 선택이 저장 전에 막혔다. 단위 테스트는 통과했고 E2E에서만 드러났다. 수정과 회귀 테스트를 추가했다.
- 마지막 장면 패널이 빈 문자열이었다. 결과 고지를 표시하도록 바꿨다.
- E2E 하네스가 예외 위치를 기록하도록 고쳤다.

## 검증 (감독이 샌드박스 밖에서 직접 실행)

- 통과: `npm --prefix client run ink`, `check-dialogue`, `check-visible-names`, `check-moka-ink`, `check-residents-ink`, `npm run check:scoring`(38+4 유지), typecheck, 클라이언트 테스트 165개, build, `check:size` 7.22MB/10MB, `node --test` 17개, `go vet`, `go test`, govulncheck(호출되는 취약점 없음).
- E2E(로컬 서버, 실제 브라우저):

| 시나리오 | 결과 |
| --- | --- |
| ko a-auto | ending-done 도달, 답 42, 오류 0 |
| en a-auto | ending-done 도달, 답 42, 오류 0 |
| en resume | ending-done 도달, 답 42, 오류 0 |
| ko b-manual | 1차는 모카 진열 뒤 'Uncaught'(내용 없음)로 중단. 하네스 보강 후 2차는 도달, 답 42, 오류 0. 재현되지 않아 간헐 문제로 기록 |
| en b-manual | ending-done 도달, 답 42, 오류 0 |

- 캡처: 시네마틱 대체 카드, 하얀 주인공과 데미 동행, 고백 응답, 마지막 장면을 확인했다.

## 측정 무결성

- 문항 38+4, 가중치, 순서, 골든 데이터는 바꾸지 않았다(`check:scoring` 통과). `rules.json`에는 정책에 이미 있는 동행 +10, 고백 60만 옮겼다.
- 선택은 저장 확정 뒤에 반응을 보여 준다. NPC가 관여하지 않는 문항과 문 질문은 항상 '생각에 잠김' 반응이다. 측정 중 데미 자세는 sit/gate로 고정된다.
- 고백 대상·이유, 축제 동행, 이름 입력은 측정에 넣지 않는다. 결과 카드에는 내부 코드와 숫자가 나오지 않는다(단위 테스트).

## 남은 일

- 시네마틱 영상 납품: `client/public/cinematics/prelude-v1.mp4`. 실제 재생, 모바일 자동재생, 용량은 납품 뒤 확인한다.
- 데미 외형의 게임 크기 검수. 필요하면 agy Blender GLB로 교체한다.
- 결과 카드 화면 디자인. 카드 코드의 '닮은 점/다른 점'과 작업 목록 문구가 i18n이 아니라 코드에 들어 있으니 옮긴다.
- Firebase 에뮬레이터 E2E와 실기기 확인은 이번에 실행하지 않았다.
- `docs/story/scenario.md`는 옛 요약이다. chapters 기준으로 정리가 필요하다.
