# Abraxas 몽환(Dream-like) 환경 아트 제작 이력 (Provenance — v1 시험 & v2 확정)

- **작성·갱신일:** 2026-11-01
- **담당:** agy (`gemini-4-argon-medium`)
- **목적:**
  - **v1 시험 단계:** T010 사람 결정(§8: "환경만 파스텔, 캐릭터 대표색 유지")에 따라 광장·빵집 구역 환경 에셋을 라벤더·복숭아·민트 파스텔 팔레트로 시험 제작하고 몽환 효과 스프라이트 4종 및 비교 미리보기를 검증.
  - **v2 확정 및 전체 적용 단계:** 사람 피드백(**"몽환 파스텔 시험 방향은 좋지만 조금 더 진하게 — 파스텔 느낌은 유지하되 채도를 살짝 올려 덜 흐리게, 특히 잔디·나무 수관. 캐릭터 대표색은 유지"**)을 반영해 몽환 팔레트 v2(`assets/source/dream/palette-v2.md`)를 확정하고, 환경 키트 33종(신규 구역 안내판 `signboard` 포함)·꽃/잔풀 6종·섬 지형(`terrain.glb`, `coast: organic-v3`) 총 40종 GLB를 `client/public/assets/abraxas/environment/`에 재생성.
- **Blender 실행 버전:** Blender 5.2.3 LTS
  - `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/environment/build_environment.py`
  - `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/environment/build_flowers.py`
  - `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python-exit-code 1 -P assets/source/environment/build_terrain.py`

---

## 1. 원본 무드 컨셉 및 팔레트 칩 생성 이력 (`assets/source/concepts/dream/`)

특정 게임·애니·작품의 장면이나 화풍을 모방하지 않고, **'낮의 생활감이 남은 꿈같은 분위기'**와 **'둥글고 따뜻한 로우폴리 디오라마'** 원칙만 적용했다.

| 구분 | 저장 경로 | 생성 도구 및 상태 | 프롬프트 원문 / 제작 방식 |
| --- | --- | --- | --- |
| (a) 광장·빵집 몽환 쿼터뷰 컨셉 | `assets/source/concepts/dream/dream-plaza-bakery.png` (원본: `C:\Users\jake1\.gemini\antigravity-cli\brain\025f5463-41bd-4310-bf18-be6a6e3ac12f\dream_plaza_bakery_concept_1793507900837.jpg`) | `image-generator` 서브에이전트 생성 후 Blender로 PNG(1376×1024) 변환 저장 | `"Original 3D low-poly diorama concept illustration from a fixed 3/4 top-down orthographic quarter-view perspective, depicting a tranquil daytime dream-like village plaza and bakery zone. The plaza features a stepped stone-and-cream town hall with pastel bunting, a cozy bakery with a brick oven and peach-terracotta awning, a stone water well with clear aqua-mint water (#A9D8D3), a warm glowing streetlamp (#FFE8A3), rounded sage-mint trees (#98C9B5), bushes, and a wooden flower bed with pastel blossoms. The ground is soft mint grass (#B5D9C4) with a warm sand-peach dirt path (#EBD3B9), surrounded by gentle lavender-tinted morning mist (#DDD8F1, #EDE8F8), floating flower petals, and tiny soft light motes. In the plaza stands a simple 3-head-tall rounded gender-neutral character mannequin wearing vibrant coral (#FF7A59) so the character silhouette pops clearly against the soft pastel environment. Original design only, rounded beveled low-poly clay-like matte surfaces, no text, no watermark."` |
| (b) 9색 팔레트 v2 칩 시트 | `assets/source/concepts/dream/dream-palette-chips.png` (1024×1024 PNG) | `build_environment.py`에서 팔레트 v2의 정확한 sRGB hex 값과 라벨을 픽셀 단위로 렌더링한 3×3 칩 시트 생성 | 1) `SKY #D8D0F0` 2) `MIST #EAE3F7` 3) `GRASS #9CD4B5` 4) `PATH #EDC9A3` 5) `WALL #FFF8EC` 6) `ROOF #EBA698` 7) `LEAVES #7EC4A6` 8) `WATER #94D2CB` 9) `LIGHT #FFE08A` |

---

## 2. 몽환 파스텔 팔레트 v2 요약 (`assets/source/dream/palette-v2.md`)

