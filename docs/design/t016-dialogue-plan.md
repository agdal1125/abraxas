# T016 — 시나리오를 게임 대사·장면으로 옮기는 계획

2026-11-03 · 계획·디자인: Codex · 구현·커밋 없음

최우선 기준은 `docs/tasks/T016-user-brief-scenario-to-game.md`와 이번 작업 지시다. 이야기 원본은 T015 `docs/story/chapters/00-overview.md`~`11-confession-result.md`, 측정 규칙은 `.agents/rules/game-design-policy.md`와 확정 결정 기록이다. 아래는 감독이 바로 작업 지시로 나눌 수 있는 추천 구현안이다. 질문이나 사람 승인 대기를 추가하지 않는다. 이번 산출물은 이 파일 하나이며 memory/devlog 갱신은 감독에게 인계한다.

## 1. 현재 구조와 실제 빈자리

| 영역 | 확인한 현재 동작 | T016에서 연결할 부분 |
| --- | --- | --- |
| 렌더링 | ADR의 Phaser 표기와 달리 현재 `client/package.json`, `client/src/scenes/village.ts`는 Three.js 0.187 + DOM UI다. `main.ts`는 마을 준비 후 `Game`을 만든다. | 기존 Three.js·DOM 유지. 새 엔진·의존성 없음. |
| ink | `content/ink/{ko,en}/`에 `prologue.ink`, `ep_{lumi,moka,echo,or}.ink`만 있다. `client/scripts/compile-ink.mjs`가 inkjs Compiler로 `client/public/ink/<lang>/*.json`을 생성한다. | 기존 파일 보강, 누락 구간만 추가. 생성 JSON은 직접 편집하지 않는다. |
| 태그·파서 | `Game.advance()`가 `Story.Continue()`, `currentChoices`, `item:`·`pick:` 태그를 읽는다. `panel()`은 `화자: 본문`을 분리한다. 스킬에 적힌 `q:`·대괄호 밖 태그는 현 구현과 다르다. | 실제 계약인 `* [문구 # item:<id> # pick:a]` 사용. 내부 태그는 화면에 출력하지 않는다. |
| i18n | `content.ts`가 `content/i18n/*/*.json`을 eager import. `ui.json`은 공통 UI·이름, `*-errand.json`은 목적·물건·퍼즐·저장 오류·공통 반응, `examine.json`은 살펴보기다. 한국어 문항 원본은 scoring, 영어는 `en/items.json`. | 이야기 본문은 ink, 버튼·이름·입력 안내는 UI, 문항별 반응은 새 `dialogue.json`. scoring 문구를 대사 저장소로 쓰지 않는다. |
| quests | `content/quests/*-errand.json`의 phase·대상·분기·퍼즐·복귀 지점을 TS core와 Go play가 공유한다. fixtures는 명령 재현에 사용한다. | 네 심부름의 phase·target·fixture·선택 순서는 그대로. |
| 서버 회차 | `/v1/plays`, `/current`, `/{playId}`, `/{playId}/commands`. `expectedRevision`·멱등 키·pending 복구 후 snapshot 적용. `receipt.reaction`은 NPC 문항만 `empathy/thinking`, 나머지는 null이다. | 기존 저장 경계를 유지하고 미구현 비측정 엔딩 명령만 추가. |
| 서버 대사 | 프롤로그는 최초 ink, 재개 시 문항 데이터로 빠질 수 있다. 모카는 별도 knot 매핑, 나머지 셋은 `<npc>_<phase>`를 읽는다. 반응은 아직 공통 문장이다. | 프롤로그 포함 재개도 동일한 문항 knot로 진입. 문항별 반응·전환 대사 추가. |
| 로컬 체험 | `abraxas-prototype` 저장을 이어하는 별도 경로. 최초 프롤로그·루미 일부만 ink, 나머지·재개는 scoring/i18n 문항. 3/2/1 문항씩 주민→심부름 주민→귀환으로 나누며 서버 심부름 전체를 실행하지 않는다. | 같은 ink·반응을 읽되 기존 간단한 체험 동선 유지. 서버 저장·보상처럼 표시하지 않는다. |
| 후반부 | 막간 셋은 모두 `lake`, 축제는 `plaza`, 문은 `gate` 상호작용으로 질문만 순서대로 표시한다. `flow.ts`와 Go 모두 `festival → gate → result`. | 장면 도입·후속·데미 행동, 축제 동행자, 문 이후 이름 공개, 고백 대상·이유, 결과 뒤 장면 연결. |
| 결과 | Go는 문 종료 시 Score 검증만 하고 결과를 버린다. UI가 다시 계산한 ‘나’ 설명 한 패널을 표시한다. 동행 보상·고백 판정·3장 카드·별도 첫 결과 저장은 없다. `Store.Create`는 완료 후 새 회차를 `ErrReplay`로 막는다. | 없는 기능을 기존 기능으로 가정하지 않는다. 서버 결과 확정·보존까지 최소 확장하고 초대권/재플레이는 건드리지 않는다. |

`scripts/content-version.mjs`는 양 언어 ink/i18n 파일을 자동 포함한다. 대사만 바꿔도 contentVersion이 달라진다. 현재 불일치 회차를 UI가 막으므로 서버·클라이언트·대사를 같은 버전으로 검수해야 한다.

## 2. 공통 연결 계약

### 대사와 확정 순서

