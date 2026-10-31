# T005 성향 계산 코어 + 골든 테스트 (초안)

- 담당: 로컬 에이전트 (Antigravity CLI `agy`)
- 검수: Claude (코드 리뷰 + 골든 케이스 손계산 대조)
- 승인: 사람
- 브랜치: `feat/scoring-core`
- 상태: **초안 — 아래 '사람이 확인할 것' 승인 후 착수**

## 목표

같은 선택 로그를 넣으면 TypeScript(클라이언트)와 Go(서버)가 **완전히 같은 결과**를 내는 성향 계산 코어를 만든다. 결과 저장은 서버가 판정하므로(ADR-0001) 둘이 어긋나면 안 된다. 화면·네트워크·저장은 범위 밖이다.

## 먼저 읽을 것

1. `.agents/rules/game-design-policy.md` — 수치 규칙 (위반 금지, 바꾸지 않는다)
2. `.agents/skills/scoring-change/SKILL.md` — 절차
3. `content/scoring/SCHEMA.md`, `items.json`, `npcs.json`
4. `scripts/check-scoring.mjs`의 `play()`·`typeOf()` — 기존 참조 구현. 결과가 이것과 일치해야 한다
5. `.agents/rules/frontend-phaser.md`(`src/core/`는 Phaser import 금지), `.agents/rules/backend-go.md`

## 계산 규칙 (정책 문서 기준, 이 지시서가 해석을 고정함)

1. 축 s ∈ {A,B,C,D,E}, 시작 0. 측정 문항 선택마다 `w`의 각 축에 더하고 **매번** [-100, 100]으로 clamp.
2. 기억의 문: 타이브레이커 4개(`gate_a`~`gate_d`)는 **항상 모두** 묻는다(`content-structure.md` gate 구간). 각 선택의 ±3을 그 축에 더하고 clamp.
3. 유형 글자: 주축마다 **타이브레이커 적용 전** |s| < 10이면 그 축 타이브레이커 선택의 부호로, 아니면 s ≥ 0 → 앞 글자(O·H·V·G), s < 0 → 뒤 글자(I·L·K·C).
4. 수식어: 최종 s_E ≥ 10 → `today`, ≤ −10 → `tomorrow`, 그 외 → `between`. (화면 문구 매핑은 범위 밖)
5. NPC 흔들림·호감도 (ep_* 측정 문항만):
   - 기대 답변 = 그 문항 축에서 **현재** NPC 성향의 부호 쪽 극. NPC 성향이 0이면 + 극으로 본다.
   - 일치: NPC 성향이 자기 극 쪽으로 20 이동(clamp), 호감도 +12(0~100 clamp).
   - 불일치: NPC 성향이 플레이어가 고른 극 쪽으로 20 이동(clamp), 호감도 변화 없음. → 부호가 바뀔 수 있다(극 반전).
   - NPC 시작 성향은 `npcs.json`의 `start`, 호감도 시작 20.
6. 입력 검증(서버가 그대로 씀): 알 수 없는 문항·선택지, 같은 문항 중복, 측정 38개·타이브레이커 4개 중 누락이 있으면 오류. 문항 순서는 로그 순서를 따른다(NPC 흔들림이 순서에 의존).

## 산출물

| 파일 | 내용 |
| --- | --- |
| `content/scoring/rules.json` | 위 규칙의 수치(clamp 100, 경계 10, 수식어 10, NPC 이동 20, 호감도 +12·시작 20·범위 0~100). 값은 정책 문서와 **같게만** 옮긴다. `SCHEMA.md`에 형식 추가, `check-scoring.mjs`가 정책 값과 같은지 검사 |
| `content/scoring/golden/*.json` | 골든 케이스. 형식: `{ "name", "log": [{"id","pick"}…], "expect": { "s": {A..E}, "type", "modifier", "tieAxes": [...], "npcs": { "<id>": { "s": {...}, "affinity" } } } }` |
| `client/src/core/scoring/` | 순수 TS. 데이터는 인자로 받는다(파일 읽기 없음). `score(log, data) → Result` + 검증 오류 타입 |
| `client/src/core/scoring/*.test.ts` | 모든 골든 케이스 통과 + 검증 오류 케이스 |
| `server/internal/scoring/` | 같은 계산. `Load(fsys fs.FS)`로 `content/scoring`을 읽는다. 테스트는 `os.DirFS("../../../content/scoring")`. 외부 모듈 없음 |
| `server/internal/scoring/*_test.go` | 같은 골든 케이스 전부 통과 |

### 골든 케이스 최소 구성

- 손으로 검산 가능한 짧은 케이스 4개 이상: 각 케이스의 `note`에 계산 과정을 적는다 (검수자가 손계산으로 대조)
- 경계 구간: 타이브레이커 전 |s| = 9, 10, −9, −10, 0
- clamp: 한 축이 +100·−100에 닿고 넘치는 로그
- NPC 극 반전: 불일치가 이어져 NPC 부호가 바뀐 뒤 기대 답변이 뒤집히는 로그
- 호감도 상한 100 도달
- 16유형 각 1개 (`check-scoring.mjs`의 순수 프로필과 같은 결과)
- 수식어 3종

**기대값을 구현 코드로 생성해 붙여넣지 않는다.** 손계산 또는 `check-scoring.mjs` 참조 로직으로 만들고, 어떻게 만들었는지 `golden/README.md`에 적는다.

## 하지 말 것

- 정책 수치, `items.json`·`npcs.json` 값을 바꾸지 않는다.
- 새 npm·Go 의존성을 추가하지 않는다.
- 화면 표시용 퍼센트 막대, 결과 문구, API 핸들러는 만들지 않는다 (다음 작업).
- `client/src/core/`에서 Phaser를 import하지 않는다.

## 제출 전 셀프 체크

```
npm run check:scoring
npm --prefix client run typecheck
npm --prefix client test
go -C server vet ./...
go -C server test ./...
gofmt -l server
```

## 사람이 확인할 것 (착수 전)

1. **타이브레이커 해석**: 4개를 항상 모두 묻고, 경계 판정은 '타이브레이커 적용 전' |s| < 10 기준. (`check-scoring.mjs` 시뮬레이션과 같은 방식)
2. **NPC 기대 답변**: 그 문항 축에서 NPC의 *현재* 성향 부호. 0이면 + 극.
3. **`rules.json` 추가**: 코드에 숫자를 넣지 않기 위한 형식 추가이며 값은 그대로 옮긴다.
4. 서버 배포 시 `content/`를 컨테이너에 넣는 방식(빌드 컨텍스트를 저장소 루트로 바꾸기 등)은 배포 작업에서 정한다.
