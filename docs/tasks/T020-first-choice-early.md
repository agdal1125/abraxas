# T020 첫 선택을 앞당기기 (프롤로그 대사 재배치)

담당: game-engineer. 검수: Claude 메인. 근거: `docs/reviews/2026-11-08-design-inspection.md` 1절 6번.

## 사람 요청 원문

> 현재 게임 설계와 전반적인 디자인을 전부 검토하고, 어색한 부분 및 개선이 필요한 부분들에 대해서 Inspect를 해줘. 그리고 Solution도 방향성을 제안해줘.

점검 뒤 "승인이 필요 없는 선행 작업 5건을 지금 PR로 나눠 시작할까요?"에 사람이 "네, 시작"이라고 답했다.

## 지금 상태

영상(51초) 뒤 대사 21줄과 이름 입력을 지나야 첫 측정 선택(prologue_01)이 나온다. M0 비평과 DOM 확인으로 사실이다.

## 목표

영상 뒤 첫 선택까지 대사 13줄로 줄인다. 이름 입력은 첫 선택 뒤로 옮긴다. 문항 문구, 문항 순서(01→02→03), 가중치, 반응 문구는 바꾸지 않는다. 대사 문장도 새로 쓰지 않고 순서만 옮긴다.

## 새 순서 (fresh 시작)

1. prelude 영상
2. scene entrance, mode lead
3. knot `demi_follow` (그대로)
4. mode follow
5. knot `postman_intro`: 기존 12줄 중 앞 10줄. 마지막 줄은 "우체부: 주소가 없어도 괜찮아. 천천히 둘러봐."
6. mode sit
7. 문항 `prologue_01` 하나만 묻고 반응까지 본다
8. mode follow
9. 새 knot `postman_name`: "우체부: 하얀 봉투처럼 말끔하네." / "우체부: 부를 이름은 있을까?" (기존 postman_intro에서 옮긴 두 줄)
10. 이름 입력
11. knot `postman_named` (그대로)
12. mode sit
13. 남은 문항 `prologue_02`, `prologue_03`
14. mode follow, knot `prologue_outro`

이어하기(fresh가 아닐 때)는 지금처럼 scene entrance → sit → 남은 문항 → follow → outro. 이름이 없으면 지금처럼 시퀀스 앞에서 이름을 받는다.

영어 `prologue.ink`도 같은 구조로 나눈다. 줄 내용은 그대로다.

## 소유 파일

- `content/ink/ko/prologue.ink`, `content/ink/en/prologue.ink`
- `client/src/ui/opening.ts`, `client/src/ui/opening.test.ts`
- `client/src/ui/game.ts`의 `opening()` 함수만 (단일 작성자 파일. 이 함수 밖은 고치지 않는다)
- `docs/story/chapters/02-chapter0.md`: 장면 순서만 새 순서로 맞춘다. 문장은 바꾸지 않는다

## 구현 메모

- `OpeningActions`에 문항 하나를 묻는 `question(id)`를 추가하고 `questions()`는 아직 답하지 않은 문항만 묻도록 유지한다. `game.ts`의 `opening()`에서 둘을 같은 루프로 구현한다.
- `opening.test.ts`의 기대 이벤트 순서를 새 순서로 바꾼다. 측정 중 강아지가 `sit`인 규칙을 유지한다.
- E2E 하네스(`scripts/e2e-play.mjs`)는 보이는 입력과 버튼을 따라가므로 수정이 필요 없어야 한다. 필요하면 이유를 적는다.

## 금지

문항 문구·순서·가중치 변경, 반응 문구 변경, 새 대사 작성, 영상 변경, 측정 선택 직전에 데미가 방향을 가리키는 연출, `docs/memory/`·`docs/devlog/` 수정.

## 검사

- `npm --prefix client run ink`
- `node client/scripts/check-dialogue.mjs`
- `node client/scripts/check-visible-names.mjs`
- `npm --prefix client run typecheck`
- `npm --prefix client test`
- `npm --prefix client run build`
- E2E(`npm run e2e:play`)는 포트 5173·8080이 비어 있을 때만 돌린다. 못 돌리면 "미실행"으로 적는다. 메인이 병합 전에 돌린다.

## 마무리

브랜치 `feat/first-choice-early`에 커밋한다. push와 PR은 하지 않는다. 보고에 worktree 경로, 커밋 해시, 바뀐 파일, 실행한 검사와 출력 요약, 미실행 항목, 사람에게 물을 질문을 한국어로 적는다.
