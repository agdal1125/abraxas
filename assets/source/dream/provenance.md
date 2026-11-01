# Abraxas 몽환(Dream-like) 환경 아트 시험 제작 이력 (Provenance)

- **작성일:** 2026-11-01
- **담당:** agy (`gemini-4-argon-medium`)
- **목적:** T010 사람 결정(§8: "환경만 파스텔, 캐릭터 대표색 유지")에 따라 광장·빵집 구역 환경 에셋 7종을 라벤더·복숭아·민트 파스텔 팔레트로 재색칠하고, 몽환 효과 스프라이트 4종 및 기존 대비 비교 미리보기를 검증하는 시험 단계.
- **Blender 실행 버전:** Blender 5.2.3 LTS (`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/dream/build_dream_test.py`)

---

## 1. 원본 무드 컨셉 생성 이력 (`assets/source/concepts/dream/`)

특정 게임·애니·작품의 장면이나 화풍을 모방하지 않고, **'낮의 생활감이 남은 꿈같은 분위기'**와 **'둥글고 따뜻한 로우폴리 디오라마'** 원칙만 적용했다.

| 구분 | 저장 경로 | 생성 도구 및 상태 | 프롬프트 원문 |
| --- | --- | --- | --- |
| (a) 광장·빵집 몽환 쿼터뷰 컨셉 | `assets/source/concepts/dream/dream-plaza-bakery.png` (원본: `C:\Users\jake1\.gemini\antigravity-cli\brain\025f5463-41bd-4310-bf18-be6a6e3ac12f\dream_plaza_bakery_concept_1793507900837.jpg`) | `image-generator` 서브에이전트 생성 후 Blender로 PNG(1376×1024) 변환 저장 | `"Original 3D low-poly diorama concept illustration from a fixed 3/4 top-down orthographic quarter-view perspective, depicting a tranquil daytime dream-like village plaza and bakery zone. The plaza features a stepped stone-and-cream town hall with pastel bunting, a cozy bakery with a brick oven and peach-terracotta awning, a stone water well with clear aqua-mint water (#A9D8D3), a warm glowing streetlamp (#FFE8A3), rounded sage-mint trees (#98C9B5), bushes, and a wooden flower bed with pastel blossoms. The ground is soft mint grass (#B5D9C4) with a warm sand-peach dirt path (#EBD3B9), surrounded by gentle lavender-tinted morning mist (#DDD8F1, #EDE8F8), floating flower petals, and tiny soft light motes. In the plaza stands a simple 3-head-tall rounded gender-neutral character mannequin wearing vibrant coral (#FF7A59) so the character silhouette pops clearly against the soft pastel environment. Original design only, rounded beveled low-poly clay-like matte surfaces, no text, no watermark."` |
| (b) 9색 팔레트 칩 시트 | `assets/source/concepts/dream/dream-palette-chips.png` (1024×1024 PNG) | `image-generator` 호출 시 2번째 이미지에서 모델 쿼터 소진(`429 RESOURCE_EXHAUSTED`) 발생 → `build_dream_test.py`에서 정확한 sRGB hex 값과 라벨을 픽셀 단위로 렌더링한 3×3 칩 시트 생성 | 시도 프롬프트: `"Clean minimalist graphic design color palette swatch sheet on a soft off-white background, arranged in a neat 3x3 grid of 9 rounded square color chips for a dreamy pastel 3D diorama environment. Each swatch clearly displays its exact color and clean label with hex code underneath: 1) SKY #DDD8F1 (mist lavender) 2) MIST #EDE8F8 (soft dream haze) 3) GRASS #B5D9C4 (pastel mint green) 4) PATH #EBD3B9 (warm sand peach) 5) WALL #FFF8EC (warm cream) 6) ROOF #E7B6AB (soft peach terracotta) 7) FOLIAGE #98C9B5 (sage mint leaf) 8) WATER #A9D8D3 (clear aqua mint) 9) LIGHT #FFE8A3 (warm starlight glow). Flat accurate color swatches, clean modern typography, studio design reference sheet."` |

---

## 2. 몽환 파스텔 팔레트 (9색 기준표 및 오브젝트 확장 팔레트)

### 2-1. 핵심 9색 팔레트 칩 (`dream-palette-chips.png` 기준)

| 번호 | 영역 | 칩 라벨 | Hex | 기존 색 (`build_environment.py`) | 역할 및 변경 의도 |
| --- | --- | --- | --- | --- | --- |
| 1 | 하늘 | `SKY` | `#DDD8F1` | `#5BC0F8` (선명 파랑) | 수평선 없는 정사영 외곽을 부드럽게 감싸는 안개 라벤더 하늘 |
| 2 | 안개 | `MIST` | `#EDE8F8` | 없음 | 화면 가장자리·원경에만 얕게 깔리는 연보라빛 꿈 안개 |
| 3 | 지면 풀 | `GRASS` | `#B5D9C4` | `#5CC96B` (고채도 초록) | 캐릭터 대표색(`#FF7A59` 등)이 선명하게 분리되는 파스텔 민트 잔디 |
| 4 | 흙길 | `PATH` | `#EBD3B9` | `#F2B35E` (강한 황토) | 통행 경계를 잃지 않으면서 눈이 편안한 따뜻한 모래 복숭아 |
| 5 | 건물 벽 | `WALL` | `#FFF8EC` | `#FFF8EC` (크림 유지) | 따뜻한 종이/크림 톤 유지로 마을의 낮 생활감 보존 |
| 6 | 지붕 | `ROOF` | `#E7B6AB` | `#FF7A59` / `#C86D51` | 캐릭터 A의 코럴(`#FF7A59`)과 겹치지 않도록 채도를 낮춘 복숭아 테라코타 |
| 7 | 나뭇잎 | `LEAVES` | `#98C9B5` | `#5CC96B` / `#3A9E57` | 지면 풀(`#B5D9C4`)과 톤온톤으로 구분되는 세이지 민트 수관 |
| 8 | 물 | `WATER` | `#A9D8D3` | `#5BC0F8` (선명 파랑) | 우물·연못에 하늘빛이 비치는 맑은 아쿠아 민트 |
| 9 | 빛 | `LIGHT` | `#FFE8A3` | `#FFB020` (강한 주황금색) | 낮에도 작은 별을 품은 듯한 은은한 별빛 앰버 |

