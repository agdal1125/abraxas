# T017-A2 나머지 인물 다듬기 (CP-A2)

담당: agy 한도(429)로 Codex `gpt-6.1-terra`가 대체. 검수: Claude. 커밋·push 금지. 먼저 읽을 것: `docs/tasks/T017-user-brief.md`, `docs/tasks/T017-A1-lumi-prototype.md`, `.claude/skills/3dviz-abraxas/SKILL.md`, `docs/design/character-npc-polish-plan.md`, `docs/art/design-system.md`(캐릭터 줄), `docs/story/chapters/00-overview.md`(인물 성격).

읽기 전용 셸 명령은 자유롭게 쓴다.

## 기준: 합격한 루미

`build_char_a_parts()`와 `assets/source/previews/characters/action-strips.png`가 기준이다. 민머리를 없애고, 머리와 몸을 대표색 목으로 잇고, 눈을 키우고, 역할 소품을 게임 크기에서 보이게 한 방식을 따른다. 단, 네 주역이 **머리 모양만 가리고 봐도 서로 달라야 한다**. 루미의 곱슬을 색만 바꿔 쓰지 않는다.

## 인물별 방향

| 인물 | 몸 실루엣(유지) | 머리 실루엣 | 역할 소품 |
| --- | --- | --- | --- |
| 모카 `char-b` `#FFB020` | 아래가 넓은 물방울 | 낮고 둥글게 부푼 제빵 모자. 크림색 모자 아래로 갈색 앞머리가 살짝 보임. 한쪽으로 기운 부드러운 윤곽 | 앞치마 면과 끈이 몸에 붙어 이어져 보임. 지금처럼 흰 배로 읽히지 않게 |
| 에코 `char-c` `#8E6BFF` | 세로로 긴 원기둥 | 턱선까지 곧게 떨어지는 세로형 단발 덩어리, 가지런한 앞머리. 라벤더 계열 | 안경은 눈이 보이게 유지. 책을 몸에 붙여 들되 팔·몸과 구별되는 색과 크기 |
| 오르 `char-d` `#14B8A6` | 어깨 넓은 블록 | 각지고 납작한 짧은 머리 위에 이마 쪽으로 묶은 작업 두건. 삐죽한 곱슬 금지 | 장갑과 망치 자루가 손에서 이어지고, 망치 머리가 몸 옆으로 보임 |
| 보조 주민 `quest-npc` | 유지 | 모자 유지. 주역보다 눈에 덜 띄는 낮은 채도 유지 | 소품 추가 없음. 얼굴(눈 크기·높이)과 목 연결만 |

성별 단서가 되는 긴 머리·리본·수염 금지. 다른 게임 캐릭터 복제 금지. 측정 정책상 선택 정답을 암시하는 몸짓 금지.

## 수정하지 않는 것

- `char-a`와 `player`의 GLB·AO는 다시 내보내지 않는다. 라인업 프리뷰에만 쓴다.
- `client/src`, `content/`, 환경·소품 소스, 측정 데이터.
- `docs/memory/`, `docs/devlog/`.

## 계약

인물별 ID·경로·원점·scale 1·본 8개·클립 `idle/walk/talk`·충돌 반경(오르 0.20, 나머지 0.18)·키(모카 0.60, 에코 0.65, 오르 0.60, NPC 0.56)를 유지한다. `Y` 전체 높이 맞춤 때문에 머리나 소품으로 몸이 줄지 않게 한다. 삼각형 예산: 모카·오르 3,000, 에코 3,500, NPC 2,000. 180KiB(NPC 120KiB) 이하, 프리미티브 1개·재질 1개, Draco, `COLOR_0` 선형 변환·AO 1회.

## 쓰기 파일

`assets/source/characters/{build_characters.py,characters.blend,asset-metadata.json,provenance.md,ao_char-b.png,ao_char-c.png,ao_char-d.png,ao_quest-npc.png}`, `client/public/assets/abraxas/characters/{char-b,char-c,char-d,quest-npc}.glb`, `assets/source/previews/characters/*.png`(`char-a.png`와 `char-a-before-after.png`는 그대로). 비교본 폴더 `assets/source/characters/_before/`는 끝나면 지운다.

생성기의 `if key != "char-a": continue` 같은 일부 재생성 분기를 정리해, 대상과 재생성 범위가 코드와 provenance에 일치하게 한다. `provenance.md`에 무엇을 다시 만들었고 무엇을 그대로 뒀는지 적는다.

## 증거와 자가 판정

1. `turnaround-lineup.png`, `silhouette-lineup.png`를 **현재 배포 GLB 기준**으로 다시 만든다. 옛 라인업은 최신이 아니다.
2. `char-a-before-after.png`와 같은 형식으로 `lineup-before-after.png`를 새로 만든다. 게임 쿼터뷰로 네 인물(모카·에코·오르·NPC)의 전후를 게임 크기, 4배 확대, 단색 실루엣으로 보여 준다.
3. 세 클립 극단 자세를 인물별로 `action-strips-{char-b,char-c,char-d,quest-npc}.png`에 담는다. 소품이 손에서 벗어나거나 머리와 몸 사이가 벌어지지 않는지 본다.

PNG를 직접 보고 다음을 판정한다. 불합격이면 고쳐서 다시 빌드한다.

- 단색 실루엣만으로 주역 넷(루미 포함)을 구별할 수 있다.
- 게임 쿼터뷰에서 얼굴이 머리카락·모자에 가려지지 않는다.
- 어떤 각도에서도 머리가 벗겨져 보이지 않고, 가발처럼 어긋나 보이지 않는다.

## 검사

- `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/characters/build_characters.py`
- `node client/scripts/check-abraxas-assets.mjs`
- `npm --prefix client run typecheck`
- `npm --prefix client test`

## 결과 보고

산출물 경로, 사용 모델과 대체 사유, 실행한 검사와 결과, 인물별 측정값(삼각형·KiB), 확인한 클립·자세, 미확인 항목, 사람에게 물을 질문.