- 측정 knot는 설명과 기존 a/b 선택지만 담고 선택 뒤 `-> END`. 점수·반응을 ink에서 판정하지 않는다. `Game`의 기존 knot 재생 코드를 한 경로로 재사용하고 범용 이벤트 버스나 장면 엔진은 만들지 않는다.
- 공통 구간은 `*_intro → 문항별 knot → *_outro`. 다음 문항은 snapshot의 미응답 ID로 결정한다. 에피소드는 기존 phase가 진입점을 결정한다. 마지막 반응·outro를 읽은 뒤에만 `finish_segment`를 보낸다.
- 새 `content/i18n/{ko,en}/dialogue.json`: `reactions.<itemId>.{speaker,empathy,thinking}`. 38+4 ID 모두 두 문장을 갖고 `speaker`는 `player|lumi|moka|echo|or`. 반응은 문자열, 화면 이름은 `ui`에서 해석한다. 챕터의 공감/생각에 잠김 문장을 여기에 옮긴다. 기존 `ui.reaction`, 심부름별 `reaction`은 미연결 호출을 찾아 모두 전환한 뒤 제거한다.
- 서버: 선택 입력 잠금 → pending 저장 → 명령 확정·snapshot 검증 → 해당 ID와 receipt의 반응 → 다음 단계. 통신 실패·충돌이면 반응을 미리 보이지 않는다. 로컬 NPC는 기존 `npcMatches`를 답 추가 전에 계산하고 저장 성공 후 반응을 표시한다.
- NPC 미관여 14문항과 gate 4문항은 null receipt를 유지한다. 두 문장은 모두 준비하되 실행 시 **항상 thinking**을 쓴다. 점수·선택·데미로 반응을 고르지 않는다. 축제 01~04의 화자는 원본대로 주민이어도 기대 답변은 생기지 않는다. 축제 05·프롤로그·막간·문은 혼잣말이다.
- 반응 표시 중 새로고침하면 저장된 답은 재선택할 수 없다. 연출은 현재 확정 단계부터 재개하며 이미 본 한두 문장의 반복은 허용한다. 로컬 `save()`의 실패 무시를 측정 저장에는 적용하지 않는다. 저장 실패 시 진행을 잠그고 같은 선택 저장을 재시도한다.
- 시네마틱·이름 입력·이름 공개·카드 넘김 같은 표시 상태는 회차 ID별 로컬 표시 상태로만 저장한다. 이를 지워도 서버 답·보상·결과를 되돌릴 수 없다. 언어 변경은 같은 knot를 해당 언어로 다시 읽으며 저장된 선택을 재생성하지 않는다.

### UI 키와 이름

`ui.json`에 아래 키를 추가한다. `<npc>`는 네 주민, `<reason>`은 `similar|drawn|both|unsure`다.

| 키 | 값 또는 역할 |
| --- | --- |
| `names.player`, `names.postman`, `names.dogUnknown`, `names.demi`, `names.village` | 주인공 / You, 우체부 / Mail Carrier, ??? / ???, 데미 / Demi, 도리마을 / Dori Village |
| `nameInput.{prompt,label,confirm,skip,error}` | 우체부 질문 뒤 이름 입력. trim 후 1~12 Unicode 문자, 제어문자·줄바꿈 금지, 빈 값은 기본 호칭. `textContent`로 출력하고 ink 소스에 삽입하지 않는다. 서버로 보내지 않는다. |
| `cinematic.{play,pause,skip,mute,unmute,fallback}` | 재생·일시정지·건너뛰기·소리 조작·짧은 대체 카드 |
| `festival.companion.<npc>` | 네 동행 선택의 동등한 버튼 문구 |
| `confession.{targetPrompt,reasonPrompt}`, `confession.reason.<reason>` | 대상 다음 이유: 나와 닮아서 / 끌려서 / 둘 다 / 잘 모르겠음 |
| `result.cards.{self,other,village}`, `result.reflection.<reason>`, `result.{first,continueEnding}` | 나·그 사람·마을, 이유별 열린 질문, 처음의 나, 마지막 장면으로 |

공개 전 DOM·접근성 이름·HUD·살펴보기는 모두 `???`. 내부 ID `demi`는 화면 이름으로 쓰지 않는다. `demi_reveal`의 목걸이 글자를 읽는 문장에서 처음 데미/Demi를 표시하고 이후 호칭을 바꾼다. 강아지는 말하지 않으며 고백 대상 목록에 넣지 않는다.

## 3. 챕터 → 실제 파일·knot·키 매핑

아래 ink 경로는 모두 `content/ink/{ko,en}/` 기준이며 두 언어의 knot 이름이 같다. `NN`은 명시한 범위만 생성한다. 측정 선택 문구는 한국어 `items.json`, 영어 `en/items.json`과 일치시킨다. 한국어 프롤로그의 현 축약 선택지는 원본 문구로 맞춘다.