시험판(v1) 대비 잔디·나무·흙길·지붕의 HSL 채도를 **+15~25%** 높이고 명도는 비슷하게 유지했다.

| 번호 | 영역 | 칩 라벨 | 시험판 v1 Hex | 확정판 v2 Hex | 채도 변화 (상대) | 역할 및 변경 의도 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 하늘 | `SKY` | `#DDD8F1` | `#D8D0F0` | +9.3% | 수평선 없는 정사영 외곽을 감싸는 안개 라벤더 하늘 |
| 2 | 안개 | `MIST` | `#EDE8F8` | `#EAE3F7` | +3.0% | 화면 가장자리·원경에만 얕게 깔리는 연보라 안개 |
| 3 | 지면 풀 | `GRASS` | `#B5D9C4` | `#9CD4B5` | **+22.7%** | 하얗게 뜨지 않고 캐릭터 대표색(`#FF7A59`)을 받쳐주는 파스텔 민트 잔디 |
| 4 | 흙길 | `PATH` | `#EBD3B9` | `#EDC9A3` | **+21.0%** | 잔디와 통행 경계가 또렷한 따뜻한 모래 살구색 |
| 5 | 건물 벽 | `WALL` | `#FFF8EC` | `#FFF8EC` | 유지 | 따뜻한 종이/크림 톤 유지로 마을의 낮 생활감 보존 |
| 6 | 지붕 | `ROOF` | `#E7B6AB` | `#EBA698` | **+21.4%** | 캐릭터 코럴(`#FF7A59`)과 겹치지 않으면서 선명해진 복숭아 테라코타 |
| 7 | 나뭇잎 | `LEAVES` | `#98C9B5` | `#7EC4A6` | **+19.2%** | 지면 풀(`#9CD4B5`) 및 그늘 잎(`#64AD8E`)과 입체적으로 구분되는 세이지 민트 수관 |
| 8 | 물 | `WATER` | `#A9D8D3` | `#94D2CB` | +12.7% | 우물·연못에 하늘빛이 비치는 맑은 아쿠아 민트 |
| 9 | 빛 | `LIGHT` | `#FFE8A3` | `#FFE08A` | +27.1% (HSV) | 크림 외벽 위에서도 또렷하게 읽히는 은은한 별빛 앰버 |

---

## 3. 신규 원본 에셋 `signboard`(구역 안내판) 및 전체 40종 GLB 재생성

- **신규 에셋 `signboard` (`client/public/assets/abraxas/environment/signboard.glb`):**
  - 라벤더 석재 받침(`#C8BFE0`) + 둥근 꼭지 장식이 달린 나무 기둥(`#9C7860`, `#C69D80`) + 둥근 모서리 목재 안내판과 처마(`#C69D80`, `#9C7860`) + 크림색 안내면(`#FFF8EC`)과 파스텔 구역 표식(`#EBA698`, `#6FB8AE`, `#DFB99E`, `#FFE08A`).
  - 치수: `0.48m × 0.22m × 0.90m` (원점 바닥 중앙 `minY = 0.0, maxY = 0.90`).
  - 충돌: `[{"type": "box", "x": 0.0, "z": 0.0, "halfX": 0.22, "halfZ": 0.10}]`.
- **색공간 및 내보내기 검증 규칙 (`build_environment.py`, `build_flowers.py`, `build_terrain.py` 공통):**
  1. `srgb_to_linear()`로 sRGB 팔레트 v2 hex를 Linear-sRGB로 **단 1회** 변환한다.
  2. 선형 공간에서 자체 AO(`0.78 ~ 1.0`)를 **단 1회** 곱해 `FLOAT_COLOR` 타입 `COLOR_0`(CORNER 도메인)에 기록한다.
  3. Draco 압축(`level 6`, position 14bit, normal 10bit, color 12bit)으로 내보낸 직후 재임포트하여 모든 사용 팔레트 v2 색상의 sRGB 오차가 `±6/255` 이내임을 검증한다.
- **미리보기 (`assets/source/previews/dream/`):**
  - `dream-v2.png` (1024×1024): 광장·빵집·우물·가로등·신규 안내판(`signboard`)·나무·수풀·화단과 `#FF7A59` 0.6m 캐릭터 마네킹 쿼터뷰.
  - `dream-v2-compare.png` (1024×512): 왼쪽 `DREAM TEST V1`(시험판) 대비 오른쪽 `DREAM PASTEL V2`(확정판 v2) 비교.
