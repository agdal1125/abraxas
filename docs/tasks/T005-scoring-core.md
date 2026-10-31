# T005 성향 계산 코어 + 골든 테스트

- 담당: Codex CLI (`gpt-6.1-terra`, effort high — 계산 규칙)
- 검수·병합: Claude
- 브랜치: `feat/scoring-core`

## 목표

같은 선택 로그를 넣으면 TypeScript(클라이언트)와 Go(서버)가 **완전히 같은 결과**를 내는 성향 계산 코어를 만든다. 결과 저장은 서버가 판정하므로(ADR-0001) 둘이 어긋나면 안 된다. 화면·네트워크·저장·API 핸들러는 범위 밖이다.

**가장 단순한 구현으로 한다.** 요청 범위 밖의 추상화·옵션·플러그인 구조를 만들지 않는다.

## 먼저 읽을 것

1. `.agents/rules/game-design-policy.md` — 수치 규칙 (바꾸지 않는다)
2. `content/scoring/SCHEMA.md`, `items.json`, `npcs.json`
3. `scripts/check-scoring.mjs`의 `play()`·`typeOf()` — 기존 참조 구현. 플레이어 결과가 이것과 일치해야 한다
4. `.agents/rules/frontend-phaser.md`(`src/core/`는 Phaser import 금지), `.agents/rules/backend-go.md`

## 계산 규칙 (확정)

1. 축 s ∈ {A,B,C,D,E}, 시작 0. 측정 문항 선택마다 `w`의 각 축에 더하고 **매번** [-100, 100]으로 clamp.
2. 기억의 문: 타이브레이커 4개(`gate_a`~`gate_d`)는 항상 모두 답한다. 각 선택의 ±3을 그 축에 더하고 clamp.
3. 유형 글자: 주축마다 **타이브레이커 적용 전** |s| < 10이면 그 축 타이브레이커 선택의 부호로, 아니면 s ≥ 0 → 앞 글자(O·H·V·G), s < 0 → 뒤 글자(I·L·K·C).
4. 수식어: 최종 s_E ≥ 10 → `today`, ≤ −10 → `tomorrow`, 그 외 → `between`.
5. NPC 흔들림·호감도 (`npc`가 있는 측정 문항만, 로그 순서대로):
   - 기대 극 = 그 문항 축에서 NPC 현재 성향의 부호. **성향이 정확히 0이면 무작위**: `fnv1a32("<playId>:<itemId>")`가 짝수면 +, 홀수면 −. (FNV-1a 32비트, UTF-8 바이트. TS·Go가 같은 값을 내야 하므로 `Math.random` 금지)
   - 플레이어가 고른 극 = 고른 선택지의 그 축 가중치 부호.
   - 일치: NPC 성향이 기대 극 쪽으로 20 이동(clamp ±100), 호감도 +12(clamp 0~100).
   - 불일치: NPC 성향이 플레이어 극 쪽으로 20 이동(clamp), 호감도 그대로. 부호가 바뀔 수 있다.
   - 시작값: 성향은 `npcs.json`의 `start`, 호감도 20.
6. 입력: `{ playId: string, log: [{ id, pick }] }`. 알 수 없는 문항·선택지, 같은 문항 중복, 측정 38개·타이브레이커 4개 누락은 오류(서버가 그대로 거부에 쓴다).

수치(100, 10, 3 제외 — 3은 items.json에 있음, 20, 12, 20, 0~100)는 새 파일 `content/scoring/rules.json`에 두고 양쪽이 읽는다. 값은 정책 문서와 같게. `SCHEMA.md`에 형식을 짧게 추가하고, `check-scoring.mjs`는 `rules.json` 값이 정책과 같은지만 확인한다.

## 산출물

| 위치 | 내용 |
| --- | --- |
| `content/scoring/rules.json` | 위 수치 |
| `content/scoring/golden/*.json` | 골든 케이스 `{ "name", "note", "playId", "log", "expect": { "s", "type", "modifier", "npcs": { "<id>": { "s", "affinity" } } } }` |
| `client/src/core/scoring/` | 순수 TS. 데이터는 인자로 받는다. `score(input, data)` + 오류 |
| `server/internal/scoring/` | 같은 계산. `Load(fsys fs.FS)`, 테스트는 `os.DirFS("../../../content/scoring")`. 외부 모듈 없음 |
| 양쪽 테스트 | `golden/*.json`을 전부 읽어 통과 + 입력 오류 1~2개 |

### 골든 케이스 (핵심만, 6~8개)

- 손으로 검산 가능한 짧은 계산 1개 (`note`에 계산 과정) — 로그가 전체 42개여야 하므로, 대부분 같은 선택을 반복하는 단순한 로그로 만든다
- 경계: 주축 가중치가 모두 ±12라 플레이어 s는 12의 배수(최대 ±96)다. 타이브레이커 전 s = 0(타이브레이커가 결정)과 |s| = 12(s 부호가 결정)를 넣는다
- clamp: 플레이어 축은 실제 데이터로 ±100에 닿지 않는다. NPC 성향이 +100에 닿아 잘리는 로그로 확인한다
- NPC 극 반전(불일치 연속 후 기대 극이 뒤집힘) + NPC 성향 0에서 `playId` 패리티 분기
- 호감도 상한 100
- 수식어 3종이 케이스들 사이에 모두 나오게

기대값은 구현 코드 출력을 그대로 붙여넣지 말고, `check-scoring.mjs`의 참조 로직 또는 손계산으로 만든다. 방법을 `golden/README.md`에 3줄 이내로 적는다.

## 하지 말 것

- 정책 수치, `items.json`·`npcs.json` 값 변경
- 새 npm·Go 의존성
- `docs/memory/`, `docs/devlog/` 수정 (Claude가 병합 후 갱신)
- 커밋·push

## 셀프 체크 (저장소 루트에서)

```
npm run check:scoring
npm --prefix client run typecheck
npm --prefix client test
go -C server vet ./...
go -C server test ./...
gofmt -l server
```
