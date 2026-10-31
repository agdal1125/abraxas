# 환경 밀도 및 장식(Decor) 구성 — Quality Pass 1 (Q1)

근거: `docs/design/quality-pass-contract.md` (§계약 1), `docs/reviews/2026-11-01-quality-review.md` (§2 환경 밀도, §4 P1 환경 밀도).

## 1. 구역별 구성 의도

어떤 상용 게임의 화단·정원 배치도 모사하지 않고, Abraxas 마을의 여정(어귀 도착 → 네 주민과의 에피소드 및 심부름 → 호숫가 막간 → 광장 축제 → 기억의 문)과 각 구역의 생활 역할에서 시각 밀도를 설계했다. 한 화면 구역마다 **큰 랜드마크 1개 이상, 중간 소품 묶음 2개 이상, 작은 식생 군집 3개 이상**이 겹쳐 보이도록 구성했다.

| 구역 (`zones`) | 중심 좌표 | 큰 랜드마크 (`props`) | 중간 소품 묶음 (`props` + `model:*` decor) | 작은 식생·장식 군집 (`decor`) 및 생활 장면 의도 |
| --- | --- | --- | --- | --- |
| **광장 (`plaza`)** | `(0, 0)` | 축제 무대(`building_stage_A`), 푸른 우물(`building_well_blue`) | 벤치·가로등 쌍, 무대 옆 나무 상자(`crate_A_small`)·통(`barrel`)·관목(`city/bush`) 묶음 | **마을 축제 준비**: 우물과 무대 주변 `(1,-1)`, `(-1,1)`, `(-2,-1)` 일대에 3열 꽃 화단(`flowers_red`, `flowers_yellow`, `flowers_pink`, `flowers_white`)을 가꾸고, 광장 길가 가장자리에 잔풀(`grass_tuft`)과 조약돌(`pebbles`)을 배치해 축제를 앞둔 활기를 표현 |
| **어귀 (`entrance`)** | `(0, 6)` | 노란 지붕 집(`building_home_A_yellow`), 여행자 천막(`tent`) | 나무 울타리(`fence_wood_straight`)·가로등, 짐 상자(`crate_A_small`)·통(`barrel`)·관목(`city/bush`) 묶음 | **기억을 잃은 주인공의 첫걸음**: 시작 지점 `(0,6)`부터 광장으로 이어지는 길 양옆과 심부름 NPC(`s1j2`, `2,3`) 주변에 밝은 노란 꽃(`flowers_yellow`), 흰 꽃(`flowers_white`), 잔풀(`grass_tuft`), 조약돌(`pebbles`), 통나무(`log`)를 길가 오프셋으로 배치해 자연스럽게 시선을 북쪽 광장으로 안내 |
| **빵집 앞 (`bakery`)** | `(5, -2)` | 붉은 장터(`building_market_red`), 노란 주점(`building_tavern_yellow`), 풍차(`building_windmill_yellow`) | 빵·당근·토마토 상자(`crate_buns`, `crate_carrots`, `crate_tomatoes`), 곡물 자루(`sack`) 묶음 | **작은 텃밭과 꽃 화분**: 장터와 풍차 앞 `(5,-3)`, `(6,-3)`, `(5,-1)`에 식재료 상자와 어우러지는 작은 텃밭·화분 느낌의 다채로운 꽃 무리(`flowers_red`, `flowers_yellow`, `flowers_pink`, `flowers_white`)와 잔풀을 촘촘히 배치 (`v1j2`, `s2j2` 동선 포함) |
| **도서관 앞 (`library`)** | `(-5, -1)` | 푸른 예배당형 도서관(`building_church_blue`) | 야외 책장(`shelf_B_small_decorated`)·스탠드 조명(`lamp_standing`), 벤치·책 더미(`book_set`) 묶음 | **조용한 야외 독서 정원**: 독서 자리와 벤치 주변 `(-5,-2)`, `(-6,-1)`, `(-4,-2)`부터 `t1p2`(`-7,2`)까지 차분한 흰 꽃(`flowers_white`)과 보라 꽃(`flowers_purple`), 잔풀(`grass_tuft`), 작은 버섯(`mushroom`)으로 정돈된 사색 공간을 연출 |
| **대장간 앞 (`smithy`)** | `(4, 4)` | 푸른 대장간(`building_blacksmith_blue`) | 목재 더미(`resource_lumber`)·외바퀴 수레(`wheelbarrow`), 물양동이(`bucket_water`)·바위(`rock_single_A/B`)·통(`barrel`) 묶음 | **모루와 장작 작업장**: 대장간 앞마당 `(4,3)`, `(5,3)`, `(5,4)`, `(4,5)` 일대에 통나무 토막(`log`), 자갈 무더기(`pebbles`), 억센 잔풀(`grass_tuft`)을 집중 배치하고 바위 틈에 노란 야생화를 소량 섞어 단단한 작업터의 질감을 강조 |
| **호숫가 (`lake`)** | `(-4, 5)` | 붉은 물레방아(`building_watermill_red`), 나무 다리(`building_bridge_A`) | 수련·수초(`waterlily_A/B`, `waterplant_A`), 물가 벤치·가로등·바위(`rock_single_C`) 묶음 | **막간의 쉼터와 습지 식생**: 막간 이벤트가 열리는 물가 산책로 `(-4,4)`, `(-3,4)`, `(-5,4)`, `(-7,5)`를 따라 분홍 꽃(`flowers_pink`), 물가 잔풀(`grass_tuft`), 습지 버섯(`mushroom`), 조약돌(`pebbles`)을 겹쳐 배치해 촉촉하고 서정적인 휴식처를 구성 |
| **기억의 문 (`gate`)** | `(0, -8)` | 성문(`wall_straight_gate`), 좌우 탑 기단(`building_tower_base_blue`) | 가로등 쌍, 문 앞 수호석(`rock_single_A`, `rock_single_C`) 묶음 | **여정의 끝과 고요한 문턱**: 광장에서 북쪽 문 `(0,-8)`로 향하는 직선 길 양옆과 탑 기단 주변에 순백의 꽃(`flowers_white`), 연보라 꽃(`flowers_purple`), 정갈한 조약돌(`pebbles`)만 절제되게 늘어놓아 타이브레이커 직전의 경건한 분위기를 형성 |
| **외곽 풀밭·숲 경계** | 반지름 6~9 | 외곽 산·언덕(`mountain_A_grass_trees`, `hills_A_trees`)과 큰 나무(`trees_A_large`) | 주택(`building_home_*`), 울타리, 숲 가장자리 바위·관목 묶음 | **빈 땅 없는 섬 디오라마**: 구역 사이 빈 잔디 칸과 나무 밑동마다 잔풀(`grass_tuft`), 야생화(`flowers_*`), 그늘 버섯(`mushroom`), 쓰러진 통나무(`log`)를 고르게 분포시켜 카메라가 어디를 비추어도 지면이 비어 보이지 않게 마감 |