| 시나리오 | 파일 / knot | 실행 위치·키·측정 연결 |
| --- | --- | --- |
| 01 알 낙하~핥기 | ink 없음, 영상 자리 | §4. 영상 이후 게임 진입점은 하나 |
| 01 따라 걷기 | `prologue.ink` / `demi_follow` | 기존 spawn 근처 짧은 길에서 앞서 걷기·돌아보기. `names.dogUnknown` |
| 02 우체부·출신·이름 | `prologue.ink` / `postman_intro`, `postman_named` | 두 knot 사이 `nameInput` 폼. 출신은 고정 대답, 문항 태그 없음 |
| 02 챕터 0 | `prologue.ink` / `prologue_01`, `prologue_02`, `prologue_03`, `prologue_outro` | 같은 ID 3개. 길 선택은 대사·짧은 시점 전환으로 표현; 새 갈림길 맵은 만들지 않음 |
| 03 광장 | 새 `hub.ink` / `hub_intro`, `hub_return` | 첫 진입 네 사람 인사, 이후 짧은 복귀. 자유 방문·기존 A/B/C/D 목표 유지 |
| 04 루미 | `ep_lumi.ink` / `lumi_choose_01`~`06`, 기존 모든 `lumi_<phase>`·분기 knot | `lumi_01`~`06`; `lumi-errand.json`의 objective/items/puzzle 키 유지 |
| 05 모카 | `ep_moka.ink` / `moka_meet`, `moka_reservation`, `moka_choose_display`, `moka_share`, `moka_order`, `moka_feedback` | 순서대로 `moka_01`~`06`. 기존 행동·`moka_completed` knot 유지 |
| 06 에코 | `ep_echo.ink` / `echo_choose_01`~`06`, 기존 `echo_<phase>` | `echo_01`~`06`; `echo_reading`에 두 자매 이야기를 짧은 카드로 분할 |
| 07 오르 | `ep_or.ink` / `or_choose_01`~`06`, 기존 `or_<phase>`·`_<a|b>` | `or_01`~`06`; 도면·종 운반·보고 위치 분기 유지 |
| 08 막간 1 | 새 `interlude_1.ink` / `interlude_1_intro`, `interlude_1_01`, `interlude_1_02`, `interlude_1_outro` | 첫 에피소드 뒤. 수첩·수레는 서술과 기존 광장 시점으로 표현 |
| 08 막간 2 | 새 `interlude_2.ink` / `interlude_2_intro`, `interlude_2_01`, `interlude_2_02`, `interlude_2_outro_a`, `interlude_2_outro_b` | 둘째 뒤. 마지막 선택에 맞는 상자 후속 묘사. 열쇠 손실·새 인벤토리 없음 |
| 08 막간 3 | 새 `interlude_3.ink` / `interlude_3_intro`, `interlude_3_01`, `interlude_3_02`, `interlude_3_outro` | 셋째 뒤. 노을·구슬, 데미가 같은 하늘을 봄 |
| 09 축제 | 새 `festival.ink` / `festival_intro`, `festival_01`~`05`, `festival_lights`, `festival_companion_intro`, `festival_companion_<npc>`, `festival_outro` | 04 확정·반응 뒤 간단한 연결판, 이어 05. 마지막에 `festival.companion` UI 및 서버 비측정 명령 |
| 10 기억의 문 | 새 `gate.ink` / `gate_intro`, `gate_a`, `gate_b`, `gate_c`, `gate_d`, `gate_outro` | 반드시 a→b→c→d 모두. 문 앞 데미 정지. 마지막 조각 연출 |
| 11 이름 공개 | 새 `confession.ink` / `demi_reveal` | gate 완료 후, 대상 선택 전에 목걸이 글자·네 문장. 로컬 공개 플래그는 이 장면 이후에만 |
| 11 고백·이유 | `confession.ink` / `confession_intro`, `confession_send`, `confession_<npc>_<accepted|waiting>` | 대상 → 네 이유 버튼 → 비측정 `confess` → 서버 판정에 맞는 해당 주민 두 줄만 |
| 11 알·카드·마지막 길 | 새 `ending.ink` / `ending_shell`, `ending_cards`, `ending_walk` | 알이 열리는 짧은 DOM/CSS 연출 → 카드 3장·고지 → 계속 버튼 → 데미가 앞서 걷다 돌아봄 → 종료/결과 돌아가기 |

### 기존 심부름과 충돌할 때의 결정

| 차이 | 따를 쪽과 이유 |
| --- | --- |
| 모카: 챕터는 배달 직후 빵집 귀환을 서술하지만 현재 `deliver → reservation(v1j2) → reservation_action → choose_display`다. 별도 `return`은 반죽 준비 뒤다. | quests 유지. 배달 인사 뒤 ‘빵집 앞 손님에게 가자’로 연결하고 모카 대사는 그 자리의 대화로 처리. 새 귀환 phase를 끼우지 않는다. |
| 루미: 챕터는 환영 후 바로 악보를 보지만 현재 `welcome → return → choose_06`다. | 루미에게 돌아와 악보를 보는 연결 문장으로 보완. 기존 안내 도구 회수·재료 전달도 삭제하지 않는다. |
| 에코: 그림책 전달 대상, 다락 접근, 책 읽기 | 기존 `echo-borrower`, 바깥 다락 입구, `reading → choose_05` 유지. 실내 맵·새 주민을 만들지 않는다. |
| 오르: 시계탑 톱니와 등불 도면, 마지막 보고 위치 | 서로 다른 작업 유지. `or_06=a`는 연장 정리 후 대장간, b는 종 배달 후 광장 보고. 대사도 현재 `_a/_b` knot로 분리한다. |
| 막간의 장소 | 현재 `lake` 목표를 유지하고 수첩·벤치·구슬은 그 주변에서 보는 장면으로 압축. 광장 수레는 회상/바라보기로 연결. 새 이동 목표 3개를 추가하지 않는다. |
| 문: 10장/구 scenario는 조건부 질문, overview/확정 결정/코드는 전부 질문 | 네 질문 모두 표시. 적용 전 경계 판정 등 scoring 코드를 수정하지 않는다. |
| 고백 이유가 11장에 없음 | 요청과 기존 `scenario.md`의 네 이유를 반드시 보완. 성향·호감도 계산 입력에는 넣지 않는다. |
| 사전 암시가 될 수 있는 농담·칭찬 | 정책 우선. `moka_06` 직전 ‘향이 참 고소하지?’는 삭제 또는 행동 장면으로 이동. 축제 예산/공연안에 특정 NPC의 선호를 붙이지 않는다. 오르 반응의 반복 ‘오.’도 무감탄 짧은 문장으로 다듬는다. |

기억 조각은 프롤로그 1·에피소드별 2·축제 2·문 1의 기존 기획을 장면으로 보여 준다. 획득은 완료 상태에서 도출하고 선택별 차등·새 수집 명령은 만들지 않는다. 공통 구간에서 이야기 대사를 데이터 fallback으로 조용히 대체하지 말고, 불러오기 실패 시 재시도 UI를 보여 준다.

## 4. 시네마틱과 데미의 최소 구현

### 영상 자리

