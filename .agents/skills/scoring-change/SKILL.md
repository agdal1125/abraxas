---
name: scoring-change
description: Safely changes Abraxas personality scoring data or logic (axis weights, item counts, type thresholds, NPC sway and affinity numbers) and verifies that the TypeScript client and Go server still agree. Use whenever content/scoring, client/src/core, or server/internal/scoring changes.
---

# 성향 계산 변경 절차

성향 계산은 클라이언트(TypeScript)와 서버(Go)에 두 벌 있다. 둘이 어긋나면 화면에 보인 결과와 저장된 결과가 달라진다.

1. 바꾸려는 수치가 `.agents/rules/game-design-policy.md`에 있으면 멈추고 사람에게 승인을 받는다.
2. 데이터(`content/scoring/*.json`)를 먼저 바꾼다. 코드에 숫자를 넣지 않는다.
3. 골든 케이스(`content/scoring/golden/*.json`: 선택 로그 → 기대 결과)를 추가하거나 고친다. 경계 구간(|s| < 10), clamp(±100), NPC 극 반전 케이스를 꼭 포함한다.
4. 양쪽 테스트를 모두 돌린다.
   - `cd client && npm test -- core`
   - `cd server && go test ./internal/scoring/...`
5. 16유형 분포 시뮬레이션(무작위 선택 10,000회)을 돌려 기대값 6.25%(1/16)에서 크게 벗어난 유형(12% 초과 또는 2% 미만)이 있으면 보고한다.
6. `docs/memory/decisions.md`에 변경 이유를 남기고, 기획서 해당 절을 갱신해 달라고 사람에게 알린다.
