# T005 검수 · 2026-10-31 · 검수자: Claude

- 대상: `feat/scoring-core` (Codex `gpt-6.1-terra` effort high 작업분)
- 기준: `docs/tasks/T005-scoring-core.md`, `.agents/rules/game-design-policy.md`

## 판정: 승인 (검수자 수정 포함)

## 확인한 것

- `check:scoring`, client typecheck·test(12), Go vet·test, gofmt, govulncheck 모두 통과 (검수자 재실행)
- TS·Go 모두 `content/scoring/golden/*.json` 6개를 같은 기대값으로 통과 → 두 구현 일치
- 손계산 대조: `positive`(주축 96+3=99, E 72, 모카 D 축 −30 → −10 → +10 부호 반전 후 일치 +12 → 호감도 68), `npc-match`(주제 축 90, 호감도 92) 일치
- 유형 판정은 타이브레이커 **전** 점수 기준(지시서 규칙). 참조 시뮬레이션은 적용 후 점수를 쓰지만, 현재 데이터에서 타이브레이커 전 주축은 0 또는 |s| ≥ 24라 결과가 같다
- FNV-1a 32: TS 수동 구현이 표준 벡터(`"a"` → `e40c292c`)와 일치, Go는 `hash/fnv`
- 외부 의존성 없음, `client/src/core`에 Phaser import 없음

## 검수자가 고친 것

- Codex가 Windows에서 쓴 한국어가 `?`로 깨짐: `SCHEMA.md` 규칙 설명, `golden/README.md`, 골든 `note` 6개, `balanced.json`의 `playId`를 다시 씀

## 현재 데이터로 검증할 수 없는 분기 (코드는 구현됨)

- NPC 성향 0(플레이 ID 해시로 기대 극 결정), ±100 clamp, 호감도 100: 주축 8문항×±12, NPC 축당 3문항·시작 ±30 구조에서는 닿지 않는다. 문항 수나 가중치가 바뀌면 이 분기용 골든 케이스를 추가한다.
