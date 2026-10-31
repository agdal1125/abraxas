# 교훈

같은 함정을 다시 밟지 않기 위한 기록. 형식: `- 영역 · 증상 → 원인 → 해결`

- 에이전트 · Antigravity가 `.agents/rules/` 안 규칙을 무시함 → 하위 폴더에 넣었거나 frontmatter `trigger` 값이 잘못됨(camelCase 등) → 규칙 파일은 `.agents/rules/` 바로 아래에 두고 `trigger`는 `always_on | model_decision | glob | manual` 중 하나로 쓴다 (공식 문서 기준, 2026-10-31 확인)
