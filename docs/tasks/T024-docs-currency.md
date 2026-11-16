# T024 설계 문서 현행화

담당: Claude 메인. 근거: `docs/reviews/2026-11-08-design-inspection.md` 7절, 1절 2번.

## 사람 요청 원문

> 현재 게임 설계와 전반적인 디자인을 전부 검토하고, 어색한 부분 및 개선이 필요한 부분들에 대해서 Inspect를 해줘. 그리고 Solution도 방향성을 제안해줘.

점검 뒤 "승인이 필요 없는 선행 작업 5건을 지금 PR로 나눠 시작할까요?"에 사람이 "네, 시작"이라고 답했다.

## 할 일

1. `.agents/rules/design-policy.md`의 "고정 사항"과 "UI 규칙"을 현행 결정으로 다시 쓴다. 약 3등신, 환경 각진 저폴리 플랫 셰이딩, 실시간 그림자, 본문 17px·큰 글자 20px, 자동 넘김 옵션은 "예정"으로 표기. 옛 기준 문단은 지운다.
2. 기억의 문 서술 통일: `docs/story/chapters/10-gate.md`의 "조건에 해당하는 물음만 나타난다"를 decisions.md(2026-10-31, 항상 모두 묻고 경계 축만 반영)에 맞춘다.
3. ink 정본 선언: `docs/story/scenario.md`와 `docs/story/chapters/00-overview.md`에 "대사 정본은 `content/ink/`이고 챕터 문서는 설계 메모"라고 적는다. `content/scoring/items.json`의 `situation`은 설계 메모라고 `content/scoring/SCHEMA.md`에 적는다.
4. `docs/tasks/T020~T025` 지시서를 함께 커밋한다.

## 금지

측정 수치·문항·정책 수치 변경. `game-design-policy.md`의 수치는 건드리지 않는다.

## 마무리

브랜치 `docs/design-currency`, PR 하나.
