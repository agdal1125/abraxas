# Abraxas 원본 환경 키트 제작 출처 및 이력 (Provenance)

## 1. 제작 개요 및 모델·도구 버전

- **담당 에이전트 모델**: Gemini 4 Argon (Medium)
- **컨셉 이미지 생성 도구**: Antigravity `image-generator` 서브에이전트 (원본 2D 턴어라운드 컨셉 시트 5종 생성 후 Blender 이미지 파이프라인을 통해 1536×1536 이하 PNG로 `assets/source/concepts/environment/`에 사본 저장)
- **3D 모델링·베이크·GLB 내보내기 도구**: Blender `5.2.3 LTS` (`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`, 빌드 해시 `e13b728c6880`)
- **소스 스크립트**: `assets/source/environment/build_environment.py`
- **Blender 작업 원본**: `assets/source/environment/environment_kit.blend`
- **메타데이터**: `assets/source/environment/asset-metadata.json`
- **색공간 수정(2026-11-01)**: `build_environment.py`(32종)와 `build_flowers.py`(6종)에서 기존 `BYTE_COLOR`/`bm.loops.layers.color` 경유 시 발생하던 이중 음영·비선형 AO 곱을 제거하고, sRGB 팔레트 hex(`#RRGGBB`)를 Linear-sRGB로 정확히 **한 번만** 변환하여 `COLOR_0`(`FLOAT_COLOR`, `CORNER`)에 기록하며, AO 곱도 선형 공간에서 **한 번만**(`ao = max(0.78, min(1.0, part_ao * normal_ao))`) 적용하도록 수정했다. 내보낸 GLB 38종을 다시 읽어 대표 정점(풀 `#5CC96B`, 흙길 `#F2B35E`, 캐릭터 대표색 및 건물·식생 팔레트)의 `COLOR_0` 선형값을 sRGB로 되돌렸을 때 팔레트 hex와 `0.00/255` 오차(`±6/255` 이내)로 일치함을 검증했다.

## 2. 독자적 디자인 원칙 및 원본 근거

- 기존 상용 게임·애니메이션·에셋 팩(KayKit 등)의 건물·가구·식물 도안을 모방하거나 재가공하지 않고, **둥글고 따뜻한 로우폴리 디오라마(rounded, warm low-poly diorama)**라는 품질·톤만 참고하여 32종 키트 전체를 처음부터 독자 설계했다.
- 모든 외곽 모서리에 1~2 segment(폭 0.005~0.025m) 베벨을 적용해 두툼하고 부드러운 실루엣을 확보했다.
- 재질은 불투명 `MeshStandardMaterial` 대응 단일 PBR 재질(`AbraxasEnvMat`, `Metallic = 0.0`, `Roughness = 0.85`)만 사용하고, 모든 색상과 부드러운 상하·접지 자체 AO(최소 밝기 0.76 이상으로 클램프하여 검은 얼룩 방지)는 선형 공간(Linear-sRGB) 버텍스 컬러 `COLOR_0`에 기록했다.
- 나뭇잎·꽃·수초·잔풀까지 알파 카드 없이 얇은 불투명 입체 메쉬로 제작했다.
- 내보내기 시 glTF 2.0 Binary(`.glb`), `+Y Up`, Draco 메시 압축(level 6, position 14bit, normal 10bit, texcoord 12bit, color 12bit)을 적용했다.
- 원점은 바닥 접지면 중앙(`(0, 0, 0)`), 정면은 Blender `-Y` (내보낸 GLB 기준 `+Z`)로 통일했다.
  - `bridge`는 캐릭터 보행 상판이 `y = 0` 부근에 놓이도록 접지 높이를 맞췄고(`minY = -0.025m`, `maxY = 0.325m`), 양옆 난간(`x = ±0.48m`)만 충돌 박스를 두어 중앙 통행을 열었다.
  - `memory-gate`는 좌우 기둥(`x = ±0.55m`, 각 폭 `0.30m`) 사이 중앙 `0.80m` 폭의 통로를 완전히 비워 통과를 막지 않도록 설계했다.
