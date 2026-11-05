# T018-P3-a 나무·관목·바위·식생 다시 깎기

먼저 `docs/tasks/T018-P3-faceted-direction.md`를 읽는다. 셸 읽기는 자유롭다. 커밋·push 금지.

쓰기: `assets/source/environment/`, `assets/source/previews/environment/`, `client/public/assets/abraxas/environment/`의 아래 대상 GLB만. `client/src`, `content/`, 지형은 쓰지 않는다. 다른 작업자가 `client/src/scenes/village.ts`를 동시에 고친다.

## 대상

metadata에서 실제 asset 이름을 확인한다: 둥근 나무(`tree-round`), 다른 나무(침엽수 등), 관목(`bush`), 바위와 자갈(`pebbles`, 큰 바위가 있으면 포함), 풀(`grass-tuft`), 꽃(`flower-*`, `flower-bed`). 꽃이 `build_flowers.py`에 있으면 그것도 수정한다.

## 형태 지시

- **수관:** 낮은 분할의 다면체(아이코스피어 1~2단계 수준) 덩어리 2~4개를 겹치고 꼭짓점을 불규칙하게 밀어 각진 윤곽을 만든다. 면이 게임 화면에서 보일 만큼 커야 한다. 플랫 셰이딩(`use_smooth=False`), 덩어리마다 초록 명도를 달리하고 아랫면은 어둡게 한다.
- **줄기:** 위가 가늘어지는 6~8각 기둥, 붉은 갈색. 나무 종류마다 실루엣이 달라야 한다.
- **바위:** 불규칙하게 깎은 다면체, 회색 계열, 면마다 명도 차이. 보라색 돌은 회색으로 바꾼다.
- **풀·꽃:** 각진 잎, 작은 면으로 게임 크기에서 형태가 읽히게. 평면 스프라이트처럼 보이지 않게 한다. 꽃은 지금보다 작게 해도 된다. 인물보다 눈에 띄면 안 된다.
- **색:** 진한 재료 색. 팔레트를 새 이름으로 추가하고, 다른 대상이 쓰는 기존 팔레트 값은 바꾸지 않는다.

`ABRAXAS_ENV_TARGETS`로 대상만 빌드한다. 삼각형은 자산별 상한 안이고 가능하면 지금보다 줄인다. 충돌·원점·배치 ID는 바꾸지 않는다.

## 판정

프리뷰를 직접 본다. 불합격이면 다시 깎는다.

- 매끈한 구나 점토처럼 보이지 않고 각진 면이 보인다.
- 게임 크기(나무 약 100px)로 줄여도 면과 명암이 뭉개지지 않는다.
- 나무, 관목, 바위가 서로 다른 재료로 읽힌다.

## 검사

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`. 한국어로 대상별 삼각형·바이트 전후, 검사 결과, 미확인 항목을 보고한다.
