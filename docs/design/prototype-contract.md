# 프로토타입 계약서 (첫 로컬 플레이)

이 계약은 폐기된 1차 프로토타입의 기록이다. 현재 화면은 가로 우선이며 `docs/tasks/T011-landscape-brief.md`를 따른다.

병렬 작업(T006 화면·흐름, T007 대사·문구, T008 아트)이 서로를 기다리지 않도록 파일 경로와 형식을 여기서 고정한다. 목표는 **완성도가 아니라 처음부터 결과까지 끊기지 않는 한 판**이다.

## 흐름

```
Title(언어 KO/EN 선택) → prologue → Hub(다음 NPC 고르기) → ep_<npc> → (interlude_1·2·3이 에피소드 사이에 순서대로) … → festival → gate → Result
```

- 에피소드 4개 순서는 플레이어가 고른다. 막간은 1·2번째, 2·3번째, 3·4번째 에피소드 사이에 `interlude_1`, `interlude_2`, `interlude_3` 순서로 들어간다.
- 고백(confession)은 프로토타입에서 생략한다.
- 측정 문항 38 + 타이브레이커 4를 모두 지나야 한다(`score()`가 전부를 요구함).

## 구간을 어떻게 보여주나

| 구간 | 방식 |
| --- | --- |
| `prologue`, `ep_lumi` | ink 스크립트 (`content/ink/<lang>/<segment>.ink`) |
| 나머지(`ep_moka`·`ep_echo`·`ep_or`·`interlude_*`·`festival`·`gate`) | **일반 문항 장면**: `items.json`의 `situation`을 대사창에 보여주고 선택지 버튼을 띄운다. 영어는 `content/i18n/en/items.json`에서 같은 id로 찾는다 |

ink 파일이 없거나 컴파일에 실패한 구간은 일반 문항 장면으로 대신한다(어떤 경우에도 진행이 막히지 않게).

## ink 작성 규칙

- 파일: `content/ink/ko/prologue.ink`, `content/ink/ko/ep_lumi.ink`, `content/ink/en/…` 같은 이름.
- 대사: `루미: 안녕!` 처럼 `이름: 내용`. 콜론 앞이 화자, 없으면 지문.
- 측정 선택지: 태그 두 개를 **대괄호 안** 끝에 넣는다 `* [선택지 문구 # item:lumi_01 # pick:a]`. 대괄호 뒤(`* [문구] # item…`)에 두면 inkjs가 선택지 태그로 읽지 않는다(컴파일 스크립트가 오류로 막음). 같은 문항의 선택지 수·순서는 `items.json`과 같게, 문구 뜻도 같게(표현은 대사 톤으로 다듬어도 됨).
- 측정과 무관한 선택지는 태그 없이 쓴다.
- 한 구간의 측정 문항은 그 구간의 `items.json` 문항 전부를 한 번씩 지나야 한다(분기로 건너뛰기 금지).
- 끝은 `-> END`.
- 측정 선택 직후 NPC 반응은 런타임이 `ui.json`의 `reaction.empathy` / `reaction.thinking` 중 하나를 띄운다. ink에는 좋고 나쁨이 갈리는 반응을 쓰지 않는다(측정 오염 방지 정책 2·5).
- 컴파일: `npm --prefix client run ink` → `client/public/ink/<lang>/<segment>.json`.

## 문구 파일

- `content/i18n/<lang>/ui.json`: 화면 문구. 키는 아래 시드 파일 그대로 유지하고 값만 다듬는다.
- `content/i18n/en/items.json`: `{ "<itemId>": { "situation": "...", "picks": { "a": "...", "b": "..." } } }` — 측정 38 + 타이브레이커 4 전부.
- 플레이어 화면에 축 이름·코드(A~E, O/I…)·수치·'MBTI'를 쓰지 않는다.

## 결과 화면

- `score()` 결과의 유형 글자는 **화면에 쓰지 않는다**. 축마다 `ui.json`의 `result.poles.<A~D>.<plus|minus>` 문구 4줄 + `result.modifier.<today|between|tomorrow>` + `result.disclaimer`를 보여준다.
- NPC 호감도·수치는 보여주지 않는다.

## 아트 파일 (`client/public/assets/`)

| 경로 | 쓰는 곳 |
| --- | --- |
| `bg/village.svg` | Title, prologue, Hub, interlude |
| `bg/festival.svg` | festival |
| `bg/gate.svg` | gate, Result |
| `char/lumi.svg` `char/moka.svg` `char/echo.svg` `char/or.svg` | 해당 에피소드 화자 초상, Hub 버튼 |
| `CREDITS.md` | 출처·라이선스 |

- 배경 720×1280, 초상 약 400×400. 무료 라이선스(CC0 우선)만 쓴다.
- 파일이 없으면 화면은 색 도형으로 대신한다(진행 막지 않음).