- 연속 지형(`terrain`)은 `content/world/village.json` v2 폴리곤(`bounds.outer`·`holes`·`bridges`, `paths`) 확정 후 전용 스크립트 `assets/source/environment/build_terrain.py`로 생성했다.

## 4. 연속 지형 (`terrain.glb`) 제작 이력

- **소스 스크립트**: `assets/source/environment/build_terrain.py`
- **Blender 작업 원본**: `assets/source/environment/terrain.blend`
- **내보낸 런타임 GLB**: `client/public/assets/abraxas/environment/terrain.glb`
- **미리보기 이미지(쿼터뷰)**: `assets/source/previews/environment/terrain.png`
- **설계 및 구현 상세**:
  - `content/world/village.json` v2의 월드 좌표계를 그대로 사용하여 Three.js(+Y Up)로 불러왔을 때 `(x -> X, z -> Z)` 위치가 정확히 일치하도록 변환(`X_b = x`, `Y_b = -z`, `Z_b = y`)하고 원점을 `(0, 0, 0)`으로 고정했다.
  - `bounds.outer` 다각형을 따라 상판 높이 `y = 0.0m`, 전체 두께 `0.35m`(`minY = -0.35m`, `maxY = 0.0m`)의 두툼한 섬 지면을 생성하고, 외곽 가장자리에는 둥근 잔디 베벨과 따뜻한 흙·돌 단면(`#B88C6A`, `#9B7355`, `#878378`, `#6E4E37`)을 부여했다. 섬 밖 바다는 엔진에서 그리므로 포함하지 않았다.
  - `bounds.holes` 내부 호수는 부드러운 제방 베벨을 거쳐 수면 높이 `y = -0.08m`로 낮춘 연못 메쉬로 구성하고, 수심에 따른 청록·하늘색(`#7ED3FA` -> `#5BC0F8` -> `#3FA0DF`) 그라데이션과 물가 자체 AO를 버텍스 컬러로 표현했다.
  - `paths` 배열의 모든 길 구간(폭 `path.width = 0.9m`)과 3방향 교차로 구간을 따라 적응형 Constrained Delaunay 정점을 배치하고, 중심부(`#F5C276`, `#F2B35E`)부터 가장자리(`#D99B4E`)까지 `smoothstep`으로 부드럽게 풀색과 섞이도록 선형 버텍스 컬러(`COLOR_0`)를 입혔다.
  - 지면 풀색은 환경 키트 식생과 동일한 톤(`#5CC96B`, `#7EE089`, `#3A9E57`)의 등방성 밝기 변화와 해안·연못가 자체 AO(`0.85 ~ 1.0`)를 적용했다.
  - **실측 예산**: 삼각형 `14,904`개 (상한 `30,000`개 이하), Draco 압축 GLB `56,108` bytes (`54.79 KiB`, 상한 `1 MiB` 이하), bounds `width = 38.0m`, `depth = 33.4864m`, `height = 0.35m` (`minX = -19.0`, `maxX = 19.0`, `minY = -0.35`, `maxY = 0.0`, `minZ = -16.7432`, `maxZ = 16.7432`).

## 3. 원본 컨셉 시트 목록 및 프롬프트 기록

