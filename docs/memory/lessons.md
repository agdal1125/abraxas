# 교훈

같은 함정을 다시 밟지 않기 위한 기록. 형식: `- 영역 · 증상 → 원인 → 해결`

- 에이전트 · Antigravity가 `.agents/rules/` 안 규칙을 무시함 → 하위 폴더에 넣었거나 frontmatter `trigger` 값이 잘못됨(camelCase 등) → 규칙 파일은 `.agents/rules/` 바로 아래에 두고 `trigger`는 `always_on | model_decision | glob | manual` 중 하나로 쓴다 (공식 문서 기준, 2026-10-31 확인)
- 성향 설계 · 무작위 선택인데 특정 유형이 19%까지 쏠림 → 보조 적재를 모두 같은 부호로 줌 → 보조 적재 부호도 축별로 균형, `npm run check:scoring`의 '축별 평균 치우침' 확인
