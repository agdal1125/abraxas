# T025 대사 자동 넘김 설정

담당: game-engineer. 검수: Claude 메인. 근거: `docs/reviews/2026-11-08-design-inspection.md` 5절. 시작 조건: T023이 main에 병합된 뒤(`game.ts` 단일 작성자).

## 사람 요청 원문

> 현재 게임 설계와 전반적인 디자인을 전부 검토하고, 어색한 부분 및 개선이 필요한 부분들에 대해서 Inspect를 해줘. 그리고 Solution도 방향성을 제안해줘.

점검 뒤 "승인이 필요 없는 선행 작업 5건을 지금 PR로 나눠 시작할까요?"에 사람이 "네, 시작"이라고 답했다.

## 지금 상태

대사는 한 줄에 탭 하나다. 디자인 정책은 "대사 자동 넘김은 끌 수 있어야 한다"고 쓰지만 설정 메뉴에 항목이 없다.

## 목표

설정 메뉴에 "자동 넘김: 켜기/끄기"를 추가한다. 기본값은 끄기. 켜면 선택지가 없는 대사 패널(`panel.continue`)이 글자 수에 비례한 시간(기준 초당 6자, 최소 1.2초, 최대 5초) 뒤 자동으로 넘어간다. 탭하면 즉시 넘어가고, 설정·확인 창이 열려 있거나 저장 중 패널이면 자동 넘김을 멈춘다. 선택지, 이름 입력, 퍼즐 판, 결과 카드에는 적용하지 않는다. 값은 `localStorage`에 둔다(`abraxas-large-text`와 같은 방식).

## 소유 파일

`client/src/ui/game.ts`(소유권 부여), `client/src/ui/game.test.ts`, `content/i18n/ko/ui.json`·`content/i18n/en/ui.json`의 `hud` 새 키.

## 금지

측정 선택지 자동 선택, 반응 패널을 읽기 전에 넘기는 시간(반응도 같은 규칙으로 최소 1.2초), 저장 흐름 변경, `docs/memory/`·`docs/devlog/` 수정.

## 검사

`npm --prefix client run typecheck`, `npm --prefix client test`, `npm --prefix client run build`. 타이머가 토큰 바뀐 패널을 넘기지 않는지 테스트 하나.

## 마무리

브랜치 `feat/auto-advance`에 커밋한다. push와 PR은 하지 않는다. 보고에 worktree 경로, 커밋 해시, 실행한 검사, 사람에게 물을 질문을 한국어로 적는다.