### 3.1 `buildings-part1.png` (`entrance-house`, `plaza-hall`, `bakery`)
- **원본 생성 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/6a2c885b-bc0a-4d18-81f4-5af4e2830d05/abraxas_buildings_part1_concept_sheet_1793496358050.jpg`
- **저장소 사본 경로**: `assets/source/concepts/environment/buildings-part1.png`
- **생성 프롬프트**:
  > Generate an original 2D concept sheet PNG for the Abraxas environment kit: Buildings Part 1 (`entrance-house`, `plaza-hall`, `bakery`). Style & Tone: Original rounded, warm low-poly diorama style with chunky beveled silhouettes, matte opaque materials, and cozy pastel-natural colors. Do NOT imitate or reference any existing game, anime, or asset pack. Layout requirements on a clean cream background (#FFF8EC): 1. `entrance-house` (1.4x1.2x1.4m): A welcoming small cottage with a rounded gable roof, arched wooden door, warm lantern, and small signpost. Show Front view, Side view, and 3/4 Isometric view. 2. `plaza-hall` (1.8x1.5x1.6m): A community hall with a gentle stepped roof, small central bell/clock turret, wide double doorway, and fabric bunting. Show Front view, Side view, and 3/4 Isometric view. 3. `bakery` (1.6x1.4x1.5m): A cozy bakery with a rounded brick oven chimney, warm amber/terracotta awning, display window, and bread motif sign. Show Front view, Side view, and 3/4 Isometric view. 4. Include a color palette chip strip at the bottom showing cream (#FFF8EC), ink (#3B2A22), wood (#9B7355), stone (#B1ADA2), warm coral (#FF7A59), and warm gold (#FFB020).
- **채택 이유**: 어귀 안내인의 집(둥근 박공지붕·등불·표지판), 광장 회관(단차 지붕·중앙 시계/종탑·가랜드), 빵집(벽돌 화덕 굴뚝·줄무늬 어닝·빵 간판)의 실루엣이 명확히 구분되며 따뜻한 크림·목재 톤을 일관되게 유지함.

### 3.2 `buildings-part2.png` (`library`, `smithy`, `lake-pavilion`)
- **원본 생성 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/6a2c885b-bc0a-4d18-81f4-5af4e2830d05/abraxas_buildings_part2_concept_sheet_1793496364782.jpg`
- **저장소 사본 경로**: `assets/source/concepts/environment/buildings-part2.png`
- **생성 프롬프트**:
  > Generate an original 2D concept sheet PNG for the Abraxas environment kit: Buildings Part 2 (`library`, `smithy`, `lake-pavilion`). Style & Tone: Original rounded, warm low-poly diorama style with chunky beveled silhouettes, matte opaque materials, and cozy pastel-natural colors. Do NOT imitate or reference any existing game, anime, or asset pack. Layout requirements on a clean cream background (#FFF8EC): 1. `library` (1.8x1.5x1.8m): A tall, tranquil library building with a steeply pitched rounded roof, circular skylight window, arched doorway, and subtle purple/slate roof tiles (#8E6BFF muted with slate/wood). Show Front view, Side view, and 3/4 Isometric view. 2. `smithy` (1.8x1.4x1.5m): A sturdy forge building with a chunky stone hearth chimney, timber roof overhang, open workbench alcove, and teal/slate accents (#14B8A6 muted with stone #B1ADA2). Show Front view, Side view, and 3/4 Isometric view. 3. `lake-pavilion` (1.6x1.4x1.4m): A scenic lakeside pavilion with four rounded wooden pillars, low railings (closed perimeter, no interior entry), and a curved octagonal/hip roof in soft teal-wood tones. Show Front view, Side view, and 3/4 Isometric view. 4. Include a color palette chip strip at the bottom showing cream (#FFF8EC), ink (#3B2A22), wood (#9B7355), stone (#B1ADA2), soft violet (#8E6BFF), and teal (#14B8A6).
- **채택 이유**: 도서관의 높은 박공지붕·원형 채광창·측면 서가, 대장간의 석조 화덕 굴뚝·우측 개방 처마·모루, 호수 쉼터의 4기둥·막힌 난간·청록 모임지붕이 구역별 성격을 직관적으로 드러냄.

### 3.3 `landmarks-props.png` (`well`, `streetlight`, `bench`, `fence`, `festival-stage`, `memory-gate`, `bridge`)
- **원본 생성 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/6a2c885b-bc0a-4d18-81f4-5af4e2830d05/abraxas_plaza_structural_landmarks_concept_sheet_1793496362463.jpg`
- **저장소 사본 경로**: `assets/source/concepts/environment/landmarks-props.png`
- **생성 프롬프트**:
  > Generate an original 2D concept sheet PNG for the Abraxas environment kit: Plaza & Structural Landmarks (`well`, `streetlight`, `bench`, `fence`, `festival-stage`, `memory-gate`, `bridge`). Style & Tone: Original rounded, warm low-poly diorama style with chunky beveled edges and matte opaque surfaces. Do NOT imitate or reference any existing game, anime, or asset pack. Layout requirements on a clean cream background (#FFF8EC): For each item, show Front, Side, and 3/4 Isometric views: 1. `well` (0.8x0.8x0.8m): Round stone curb with two wooden posts and a small pitched shingle roof. 2. `streetlight` (height 1.0m): Rounded dark-timber/iron post with a curved arm and warm glowing lantern. 3. `bench` (0.8x0.35x0.45m): Chunky rounded wooden park bench with backrest. 4. `fence` (1.0x0.12x0.45m): Low modular wooden post-and-rail fence segment. 5. `festival-stage` (1.8x1.2x1.0m): Low wooden platform stage with back arch posts and festive bunting flags. 6. `memory-gate` (1.4x0.5x1.6m): Ancient stone archway with two wide pillars (clear open passage in the middle) and carved top lintel. 7. `bridge` (1.0x2.0x0.35m): Low-arch wooden footbridge with flat deck at y=0 and two side railings leaving the center open for walking. Include a color palette chip strip at the bottom (#FFF8EC, #3B2A22, #9B7355, #B1ADA2, #F2B35E, #FFB020).
- **채택 이유**: 광장 소품과 기억의 문·다리의 통행 개방 구조가 명확하며, 3등신 캐릭터(0.60m) 비례와 어울리는 두툼한 비례감을 갖춤.

### 3.4 `nature-foliage.png` (나무 4종, 식생 5종, 바위 2종, 물가 소품 3종)
- **원본 생성 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/6a2c885b-bc0a-4d18-81f4-5af4e2830d05/abraxas_environment_concept_sheet_1793496360216.jpg`
- **저장소 사본 경로**: `assets/source/concepts/environment/nature-foliage.png`
- **생성 프롬프트**:
  > Generate an original 2D concept sheet PNG for the Abraxas environment kit: Trees, Foliage, Rocks & Water Props (`tree-round`, `tree-layered`, `tree-slender`, `tree-young`, `bush`, `flower-bed`, `grass-tuft`, `mushroom`, `pebbles`, `rock-small`, `rock-large`, `water-reed`, `water-flower`, `shore-post`). Style & Tone: Original rounded, warm low-poly diorama style with opaque 3D geometry (no flat alpha cards), chunky beveled silhouettes, and soft gradients. Do NOT imitate or reference any existing game or asset pack. Layout requirements on a clean cream background (#FFF8EC) with Front, Side, and 3/4 views: 1. Trees (4 types): `tree-round` (spherical cluster canopy, 1.5m), `tree-layered` (tiered conical canopy, 1.8m), `tree-slender` (tall upright oval canopy, 1.6m), `tree-young` (small sapling, 1.2m). 2. Ground plants: `bush` (rounded shrub, 0.6x0.5x0.4m), `flower-bed` (low border with 5-color chunky blossoms, 0.7x0.5x0.25m), `grass-tuft` (chunky 3D blades), `mushroom` (small rounded cap cluster), `pebbles` (smooth flat river stones). 3. Rocks: `rock-small` (0.4m beveled boulder), `rock-large` (0.8m layered rounded boulder). 4. Water edge: `water-reed` (cattail reeds, 0.35m), `water-flower` (floating lily pad with blossom, 0.12m), `shore-post` (wooden mooring bollard, 0.50m). Include palette chips (#5CC96B, #3A9E57, #9B7355, #B1ADA2, #5BC0F8, #FF7A59, #FFB020, #8E6BFF).
- **채택 이유**: 나무 4종(`round`, `layered`, `slender`, `young`)의 수관 실루엣이 뚜렷이 구별되며, 5색 꽃 화단과 물가 수초·수련·말뚝이 모두 불투명 입체 덩어리로 표현됨.

### 3.5 `life-props.png` (`bread-crate`, `book-stack`, `tool-rack`, `barrel`, `log`)
- **원본 생성 경로**: `C:/Users/jake1/.gemini/antigravity-cli/brain/6a2c885b-bc0a-4d18-81f4-5af4e2830d05/abraxas_life_props_concept_sheet_1793496359725.jpg`
- **저장소 사본 경로**: `assets/source/concepts/environment/life-props.png`
- **생성 프롬프트**:
  > Generate an original 2D concept sheet PNG for the Abraxas environment kit: Life Props (`bread-crate`, `book-stack`, `tool-rack`, `barrel`, `log`). Style & Tone: Original rounded, warm low-poly diorama style with chunky beveled edges and matte opaque surfaces. Do NOT imitate or reference any existing game or asset pack. Layout requirements on a clean cream background (#FFF8EC) showing Front, Side, and 3/4 Isometric views for each of the 5 props: 1. `bread-crate` (0.36x0.28x0.25m): Slatted wooden crate filled with warm golden loaves and rolls. 2. `book-stack` (0.36x0.28x0.30m): Tied stack of thick hardcover books with colorful spines (violet, teal, cream, amber). 3. `tool-rack` (0.56x0.32x0.55m): Wooden A-frame rack holding simple rounded smithing tools (tongs, mallet, shovel). 4. `barrel` (diameter 0.30m, height 0.42m): Plump wooden stave barrel with two dark metal/wood hoops. 5. `log` (0.60x0.20x0.22m): Cut timber log with warm bark, pale wood end-grain rings, and a tiny sprout. Include a color palette chip strip at the bottom (#FFF8EC, #3B2A22, #9B7355, #B1ADA2, #FFB020, #8E6BFF, #14B8A6).
- **채택 이유**: 빵집·도서관·대장간·호숫가 주변에 배치할 생활 소품 5종이 각 구역의 서사와 색감을 자연스럽게 보강함.

## 4. 추가 식생 에셋 6종 (`build_flowers.py`)

- **소스 스크립트**: `assets/source/environment/build_flowers.py`
- **실행 도구**: Blender `5.2.3 LTS` (`C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`, 빌드 해시 `e13b728c6880`)
- **미리보기 시트**: `assets/source/previews/environment/flowers.png` (0.60m SD 캐릭터 마네킹과 나란히 3/4 쿼터뷰 및 정면 입면 비교)
- **추가 항목 및 독자 설계 근거**:
  - **작은 들꽃 무리 5종** (`flower-cluster-red` `#FF5A5F`, `flower-cluster-yellow` `#FFD23F`, `flower-cluster-white` `#FFF8EC`, `flower-cluster-pink` `#FF7EB6`, `flower-cluster-purple` `#9B7BFF`):
    - 화단 목재 상자나 흙 둔덕 없이 지면(`z = 0`)에서 곧바로 줄기 4개(활짝 핀 5꽃잎 원판 3송이 + 봉오리 1송이)와 바닥의 작은 입체 잎 4장이 솟아오르는 일반적인 들꽃 군집 형태로 독자 제작했다.
    - 각 꽃송이는 알파 카드 없이 볼록한 로우폴리 5장 꽃잎 원판과 중심 수술 원기둥으로 구성되며, 단일 불투명 재질(`AbraxasEnvMat`)과 선형 버텍스 컬러 `COLOR_0` + 하단 자체 AO를 적용했다.
    - 치수는 지름 `0.28m × 0.28m`, 높이 `0.14~0.17m`, 충돌 없음(`collision: []`), 삼각형 `280 tris` (예산 300 이하), Draco GLB `7,356~7,432 bytes` (예산 20KB 이하)를 충족한다.
  - **작은 잔풀 1종** (`grass-small`):
    - 기존 `grass-tuft`보다 작은 식생 군집 배치용으로, 지름 `0.18m × 0.18m`, 높이 `0.10m`, 충돌 없음(`collision: []`), 삼각형 `112 tris` (예산 120 이하), Draco GLB `3,632 bytes`로 제작했다.
