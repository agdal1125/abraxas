# T023 기억 조각 HUD와 기억의 문 연출

담당: game-engineer. 검수: Claude 메인. 근거: `docs/reviews/2026-11-08-design-inspection.md` 1절 4번. 시작 조건: T020이 main에 병합된 뒤(`game.ts` 단일 작성자).

## 사람 요청 원문

> 현재 게임 설계와 전반적인 디자인을 전부 검토하고, 어색한 부분 및 개선이 필요한 부분들에 대해서 Inspect를 해줘. 그리고 Solution도 방향성을 제안해줘.

점검 뒤 "승인이 필요 없는 선행 작업 5건을 지금 PR로 나눠 시작할까요?"에 사람이 "네, 시작"이라고 답했다.

## 지금 상태

정책(`.agents/rules/design-policy.md` "진행도는 상단 '기억 조각 n/12'")과 모든 챕터 문서가 기억 조각을 진행도로 쓴다고 하지만 구현이 없다. 우체부 대사 "기억 조각 하나 건넬게"만 있다.

## 목표

1. HUD에 "기억 조각 n/12"를 보여 준다. 탐색 중 목표 칩 옆에 작게 둔다. 설정 버튼과 겹치지 않는다.
2. 조각이 늘어날 때 짧은 알림을 보여 준다(기존 `world-notice` 재사용, 2초). 문구는 ui.json에 ko·en으로 둔다. 예: "기억 조각을 찾았다 (3/12)".
3. 기억의 문 장면 시작 때(`lateScene`의 `gate_intro` 앞) 모인 조각 수를 한 번 보여 주는 가벼운 연출을 넣는다. 기존 `ending-egg` CSS처럼 DOM·CSS만 쓴다. 움직임 줄이기 설정에서는 정지 상태로 보여 준다.

## 조각 계산 (표시 전용, 서버·측정과 무관)

서버 스냅샷이나 로컬 상태의 답 로그와 완료 목록에서 계산하는 순수 함수 하나(`client/src/core/fragments.ts`)로 둔다.

| 조건 | 조각 |
| --- | --- |
| prologue 문항 3개를 모두 답함 | 1 |
| 에피소드 완료(`completed`)마다 | 2 (최대 8) |
| festival 문항 5개를 모두 답함 | 2 |
| 기억의 문 타이브레이커 4개를 모두 답함 | 1 |

합계 12. 선택 내용에 따라 차등을 두지 않는다(정책: 조각을 선택 보상으로 차등 지급하지 않는다). 테스트는 이 계산 규칙 하나만 쓴다.

## 소유 파일

- 신규 `client/src/core/fragments.ts`, `fragments.test.ts`
- `client/src/ui/game.ts`(소유권 부여), `client/src/ui/hud.ts`, `client/src/ui/hud.css`, `client/src/style.css`
- `content/i18n/ko/ui.json`, `content/i18n/en/ui.json`의 새 키만

## 금지

측정·저장·서버 코드 변경, 조각 수를 서버에 저장하는 변경, 조각에 색이나 모양으로 성향을 대응시키는 연출, 측정 선택 직후의 조각 알림(알림은 구간 완료 시점에만), `docs/memory/`·`docs/devlog/` 수정.

## 검사

- `npm --prefix client run typecheck`, `npm --prefix client test`, `npm --prefix client run build`, `npm --prefix client run check:size`
- 740×360과 844×390에서 HUD 겹침 없음 캡처(개발 서버는 다른 포트로 띄우고 `preview_start`에 url을 넘긴다). 큰 글자 20px도 확인
- `node client/scripts/check-visible-names.mjs`

## 마무리

브랜치 `feat/memory-fragments-hud`에 커밋한다. push와 PR은 하지 않는다. 보고에 worktree 경로, 커밋 해시, 캡처 경로, 실행한 검사, 미확인 항목, 사람에게 물을 질문을 한국어로 적는다.