- 납품 경로 규칙: `client/public/cinematics/prelude-v1.mp4`; 화면 문자가 들어간 영상이면 대신 `prelude-v1-ko.mp4`, `prelude-v1-en.mp4`. 초기 구현은 언어 공용·음성 없이 이해되는 한 파일을 기준으로 한다. 자막이 필요하면 같은 접두의 `.ko.vtt`, `.en.vtt`를 함께 납품한다. 파일 제작·샘플 영상 추가는 이번 범위가 아니다.
- 영상 재생 모듈만 지연 import. 새 회차의 시작 탭 뒤 표시하고 그때만 `src`를 지정한다. `muted`, `playsinline`, `preload="none"`, 일시정지/재생·음소거·항상 보이는 건너뛰기 버튼을 둔다. 시작 API 대기 때문에 사용자 활성화가 사라질 수 있으므로 `play()` 거부 시 ‘재생’ 탭을 다시 받는다. 자동재생 성공을 전제하지 않는다. [MDN 자동재생 정책](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [play() 반환 Promise](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play).
- 파일 없음·HTML fallback·디코드 오류·10초간 시작 불가면 `cinematic.fallback` 1~2장: ‘풀밭에서 눈을 떴다. 작은 흰 강아지가 곁에 있다.’ → 계속. 사용자는 기다리는 동안에도 건너뛸 수 있다. `ended/error/skip` 중 먼저 끝난 하나만 `demi_follow`로 연결한다. 측정 답이나 서버 segment를 바꾸지 않는다.
- 재개 회차에는 재생하지 않는다. 답이 없는 회차는 회차별 `introSeen`으로 중복을 줄이며 로컬 표시 기록 유실 시 재생은 허용한다. 영상 종료 시 pause·src 해제·리스너 정리. OS 동작 줄이기는 대체 카드부터 표시한다.
- 첫 화면에서 영상 요청 **0건**, 타이틀 진입을 영상이 막지 않음. 첫 화면 5초·초기 전송 10MiB 목표와 비교하되 장치·네트워크·기준 커밋을 기록한다. 기존 `check:size`는 초기 전송이 아니라 **dist 전체 10MiB** 검사다. 영상 납품 시 이 검사도 걸리므로 첫 화면 실측과 전체 용량을 따로 보고하고 임계치를 몰래 높이지 않는다. 현재는 파일이 없어서 영상 바이트 증가 0이다.

### 월드 존재와 행동

현재 캐릭터는 Blender `build_characters.py` → Draco GLB → manifest → `Village.character()`의 clone/AnimationMixer 경로다. 데미에는 새 리깅·GLB·디코딩을 추가하지 않고 Three.js 구/타원체를 조합한 흰 몸·늘어진 귀·짧은 네 다리·검은 코·작은 꼬리·목걸이로 만든다. 주인공 키 약 0.58m 대비 데미 약 0.23m, 무광 재질, 텍스처·털 셰이더 없음. 화면상 강아지 실루엣이 확인되지 않으면 감독 검수 후 GLB 후속 작업으로 넘긴다.

- `client/src/scenes/demi.ts` 한 파일이 메시와 걷기/앉기 변형을 소유. `village.ts`가 만들고 tick에서 갱신한다. 충돌·물건 운반·상호작용 대상이 아니어서 기존 탭과 길을 막지 않는다.
- 보통은 주인공이 실제 지나온 위치를 짧게 기록해 뒤따른다. 직선 추적으로 벽을 가로지르지 않는다. 복귀/텔레포트 시 기록을 비우고 플레이어 근처의 유효 바닥에 재배치한다. 별도 AI·데미용 길찾기는 만들지 않는다.
- 도입·마지막 길에서만 기존 walkable/findPath/followPath로 짧은 고정 경로를 앞서 걷고 돌아본다. 플레이어가 멈추면 기다린다. 조작 불가 환경에는 ‘함께 걷기’ 버튼으로 같은 경로를 진행한다. 막히면 같은 목적지의 짧은 대사로 이어지며 회차가 멈추지 않는다.
- 일반 탐색은 따라가기, 대화는 발치 앉기, 문 앞은 고정 위치에서 기다리기. 광장 장난·수첩 발도장·재채기·빛 속 오가기는 ink 서술과 한 번의 몸/꼬리 움직임으로 표현한다. 소품 접촉·전용 애니메이션은 만들지 않는다.
- `Village.setDemiMode(mode)` 계약: `hidden|follow|lead|sit|gate|ending`. `lead`는 도입, `ending`은 결과 뒤만 가능. `Game`이 **질문 설명을 시작하기 전부터 저장·반응 종료까지** `sit`(문은 `gate`)으로 고정한다. 선택 방향·현재 극·호감도를 월드 API에 넘기지 않는다. 모든 a/b에서 위치·시선·꼬리·색이 같다.
- `Village.setStoryScene(scene)` 계약: `entrance|hub|interlude|festival|gate|confession|ending`. 기존 장소·카메라·주민 배치만 제어한다. 우체부는 기존 `quest-npc` GLB 복제와 작은 가방 메시로 도입에만 등장한다. 새 퀘스트 NPC ID와 충돌을 섞지 않는다.
- 하얀 주인공은 현 GLB의 베이지 정점색 때문에 material 색만 곱해서는 구현되지 않는다. 플레이어 clone에만 정점색 버퍼를 복제·중립 흰색으로 바꾸고 NPC 공유 재질/geometry는 건드리지 않는다. 선택 뒤 빛은 모든 선택에 동일한 짧은 중립 빛만 사용한다.
- 결과의 알은 DOM/CSS 타원 두 조각으로 충분하다. 현 코드에는 유형별 결과색 표가 없으므로 임의의 16색 매핑은 만들지 않는다. 우선 동일한 부드러운 빛과 기존 결과 문구로 표현한다.

## 5. 후반부 서버 계약 — 없는 판정만 연결

측정·심부름 판정과 42답은 그대로 두고 기존 commands 엔드포인트를 확장한다. 새로운 엔드포인트·이벤트 시스템·클라이언트 보상은 필요 없다.

| 계약 | 추가 내용과 신뢰 경계 |
| --- | --- |
| `festival_companion` | command `{kind:"festival_companion", npcId}`. 축제 5답 이후, 네 주민 중 한 명, 회차당 한 번. snapshot `festivalCompanion: npcId|null`. 완료 전 `finish_segment` 거부. `Doc.Events["festival-companion-selected"]`로 중복 보상 방지. |
| `confession` segment | gate 네 답·outro 종료의 `finish_segment`가 `confession`으로 이동. 여기서 `demi_reveal` 후 대상·이유를 고른다. 기존 `result`로 즉시 이동하던 TS/Go 흐름·허용 segment 목록을 함께 변경한다. |
| `confess` | command `{kind:"confess", npcId, reason}`. reason은 `similar|drawn|both|unsure`. 네 주민만 허용, 축제 동행자와 달라도 됨. 선택 뒤 입력 잠금·기존 멱등 재시도. `answers`에는 추가하지 않는다. |
| 결과 확정 | 기존 Go `Score`에 저장된 42답과 완료 심부름을 넣는다. 공동 이벤트는 선택한 한 사람에게 정책의 +10을 한 번 더하고 기존 상한으로 clamp, 고백 성공은 정책의 60 이상. 이유는 판정에 쓰지 않는다. 이 두 규칙은 정책에는 있지만 현재 코드에는 없다. 확정 결정대로 수치는 코드에 넣지 않고 `content/scoring/rules.json`에 `festivalAffinityGain: 10`, `confessionThreshold: 60`만 추가한다. 기존 정책을 데이터로 옮기는 것이며 기존 수치·가중치·Score 계산은 변경하지 않는다. |
| snapshot 응답 | `confession: {npcId,reason,outcome:"accepted"|"waiting"}|null`, `result: {type,modifier,npcTypes:Record<npcId,string>}|null`. 결과 숫자·affinity를 플레이 중 응답에 추가하지 않는다. 결과는 confess 확정 후에만 존재. `receipt.reaction`은 두 새 명령 모두 null. |
| 저장 | confess 트랜잭션에서 결과와 `Doc.FirstResult`를 처음 한 번 저장하고 segment를 `result`로 전환. 재시도·다른 탭은 같은 판정이며 덮어쓰지 않는다. 현재 서버는 1회차만 허용하므로 그 회차의 별도 FirstResult가 ‘처음의 나’다. 미래 재플레이의 사용자별 첫 결과 참조 설계는 이번에 확장하지 않는다. |

`client/src/core/play.ts`·`net/plays.ts`·HTTP command 필드 허용 목록·저장 직렬화/복구 테스트가 같은 계약을 사용한다. 점수·outcome·result를 클라이언트 명령으로 보내면 거부한다. 기존 revision, 소유자 인증, contentVersion, pending 정리, 원자적 저장을 유지한다. 완료 서버 결과를 클라이언트 `score()`로 재판정하지 않는다.

로컬 체험은 같은 대상·이유·장면을 로컬 저장하고 기존 TS score에 정책의 동행 보상·고백 기준만 동일하게 적용한다. 서버 결과·첫 결과 저장으로 표시하지 않는다. 네 에피소드 심부름을 완료하지 않은 구형 로컬 체험을 서버 완료로 승격하지 않는다.

카드는 `나`: 현재 결과 설명, `그 사람`: 대상·서버 outcome·주축 글자 비교로 얻은 일상어 공통점/차이·이유별 질문, `마을`: 함께한 네 작업과 축제 동행자를 순서대로 표시한다. 내부 글자·숫자는 렌더하지 않는다. 현 `ui.result.poles`, modifier, 고지를 재사용하며 임의 유형명·점수 해설을 만들지 않는다. 고백 응답·알·카드를 본 뒤 `ending_walk`; 서버가 result라고 바로 하네스를 끝내면 안 된다.

## 6. 병렬 작업 패키지 6개

이번 지시의 담당 모델을 오래된 delegation 표보다 우선한다. 글은 agy `gemini-3.8-flash-high`, 코드·테스트는 Codex `gpt-6.1-terra`. 각각 별도 worktree·후속 PR 단위, 구현자는 커밋하지 않고 감독이 검수·병합한다. 아래 소유권 외 파일 수정은 감독이 재배정하며 같은 파일을 동시에 편집하지 않는다. 생성물은 각 worktree의 `client/public/ink`, `client/dist`, `.e2e`에만 생성하고 커밋하지 않는다.

검사 명령은 **각 패키지 worktree 루트**에서 한 문자열씩 실행한다. `&&`로 묶지 않는다. P6가 추가할 `check-dialogue.mjs`는 명시적으로 신규 검사이며, 기존에 없는 `content:check` 명령을 가정하지 않는다.

### P1 — 양 언어 대사·번역

- 담당: agy `gemini-3.8-flash-high`.
- 독점 쓰기: `content/ink/ko/`, `content/ink/en/`, `content/i18n/ko/`, `content/i18n/en/`. quests/scoring/world는 읽기만.
- 계약: §2~3 knot·키·태그. 기존 phase knot 모두 유지, 공통 새 knot와 42개 반응쌍 추가. 루미 `local_story` 연속 실행은 제거하고 다른 에피소드처럼 문항별 종료로 통일한다. 영어 선택지는 기존 `en/items.json`을 유지하고 새 서술로 맥락을 보충한다.
- 완료: 모든 장면 ko/en, 누락 반응 0, 원문 특유의 인물 대사 보존, 사전 암시 제거, 선택 태그/의미/순서 변경 0. 새 주인공 호칭은 `주인공:`/`You:`로 작성하고 입력 이름 치환은 UI가 맡는다.
- 검사: `npm --prefix client run ink`; `node client/scripts/check-visible-names.mjs`; `node client/scripts/check-moka-ink.mjs`; `node client/scripts/check-residents-ink.mjs`; P6 통합 후 `node client/scripts/check-dialogue.mjs`.
- 의존: 지금 시작 가능. 루미 로컬 연결을 제거하면 기존 주민 검사 마지막 local-story 검증이 실패하므로 P6 수정본 통합 후 최종 통과시킨다. 실패를 숨기지 않는다.

### P2 — 대사 소비·UI·로컬 체험·엔딩

- 담당: Codex `gpt-6.1-terra`, effort `high`.
- 독점 쓰기: `client/src/ui/` 안의 `game.ts`, `game.test.ts`, `hud.ts`, `hud.test.ts`, `hud.css`; `client/src/content.ts`, `client/src/core/flow.ts`, `client/src/core/flow.test.ts`, `client/src/style.css`. 필요 시 ui 디렉터리의 신규 `ending.ts`, `ending.test.ts`, `ending.css`만 허용. P5 파일은 제외.
- 계약: P1 knot·키, P3 snapshot/commands, P4 두 Village 메서드, P5 영상 함수. `content.ts`에 dialogue 번역 타입/읽기 연결. 공통 knot 재생으로 서버·로컬·재개를 통일하고 gate 태그 검증은 `data.tiebreakers`도 허용한다.
- 완료: 도입→이름→전체 장면→고백 이유→세 카드→마지막 길. 기존 심부름 보드·저장 오류·토큰 기반 중복 클릭 방지 유지. 로컬은 현 3/2/1 흐름에서 해당 문항 knot와 필요한 연결 서술을 읽으며 서버 행동을 완료했다고 주장하지 않는다. 새 선택·반응·다음 버튼 키보드/터치 가능. 이름 입력 12자·기본 이름·언어 변경, 저장 실패와 재개 회귀 검증.
- 검사: `npm --prefix client run typecheck`; `npm --prefix client test`; `npm --prefix client run build`.
- 의존: P1/P3/P4/P5의 이 문서 계약으로 개발, 통합 테스트는 네 패키지 수신 뒤. contract 미도착을 이유로 제품 fallback 가짜 판정은 넣지 않는다.

### P3 — 후반부 서버 권위·전송 타입

- 담당: Codex `gpt-6.1-terra`, effort `high`.
- 독점 쓰기: `server/internal/play/`의 play.go/play_test.go 및 신규 ending.go/ending_test.go, `server/internal/http/`의 play.go/play_test.go, `server/internal/store/`의 기존 저장·테스트 파일; `client/src/core/play.ts`, `client/src/net/plays.ts`, `plays.test.ts`. 추가로 `content/scoring/rules.json`의 위 두 키와 TS `client/src/core/scoring/index.ts`·Go `server/internal/scoring/scoring.go`의 규칙 타입/읽기만 담당한다. 이에 따른 scoring 테스트의 규칙 fixture 타입 보완은 허용하되 기대 결과·계산식·golden·quests는 바꾸지 않는다.
- 계약: §5. 저장소가 Doc 전체를 JSON으로 저장하는 기존 구조 재사용. 새로운 필드가 없는 이전 문서는 null로 읽되 contentVersion 보호를 유지한다. 유효성 검사는 임의 outcome·reason·추가 필드를 받아들이지 않는다.
- 완료: 42답 불변, 동행 +10 1회, 59/60 경계·상한·다른 고백 대상·이유 무관 판정, 조기 명령 거부, 중복/응답 유실/동시 탭/재시도에서 결과·FirstResult 불변. auth·revision 오류 후에도 기존 저장 유지. `confession` 동안에는 result 미노출.
- 검사: `go -C server vet ./...`; `go -C server test ./...`; `go -C server run golang.org/x/vuln/cmd/govulncheck@latest ./...`; `npm --prefix client run typecheck`; `npm --prefix client test`.
- 의존: 현재 데이터로 단독 시작 가능. P2와 독립 파일이며 command/snapshot 계약부터 확정해 전달한다.

### P4 — 데미·우체부·월드 장면

- 담당: Codex `gpt-6.1-terra`, effort `medium`.
- 독점 쓰기: `client/src/scenes/village.ts`, `village.test.ts`, 신규 `demi.ts`, `demi.test.ts`. assets/manifest/world JSON/캐릭터 GLB는 수정하지 않는다.
- 계약: §4 `setDemiMode`, `setStoryScene`. 새 DOM 이벤트 없음. `onInteract` 기존 동작 유지. follow 기록은 월드 좌표만 받으며 문항/점수 데이터를 알지 못한다.
- 완료: 도입 lead·탐색 follow·대화 sit·gate stop·마지막 lead/look-back. 선택 화면 전후 자세 동일, 장애물 관통·탭 가로채기·NPC 공유 재질 변색 없음. 우체부는 기존 GLB 복제, 전체 NPC 이동은 장면 종료 시 복원.
- 검사: `npm --prefix client run typecheck`; `npm --prefix client test -- src/scenes/village.test.ts src/scenes/demi.test.ts`; `npm --prefix client run build`.
- 의존: 단독 제작/테스트 가능, 실제 게임 크기·터치·화면 캡처는 P2 연결 후 P6와 확인.

### P5 — 영상 슬롯

- 담당: Codex `gpt-6.1-terra`, effort `medium`.
- 독점 쓰기: 신규 `client/src/ui/cinematic.ts`, `cinematic.test.ts`, `cinematic.css`만. 영상 파일 제작·배치는 하지 않는다.
- 계약: `playPrelude(host: HTMLElement, lang: "ko"|"en", copy: {play:string;pause:string;skip:string;mute:string;unmute:string;fallback:string}): Promise<void>`. 종료·skip·fallback의 계속으로 한 번만 resolve, 이벤트 정리 후 반환. P2가 회차·표시 상태와 진입점 관리.
- 완료: §4 영상 정책, 소리/재생/건너뛰기 키보드 접근, 실패해도 데미 이후로 진행. 허용 안 된 자동재생은 버튼으로 복구. 가짜 파일이나 외부 URL 없음.
- 검사: `npm --prefix client run typecheck`; `npm --prefix client test -- src/ui/cinematic.test.ts`; `npm --prefix client run build`.
- 의존: 단독 구현 가능. P2 통합 뒤 타이틀 영상 요청 0건·복귀 검증. 실제 영상 재생 검증은 납품 후 추가하며 누락 상태 검증과 구분한다.

### P6 — 콘텐츠 검사·E2E·용량 검증

- 담당: Codex `gpt-6.1-terra`, effort `high`.
- 독점 쓰기: `client/scripts/compile-ink.mjs`, `check-visible-names.mjs`, `check-moka-ink.mjs`, `check-residents-ink.mjs`, `perf-mobile.mjs`, 신규 `check-dialogue.mjs`; `scripts/e2e-play.mjs`, `e2e-play.test.mjs`. package.json·CI는 바꾸지 않고 직접 실행 명령으로 검수한다.
- 계약: §2~5의 이름·knot·키·snapshot. 신규 검사에는 정상/누락/중복 태그·금지 텍스트·문자수 경계의 작은 assert self-check를 포함한다. 기존 모카 knot 목록은 그대로, 루미 연속 로컬 검사는 문항별 진입 검사로 변경한다.
- 완료: §7 검증 증거. `e2e:play`는 이름 입력/시네마틱 대체/동행/고백/세 카드/마지막 길까지 진행한다. 단순 `segment === result` 종료를 없애고 DOM `data-scene="ending-done"` 확인까지 진행한다(P2가 표시). 질문과 비측정 버튼을 `data-item-id`/`data-action`으로 구분하되 실제 UI 입력 잠금은 우회하지 않는다.
- 검사: 아래 §7의 명령 전체. E2E가 생성하는 `.e2e/`만 증거 출력. 예상된 영상 404는 정확한 영상 URL만 예외로 검증하고 다른 네트워크 오류를 무시하지 않는다.
- 의존: 검사 골격은 병렬 시작, 실제 전체 실행은 P1~P5 통합 후. 한 worktree에서 빌드/서버/E2E 실행을 겹치지 않는다.

추천 통합 순서: P3·P4·P5와 P1/P6 검사 계약 준비 → P1+P6 콘텐츠 검사 통과 → P2 통합 → P6 양 언어·서버·브라우저 검수 → 감독 결정/교훈/memory/devlog 일괄 반영. 패키지 간 수정 요청은 소유자에게 전달한다.

## 7. 영어 기준과 검증

### 번역·문자 길이

- 따뜻하고 짧은 일상 영어, 성별을 단정하지 않는다. Lumi는 짧은 초대형 표현과 느낌표, Moka는 온화한 축약형, Echo는 관찰·확인 중심, Or는 대체로 2~6단어·최대 10단어의 짧은 발화와 마침표. 우체부는 가벼운 한 문장 농담 뒤 안심시키는 말. Demi는 발화 0줄.
- 표기: Lumi / Moka / Echo / Or / Demi / Dori Village / Mail Carrier / ???. 기존 Stagehand / Tasting Guide / Book Keeper / Workshop Apprentice는 유지한다. 성향을 설명하는 용어를 인물 대사에 덧붙이지 않는다.
- 한 화면 일반 대사 본문은 **영어 80자(공백·문장부호 포함, 화자 제외)**를 2줄 작성 상한으로 삼는다. 한국어는 44자. 이것은 폭 보장이 아니므로 실제 줄 수도 확인한다. 긴 서술은 의미 단위로 다음 카드에 나눈다. 측정 선택지는 의미 보존 우선이며 기존 번역을 길이 때문에 자르지 않는다.
- 문자수 검사는 전체 서술/반응/선택지를 보고한다. 일반 대사·반응 초과는 실패, 기존 측정 선택지 초과는 ID·길이를 별도 보고하고 감독이 2줄 실화면으로 판정한다. 버튼 CSS 줄임표·강제 잘림 금지. 영어/한국어 모두 15px·18px, 지원 최소 가로 화면에서 2줄 목표를 검수하고 큰 글자에서 추가 줄이 필요하면 접근성과 전체 노출을 우선한다.
- 에피소드 약 40줄 목표는 **한 실제 경로에서 표시되는 발화** 기준. 두 반응 후보를 합산하지 않는다. 기능 안내 중복은 UI로 옮기되 T015 장면 연결·측정 전 맥락을 생략하지 않는다.

### 검사 명령과 통과 기준

다음은 구현 후 실행할 명령이다. 이 계획 작성 단계에서 실행해 통과했다는 뜻이 아니다. npm은 worktree 루트, Go도 `-C server`로 통일한다.

```text
npm --prefix client run ink
node client/scripts/check-visible-names.mjs
node client/scripts/check-moka-ink.mjs
node client/scripts/check-residents-ink.mjs
node client/scripts/check-dialogue.mjs
npm run check:scoring
npm --prefix client run typecheck
npm --prefix client test
npm --prefix client run build
npm --prefix client run check:size
node --test scripts/content-version.test.mjs scripts/e2e-play.test.mjs
go -C server vet ./...
go -C server test ./...
go -C server run golang.org/x/vuln/cmd/govulncheck@latest ./...
npm run e2e:play -- ko .e2e/t016-ko-a a-auto
npm run e2e:play -- en .e2e/t016-en-a a-auto
npm run e2e:play -- ko .e2e/t016-ko-b b-manual
npm run e2e:play -- en .e2e/t016-en-b b-manual
npm run e2e:play -- ko .e2e/t016-ko-resume resume
npm run e2e:play -- en .e2e/t016-en-resume resume
npm run e2e:play -- --emulators ko .e2e/t016-ko-emulator resume
npm run e2e:play -- --emulators en .e2e/t016-en-emulator resume
```

- ink: 양 언어 모든 knot의 컴파일·실행 시 태그를 검사한다. 일반 38 ID + 별도 4 ID가 언어별로 각각 한 선택쌍만 있고 a/b 순서가 같아야 한다. ko 선택 문구는 scoring 원문, en은 번역 원문과 일치. stray 태그·잘못된 위치·누락 knot·반응쌍 누락 0.
- 이름 검사: 현 `check-visible-names`는 금지 코드 정규식 검사이며 화자 허용 목록이 없다. 신규 명시 목록에 기존 화자와 주인공/You·우체부/Mail Carrier·???·데미/Demi를 넣고 지명 허용에 도리마을/Dori Village를 추가한다. `???`는 미공개 이름 값과 해당 지문에서만 허용한다. 파일 전체에 `??`가 있다고 일괄 면제하지 않는다. U+FFFD·깨진 한글·그 밖의 연속 물음표는 실패한다. 공개 시점 검사는 정적 검색이 아니라 재개 포함 UI 테스트로 한다.
- E2E: 42답·각 심부름 6답·선택순서·핵심 퍼즐/포인터 회귀를 유지. 이름 공개 전후·공통 6구간·축제 보상·대상/이유·결과 카드·마지막 장면 캡처. 새 명령 전/후 및 응답 유실 후 재개에서 확정 답·판정·첫 결과가 같아야 한다. a/b 시나리오의 측정 선택과 고백 이유 버튼을 혼동하지 않는다.
- 서버 저장은 memory 테스트만으로 충분하지 않다. `--emulators`에서 기존 Auth/Firestore 경로로 신규 필드 저장·불러오기·멱등 처리 검증. 실행 도구·네트워크가 없으면 미실행과 이유를 기록한다.
- 첫 화면: 위 build 뒤 별도 프로세스에서 `npm --prefix client run preview -- --host 127.0.0.1 --port 4173`, 이후 `node client/scripts/perf-mobile.mjs 4173`. 기존 스크립트는 Windows Edge 경로와 월드 도달 자동 클릭을 전제로 하므로 P6가 타이틀까지/도입 뒤 조작 가능까지의 전송량·시간을 나눠 기록하고 영상 요청도 추적한다. 이 도구를 iOS 실기기 측정이라고 보고하지 않는다.
- 기준 브랜치와 같은 캐시·압축·뷰포트·네트워크에서 첫 화면 요청/바이트·JS gzip 증가·마을 준비시간을 비교한다. 영상 없는 경로와 실제 영상 납품 후 경로를 분리한다. iOS Safari/Android Chrome에서 탭 후 재생·소리·inline·skip·회전·작은 화면을 별도 확인한다.

## 8. 측정 무결성 점검표

- [ ] 일반 문항 38, 타이브레이커 4; 주축별 8·보조축 6·NPC 미관여 14 유지.
- [ ] scoring items/npcs·golden과 rules의 기존 값 불변. rules는 이미 정책에 있는 동행/고백 두 키 추가만 허용. 일반 가중치·타이브레이커·NPC 반응 계산 그대로.
- [ ] 문항 ID·a/b 의미·순서·역균형 유지. 에피소드 순서만 기존 자유 선택.
- [ ] gate 네 문항 모두 표시, 적용 전 경계 판정과 기존 Score 결과 불변.
- [ ] 선택 잠금·저장 확정 후 반응, 뒤로/새로고침/다중 탭으로 선택 변경 불가.
- [ ] 반응은 공감/생각에 잠김 두 종류만. 공통 구간에 기대 답변·별도 점수 추가 없음.
- [ ] 측정 설명·선택·저장·반응 동안 데미 방향/시선/꼬리/색 불변, NPC 선호 사전 암시 없음.
- [ ] 하트는 기존 에피소드 종료 때만 묶어 표시. 측정 즉시 하트·물음표 버블 없음.
- [ ] 퍼즐 성공·자동완성·소요시간·이름·방문 순서·동행·고백 대상/이유를 성향 측정에 넣지 않음.
- [ ] 동행 +10·고백 60은 이미 정해진 정책을 서버에 연결, 수치 재설계 없음. 저장·결과·첫 결과는 서버 소유.
- [ ] 플레이 중 축 코드·유형 코드·성향 수치·호감도 숫자·금지 상표명 비노출. 결과에도 내부 코드는 문장으로 변환.

## 9. 위험·제외·감독 결정 필요

| 위험 / 감독 결정 필요 | 추천안 |
| --- | --- |
| 후반부가 단순 대사 교체보다 큼 | P3를 필수 패키지로 진행. 클라이언트만으로 동행 보상·고백 성공을 임시 확정하지 않는다. |
| 기존 진행 회차 contentVersion 불일치 | 자동 초기화·기존 답 삭제 금지. T016은 새 회차로 검수하고 기존 버전 회차의 종료/호환 배포 방침은 감독이 기록. 과거 결과를 새 내용으로 재계산하지 않는다. |
| gate 원문 충돌 | 네 문항 항상 표시를 채택. 감독이 원본 10장/구 scenario의 오래된 조건부 설명을 별도 정리. |
| 원본에 없는 고백 이유·결과색 매핑 | 네 이유는 기존 scenario대로 보완. 유형별 색은 보류하고 중립 빛을 사용. 임의 점수·유형색을 만들지 않는다. |
| 서술을 실제 동작으로 옮길 범위 | 기존 심부름은 실제 행동 유지. 새 막간 소품은 대사로, 축제 연결판은 표시된 인접 등불을 잇는 작은 DOM 작업판(힌트/자동완성, 서버 점수 없음)으로 구현. 새 맵/물리 퍼즐 없음. |
| 데미 외형 품질 | 절차적 메시로 먼저 통합·게임 크기 검수. 실루엣 부적합 시에만 후속 agy Blender GLB 제작을 별도 배정. |
| 영상 납품과 전체 dist 상한 | 공용 무음 MP4 추천. 납품 전에는 대체 카드로 완료 가능하되 실제 재생·용량 검증은 미완료로 기록. 영상 제외로 전체 용량 검사를 우회하지 않는다. |
| 영어 두 줄과 측정 의미 | 일반 대사는 분할. 선택지는 원문 의미 보존 후 실제 폭 검사. 두 줄을 맞추려고 측정 선택의 조건·위험/기회를 삭제하지 않는다. |

하지 않을 것: 영상 자체 제작, 범용 시네마틱/이벤트 엔진, 신규 외부 의존성, 실내 맵·새 이동 시스템, 데미 전투/상호작용/수집, 털·물리 리깅, 측정 수치·문항 변경, 새 결과 유형명, 초대권·광고·재플레이 구현, 비밀값·배포·Firestore 규칙 변경. 기존 네 심부름은 다시 설계하지 않는다.

이번 계획에서 실행하지 않은 것: 제품 코드 수정, 게임 테스트·빌드·실기기 측정, 커밋. 구현 완료 보고에는 실제 실행한 검사와 미실행 항목을 분리하고, 감독이 공유 결정·memory·devlog를 한 번에 갱신한다.

## 10. 감독 결정 (Claude, 2026-11-03)

사람이 질문 없이 진행하라고 지시했으므로 §9의 추천안을 모두 채택한다.

- P3는 필수다. 동행 보상 +10과 고백 기준 60은 정책(`game-design-policy.md`)에 이미 있는 값이다. `rules.json`에 옮겨 서버에 연결하는 것이며 수치 변경이 아니다.
- 기억의 문 질문은 네 개를 항상 모두 묻는다. 결과색 매핑은 보류하고 중립 빛을 쓴다. 데미는 절차적 메시로 먼저 만든다.
- contentVersion이 바뀌면 기존 진행 회차는 이어지지 않는다. 아직 배포 전이므로 새 회차로 검수한다.
- 담당: P1은 agy `gemini-3.8-flash-high`(Argon4가 429 한도라서 쓰는 agy 대체 모델), P2~P6은 Codex `gpt-6.1-terra`.
- 실행 순서: P1·P3·P4·P5·P6을 동시에 시작한다. P2는 다섯 패키지를 통합 브랜치에 합친 뒤 시작한다. 모든 계약 소비가 P2에 모이므로 추측 구현을 줄이기 위해서다.