## 2. 장식(`decor`) 수량 집계

`content/world/village.json`의 최상위 `decor` 배열에는 총 **590개**의 장식이 수록되어 있다(계약 범위 400~700개 충족). 모든 항목은 계약된 `kind` 목록과 오프셋(`dx`, `dz` ∈ `[-0.6, 0.6]`), 회전(`rot` 라디안), 크기(`scale` ∈ `[0.8, 1.3]`) 규칙을 따른다.

| `kind` | 수량 | 주된 배치 구역 및 용도 |
| --- | ---: | --- |
| `grass_tuft` | 171 | 전 구역 풀밭 바탕, 길가 가장자리, 호숫가 수풀, 나무·바위 밑동 접지 보강 |
| `flowers_yellow` | 83 | 어귀 맞이 길가, 광장 축제 화단, 빵집 텃밭, 주택 마당 |
| `pebbles` | 83 | 대장간 작업장 바닥, 기억의 문 참도, 어귀·광장 길가 가장자리, 물가 자갈 |
| `flowers_white` | 79 | 기억의 문 참도, 도서관 독서 정원, 광장 화단, 빵집·어귀 포인트 |
| `flowers_pink` | 53 | 호숫가 산책로, 광장 축제 화단, 빵집 앞 꽃 화분 군집 |
| `flowers_purple` | 31 | 도서관 조용한 독서 자리 주변, 기억의 문 진입로, 호숫가 안쪽 |
| `flowers_red` | 29 | 광장 축제 중심 화단, 빵집 앞 텃밭·화분, 마을 주택 화단 |
| `mushroom` | 26 | 호숫가 습지, 외곽 나무·바위 그늘, 도서관 뒤편 수풀 |
| `log` | 17 | 대장간 장작 작업장, 어귀 천막 옆, 숲 가장자리 |
| `model:medieval/crate_A_small` | 3 | 광장 무대 옆·어귀 길가 소품 묶음 보강 |
| `model:city/bush` | 2 | 광장 벤치 옆·어귀 울타리 옆 중간 식생 묶음 보강 |
| `model:medieval/rock_single_A` | 2 | 대장간 작업장·기억의 문 주변 돌 묶음 보강 |
| `model:medieval/rock_single_C` | 1 | 기억의 문 옆 수호석 묶음 보강 |
| `model:medieval/barrel` | 1 | 어귀 상자 옆 중간 소품 묶음 보강 |
| `model:medieval/bucket_water` | 1 | 대장간 모루 근처 작업 소품 묶음 보강 |
| `model:medieval/sack` | 1 | 빵집 남쪽 길가 식재료 자루 묶음 보강 |
| `model:restaurant/crate_buns` | 1 | 빵집 앞 화단 옆 빵 상자 묶음 보강 |
| `model:restaurant/crate_carrots` | 1 | 빵집 앞 텃밭 옆 당근 상자 묶음 보강 |
| `model:restaurant/crate_tomatoes` | 1 | 빵집 주점 앞 토마토 상자 묶음 보강 |
| `model:furniture/book_set` | 1 | 도서관 앞 독서 정원 책 더미 보강 |
| `model:medieval/waterlily_A` | 1 | 호수 수면(`-7, 7`) 수련 군집 보강 |
| `model:medieval/waterlily_B` | 1 | 호수 수면(`-6, 8`) 수련 군집 보강 |
| `model:medieval/waterplant_A` | 1 | 호수 수면(`-6, 8`) 수초 군집 보강 |
| **합계** | **590** | — |

