# 3D 마을 프로토타입 계약서 (v2)

1차 프로토타입(대사창만 있는 구조)을 대체한다. 근거: 사람 피드백 2026-10-31, `docs/art/design-system.md`.

## 목표

모바일 웹브라우저에서 **쿼터뷰 3D 마을을 걸어 다니며** 공략 캐릭터 A·B·C·D와 퀘스트 NPC를 만나고, 측정 문항 38 + 타이브레이커 4를 지나 결과 화면까지 가는 한 판. 완성도보다 끊기지 않는 흐름이 우선.

## 기술

- 렌더링: Three.js (ADR-0005). Phaser는 제거한다. 성향 계산 `client/src/core/`, ink 런타임(inkjs), 문구(`content/i18n`)는 그대로 쓴다.
- 대사·선택지·결과 UI는 캔버스 위 **HTML 오버레이**(DOM)로 그린다. 글자가 선명하고 모바일 접근성이 좋다.
- 카메라: `OrthographicCamera`, 쿼터뷰 고정 각도(위에서 약 35°, 45° 회전), 주인공을 부드럽게 따라감. 회전·줌 없음.
- 성능: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, 그림자는 주인공·캐릭터 원형 블롭(투명 원판)만, 정지 상태에서는 렌더 생략.

## 에셋

- `client/public/assets/kaykit/<pack>/<name>.gltf` (KayKit, CC0, Kay Lousberg). 팩: `medieval`, `restaurant`, `furniture`, `city`. 목록은 폴더 그대로.
- 모든 medieval 모델은 `hexagons_medieval.png` 한 장을 텍스처로 공유한다. **선명한 팔레트**(디자인 시스템)로 보이도록 로드 후 이 텍스처의 채도·밝기를 올린다(캔버스 처리 1회).
- 캐릭터는 코드로 조립(구·캡슐·원기둥, `MeshToonMaterial` 또는 `MeshStandardMaterial` 낮은 roughness): 3등신에 가깝게, 점 눈 + 작은 입.
  - A 공형·짧은 팔다리·작은 깃발 `#FF7A59` / B 물방울형·앞치마 `#FFB020` / C 원기둥형·큰 머리·둥근 안경 `#8E6BFF` / D 블록형·넓은 어깨·망치 `#14B8A6`
  - 주인공: 얼굴 없는 둥근 실루엣 + 알 껍질 조각(흰색·크림)
  - 퀘스트 NPC: 둥근 몸 + 회색조 단색, 머리 위에 코드 이름 표찰

## 맵 (`content/world/village.json`)

헥스 격자(KayKit 헥스 타일, 지름 2). 좌표는 축 좌표 `q, r`.

```jsonc
{
  "version": 1,
  "hexSize": 1,                       // 타일 중심 간 거리 계산용 (KayKit 헥스 기준)
  "tiles": [ { "q": 0, "r": 0, "model": "medieval/hex_grass", "walk": true } ],
  "props": [ { "q": 1, "r": 0, "model": "medieval/trees_A_small", "rot": 0, "scale": 1 } ],   // 장식, 걷기 불가 칸이 됨
  "zones": {
    "entrance": { "q": 0, "r": 6 }, "plaza": { "q": 0, "r": 0 }, "bakery": { "q": 5, "r": -2 },
    "library": { "q": -5, "r": -1 }, "smithy": { "q": 4, "r": 4 }, "lake": { "q": -4, "r": 5 }, "gate": { "q": 0, "r": -8 }
  },
  "actors": [
    { "id": "A", "zone": "plaza" }, { "id": "B", "zone": "bakery" }, { "id": "C", "zone": "library" }, { "id": "D", "zone": "smithy" },
    { "id": "s1j2", "q": 2, "r": 3 }, { "id": "v1j2", "q": 7, "r": 0 }, { "id": "t1p2", "q": -7, "r": 2 }, { "id": "s2j2", "q": 6, "r": 6 }
  ]
}
```

- 화면 2~3개 크기(대략 반지름 9 헥스). 길(hex_road)로 구역을 잇고, 구역마다 해당 건물: 광장=우물+무대(축제), 빵집=market/tavern + 빵 상자, 도서관=church + 책·책장, 대장간=blacksmith + 통·목재, 호숫가=물·연꽃·벤치, 어귀=길 끝·울타리·텐트, 기억의 문=tower_base/wall_straight_gate. 빈 곳은 나무·바위·덤불·꽃으로 풍성하게.

## 이동·상호작용

- 바닥 탭 → 걸을 수 있는 헥스로 BFS 경로 이동. 캐릭터·NPC 탭 → 그 옆 칸까지 걸어간 뒤 대화 시작.
- 진행 가능한 대상 머리 위에 느낌표 표식. 아직 갈 수 없는 대상은 탭해도 짧은 혼잣말만.

## 흐름과 측정 문항 배치

| 단계 | 어디서 | 문항 |
| --- | --- | --- |
| 프롤로그 | 시작 시 어귀에서 자동 | `prologue_01~03` (ink) |
| 에피소드 X (A·B·C·D 중 자유 순서) | X에게 말 걸기 → X의 1~3번 문항 → X의 퀘스트 NPC에게 가기 → 4~5번 → X에게 돌아가기 → 6번 | `<npc>_01~06` (A는 ink `ep_lumi`, 나머지는 일반 문항 장면) |
| 막간 n (에피소드 1·2·3번째 뒤) | 호숫가 표식으로 걸어가기. 막간을 마쳐야 다음 공략 캐릭터가 열림 | `interlude_n_01~02` |
| 축제 | 네 에피소드 후 광장에 A·B·C·D 모임 | `festival_01~05` |
| 기억의 문 | 축제 후 문 표식 | 타이브레이커 4 |
| 결과 | 문을 지나면 오버레이 | `score()` |

- 퀘스트 NPC 짝: A→`s1j2`, B→`v1j2`, C→`t1p2`, D→`s2j2`. 코드 규칙: [특성 기호 s·t·u·v·w][순번][퀘스트 종류 j 심부름·m 딜레마·p 퍼즐][단계 수]. 플레이어에게는 그냥 이름처럼 보인다.
- 측정 선택 직후 반응, 선택 즉시 저장, 결과 화면 규칙은 1차 계약서와 같다(`docs/design/prototype-contract.md`).
- 화면 이름: 공략 캐릭터는 `A`·`B`·`C`·`D`(프로토타입 임시), 퀘스트 NPC는 코드 그대로.