### 2-2. 7종 GLB 버텍스 컬러(`COLOR_0`) 세부 팔레트 매핑

| 팔레트 키 | Dream Hex | 기존 Hex | 사용 에셋 |
| --- | --- | --- | --- |
| `cream` / `cream_warm` | `#FFF8EC` / `#F7EFE2` | `#FFF8EC` / `#F5E9D4` | `plaza-hall`, `bakery` 외벽·시계탑 |
| `stone` / `stone_light` / `stone_dark` | `#CFC8DC` / `#E2DCEE` / `#B3AAC4` | `#B1ADA2` / `#C7C3B8` / `#878378` | `plaza-hall` 계단식 지붕·기단, `bakery` 기단, `well` 우물 둘레 |
| `wood` / `wood_light` / `wood_dark` | `#C8A992` / `#DEC3AE` / `#9E8270` | `#9B7355` / `#B88C6A` / `#6E4E37` | `plaza-hall`, `bakery`, `tree-round`, `flower-bed`, `well`, `streetlight` 목재 |
| `coral` | `#E7B6AB` | `#FF7A59` | `plaza-hall` 가랜드, `bakery` 차양, `flower-bed` 꽃 |
| `brick` / `brick_dark` | `#E2A89B` / `#C98F82` | `#C86D51` / `#9E5038` | `bakery` 화덕·굴뚝 |
| `gold` / `gold_light` | `#FFE8A3` / `#FFF3C9` | `#FFB020` / `#FFD166` | `streetlight` 등불, `bakery` 간판·창문, `plaza-hall` 시계·가랜드, `flower-bed` 꽃술 |
| `grass` / `grass_light` / `grass_dark` | `#98C9B5` / `#B5D9C4` / `#7EB39D` | `#5CC96B` / `#7EE089` / `#3A9E57` | `tree-round`, `bush`, `flower-bed` 잎사귀 |
| `violet` / `blossom_pink` / `blossom_white` | `#C8B6E8` / `#E8BDD4` / `#FAF5FF` | `#8E6BFF` / `#FF8FA3` / `#FFFDF9` | `flower-bed` 5색 파스텔 꽃 |
| `sea` | `#A9D8D3` | `#5BC0F8` | `well` 수면 |
| `ink` | `#5A4E66` | `#3B2A22` | `streetlight` 기단·갓, `bakery` 간판 걸이 |

> **캐릭터 대표색 유지:** 미리보기의 0.6m 캐릭터 마네킹은 사람 결정(§8)에 따라 기존 대표색 `#FF7A59`를 그대로 유지했다.

---

## 3. 색공간 및 내보내기 검증 규칙

- `assets/source/dream/build_dream_test.py`는 `build_environment.py`와 동일한 색공간 규칙을 따른다:
  1. `srgb_to_linear()`로 sRGB 팔레트 hex를 Linear-sRGB로 **단 한 번만** 변환한다.
  2. 선형 공간에서 파트 높이·법선 기반 자체 AO(`0.78 ~ 1.0`)를 **단 한 번만** 곱해 `FLOAT_COLOR` 타입 `COLOR_0`(CORNER 도메인)에 기록한다.
  3. Draco 압축(`level 6`, position 14bit, normal 10bit, color 12bit)으로 `client/public/assets/abraxas/dream-test/<key>.glb`에 내보낸 직후, `verify_glb_colors()`로 재임포트하여 모든 사용 팔레트 색상의 sRGB 오차가 `0.00/255` (`±6/255` 이내)임을 검증했다.
- 원본 `client/public/assets/abraxas/environment/` 폴더는 수정하지 않았다.

---

## 4. 몽환 효과 스프라이트 4종 (`client/public/assets/abraxas/fx/`)

- `build_dream_test.py` 내 절차적 알파 셰이핑으로 생성 후 Blender 이미지 파이프라인을 통해 `128×128` RGBA 투명 배경 PNG로 저장했다:
  - `fx-petal.png`: `#F7DFEC`~`#E8BDD4` 그라데이션의 둥근 꽃잎 형태, 가장자리 부드러운 알파 감쇠.
  - `fx-firefly.png`: `#FFFDF2` 중심 코어와 `#FFE8A3` 별빛 헤일로가 결합된 반딧불 빛 점.
  - `fx-glow.png`: `#FFF3C9`~`#EDE8F8`의 부드러운 방사형 가짜 글로우(사각 테두리 끊김 없음, 외곽 알파 0).
  - `fx-mist.png`: `#EDE8F8`~`#DDD8F1` 다중 구름 로브 기반의 얕은 안개 조각(외곽 알파 0).
