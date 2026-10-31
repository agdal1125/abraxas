---
name: ink-scenario
description: Writes or edits Abraxas dialogue and choice scripts in ink, with measurement tags on scored choices, then compiles and validates them. Use for NPC episodes, interludes, the festival event, the memory gate, confession and any dialogue or choice text.
---

# ink 시나리오 작성

먼저 `.agents/rules/game-design-policy.md`를 읽는다.

## 파일

- `content/ink/main.ink` 진입점. 에피소드는 `content/ink/ep_<npc>.ink`, 막간은 `interlude_<n>.ink`, 공동 이벤트 `festival.ink`, 기억의 문 `gate.ink`, 고백 `confession.ink`.
- 측정 문항 ID와 가중치는 `content/scoring/items.json`에 둔다. ink에는 ID만 단다.

## 선택지 태그 규칙

```ink
* [축제는 작년처럼 하는 게 좋겠어] # q:lumi_03 # pick:b
* [새 프로그램을 넣어 보자] # q:lumi_03 # pick:a
```

- `# q:<문항ID>` 측정 문항 ID. 측정과 무관한 선택지에는 달지 않는다.
- `# pick:<a|b|c>` 그 문항의 몇 번째 선택지인지. 가중치는 `items.json`의 `q.<ID>.picks.<a|b|c>`에서 읽는다.
- NPC 장면 문항은 `items.json`에 `npc`, `expectAxis`를 적는다. 기대 답변은 NPC의 '현재' 극으로 런타임에 판정한다.
- 타이브레이커는 `# q:gate_<축>`.

## 쓰기 원칙

- 선택지 문구에서 정답·오답이 느껴지지 않게 한다. 두 선택지 모두 매력 있게 쓴다.
- 선택지 순서로 극을 고정하지 않는다(역균형 4/4 유지).
- 측정 문항 반응 대사는 '공감' 또는 '생각에 잠김' 두 종류. 부정적 반응 금지.
- 대사 분량은 에피소드당 약 40줄 이내.
- 한국어 대사는 짧고 구어체로. 번역투를 피한다. 필요하면 humanize-korean 같은 윤문 도구로 다듬는다.

## 검증

1. `inkjs` 패키지의 내장 컴파일러(`inkjs/full`의 `Compiler`)로 JSON 컴파일, 오류 0. OS별 바이너리인 inklecate는 쓰지 않는다(`.agents/rules/cross-platform.md`).
2. `npm run content:check` (추가 예정): 문항 ID가 `items.json`과 1:1인지, 축별 문항 수(주축 8, E 6), 역균형 4/4, NPC 미관여 문항 ≥ 14를 검사.
3. 문항 수나 가중치를 바꿨다면 `scoring-change` 스킬 절차를 따른다.