## 3. 통행 및 시야 보호 원칙

1. **논리 격자 및 좌표 불변**: 기존 `tiles`(271칸), `props`(111개), `zones`(7곳), `actors`(8명)의 좌표와 속성은 단 하나도 변경하거나 삭제하지 않았다.
2. **비차단 장식(`decor`) 분리**: 새로 추가한 590개 `decor`는 렌더러(Q2)에서 충돌 없는 인스턴스 메시로 그려지므로, 헥스 BFS 경로 탐색이나 탭 이동을 막지 않는다.
3. **길(`hex_road_*`) 및 캐릭터(`actors`) 칸 중앙 비우기**:
   - 도로 타일이나 캐릭터·퀘스트 NPC가 서 있는 타일에 `decor`를 둘 때는 반드시 `|dx| ≥ 0.45` 또는 `|dz| ≥ 0.35` 이상의 **가장자리 오프셋**만 사용해, 주인공이 걷는 동선 중앙과 NPC 발밑·얼굴이 가려지지 않게 했다.
   - 키가 있는 `model:*` 장식은 도로 타일이나 캐릭터 타일에 배치하지 않고, 인접 잔디 칸이나 기존 `props` 가장자리(`|dx|, |dz| ≥ 0.35`)에만 붙여 중간 소품 묶음의 밀도를 높였다.
