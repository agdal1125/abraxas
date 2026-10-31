# 성향 데이터 형식

클라이언트(TypeScript)와 서버(Go)가 같은 파일을 읽는다. 형식을 바꾸면 `scripts/check-scoring.mjs`와 양쪽 파서를 함께 고친다.

## `items.json`

```jsonc
{
  "version": 1,
  "items": [
    {
      "id": "lumi_03",                 // 소문자, 구간 접두어 + 두 자리 번호
      "segment": "ep_lumi",            // prologue | ep_lumi | ep_moka | ep_echo | ep_or | interlude_1..3 | festival
      "kind": "dilemma",               // monologue | errand | dilemma | puzzle_pre | puzzle_post | dialogue | diary
      "axis": "C",                     // 주 적재 축: A | B | C | D | E
      "npc": "lumi",                   // ep_* 구간이면 그 NPC, 아니면 null
      "situation": "축제 프로그램 회의에서 루미가 의견을 묻는다",
      "picks": {
        "a": { "text": "새 프로그램을 넣어 보자", "w": { "C": 12, "A": 4 }, "values": ["자극"] },
        "b": { "text": "작년처럼 하는 게 좋겠어", "w": { "C": -12 },          "values": ["전통"] }
      },
      "note": "설계 의도 한 줄"
    }
  ],
  "tiebreakers": [
    {
      "id": "gate_a",
      "axis": "A",
      "situation": "…",
      "picks": {
        "a": { "text": "…", "w": { "A": 3 } },
        "b": { "text": "…", "w": { "A": -3 } }
      }
    }
  ]
}
```

- `w`: 축 → 가중치. 주 적재 축(`axis`)은 ±8~15, 보조 적재 축은 최대 1개, ±3~5.
- 한 문항 안에서 주 적재 축의 + 쪽 선택지와 − 쪽 선택지가 각각 최소 1개.
- `picks`는 `a`, `b`(필수), `c`(선택). 화면에는 이 순서로 나온다.
- `values`: `kind`가 `dilemma`일 때 모든 선택지에 필수. Schwartz 10가치 이름(한국어) 1~2개.
- 극 코드: A + O / − I, B + H / − L, C + V / − K, D + G / − C, E + N(오늘) / − F(내일).
- 타이브레이커: 주축마다 1개(`gate_a`~`gate_d`), 그 축만 ±3.

## `npcs.json`

```jsonc
{
  "version": 1,
  "npcs": [
    { "id": "lumi", "name": "루미", "start": { "A": 30, "B": 30, "C": 30, "D": 30, "E": 0 }, "themeAxes": ["A", "C"] }
  ]
}
```

- `start`의 A~D는 `game-design-policy.md` 값과 같아야 한다. E는 설계에서 정하고 근거를 `docs/design/`에 적는다.

## `rules.json`

정책 수치를 코드 대신 데이터로 둔다. 값은 `game-design-policy.md`와 같아야 하고 `check-scoring.mjs`가 확인한다.

- `scoreLimit`: 플레이어·NPC 성향 범위(±100), `tieThreshold`: 경계 구간과 수식어 기준(10)
- `npcStep`: NPC 성향 이동 폭(20), `affinityStart`·`affinityGain`·`affinityMin`·`affinityMax`: 호감도 시작(20)·일치 시 증가(+12)·범위(0~100)
