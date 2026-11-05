# T018-P2 2단계: 빵집 방향·길·소품

`docs/tasks/T018-P2-bakery-prototype.md`의 사람 결정, 합격 기준, 금지 사항은 그대로다. Codex가 대체하므로 셸 읽기는 자유롭다. 커밋·push 금지. 이 단계는 **아래 파일만** 쓴다. 다른 작업자가 동시에 `client/src`를 고치므로 `client/src`는 쓰지 않는다.

쓰기: `content/world/village.json`, `content/assets/manifest.json`(필요할 때만), `assets/source/environment/`, `assets/source/previews/environment/`, `client/public/assets/abraxas/environment/{bakery.glb,terrain.glb}`.

## 감독이 게임 화면에서 확인한 사실

1. **빵집이 카메라에 등을 보인다.** 차양·진열창·빵·문은 모델 앞면에 제대로 있다(`assets/source/previews/environment/bakery.png`). 그런데 `prop-9`(rot 3.142)와 `prop-10`(rot 2.094)은 게임 카메라(+X+Z 쪽에서 내려다봄)에 뒷면을 보인다. 비평의 "블록 장난감" 인상의 큰 원인이다.
2. 벽에 붙은 큰 붉은 천은 무엇인지 읽히지 않는다.
3. 길 꺾임이 뾰족하다. 지형은 `build_terrain.py`가 길 선분 거리로 정점 색을 칠한다.
4. 빵 상자가 빈 땅 곳곳에 같은 모양으로 흩어져 있다.

## 할 일

1. **빵집 두 채를 돌린다.** 앞면과 입구가 게임 카메라를 향하게 `rot`를 고치고, 필요하면 위치도 조금 옮긴다. 입구로 길이 이어져야 한다. 모델 앞면 방향을 코드에서 확인하고 추측하지 않는다. 충돌 영역이 회전을 따르는지 확인한다.
2. **붉은 천을 고친다.** 빵집 생성기에서 지지 구조가 있는 차양으로 읽히게 하거나, 읽히지 않으면 없앤다. 크기로 해결하지 않는다.
3. **길을 부드럽게 한다.** `village.json`의 빵집 앞 구간 길 중심선에 곡선 점을 넣어 뾰족한 꺾임을 없앤다. 다른 구간은 건드리지 않는다. 지형을 다시 빌드한다. 다른 지형 출력이 달라지면 보고한다.
4. **소품을 모은다.** 빵집 앞 화면에서 빵 상자를 빵집 작업 영역의 2~4개 군집으로 모으고 무관한 빈 땅의 것은 없앤다. 빈 땅의 통나무도 줄인다. 같은 소품·크기·방향이 한 화면에 3개를 넘지 않게 회전과 크기를 달리한다. `id`가 심부름·대화·조사 대상으로 참조되는 소품은 먼저 검색하고, 참조되는 것은 지우지 말고 위치도 도달 가능하게 유지한다.

## 검사

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`, `npm --prefix client test`, `npm --prefix client run build`, `npm --prefix client run check:size`를 실행한다. `client/dist`와 `client/public/ink`는 git 제외 빌드 산출물이므로 빌드가 써도 된다.

한국어로 바꾼 것, 빵집의 새 rot와 근거, 지운 소품 ID 목록, 삼각형·바이트 전후, 검사 결과, 미확인 항목을 보고한다. `docs/memory/`, `docs/devlog/`는 고치지 않는다.
