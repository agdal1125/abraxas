# T018-P3-d 길과 지면

먼저 `docs/tasks/T018-P3-faceted-direction.md`를 읽는다. 셸 읽기는 자유롭다. 커밋·push 금지.

쓰기: `assets/source/environment/build_terrain.py`, `terrain.blend`, `asset-metadata.json`, `provenance.md`, `assets/source/previews/environment/terrain.png`, `client/public/assets/abraxas/environment/terrain.glb`. 소품 배치가 꼭 필요하면 `content/world/village.json`.

## 감독이 본 문제

나무와 건물은 각지고 선명해졌는데 지면만 번진 민트색이다. 길은 가장자리가 수채화처럼 번지고 끝이 얼룩으로 사라진다. 소품이 지면 위에 뜬 것처럼 보인다.

## 할 일

1. **길을 또렷하게.** 번지는 그라데이션 대신 길과 풀의 경계를 면으로 끊는다. 길 경계를 따라 삼각형 변이 놓이게 하고, 정점 색 혼합 대신 면 단위 색을 쓴다. 경계는 직선이 아니라 각진 불규칙한 형태로 한다. 이 처리는 시제품 구간뿐 아니라 **마을의 모든 길**에 적용한다. 지금 빵집 입구 앞 번진 얼룩도 같은 방식의 작은 앞마당으로 고친다.
2. **지면 색을 재료답게.** 민트색 대신 자연스러운 풀색으로 바꾼다. 인물과 나무보다 채도를 낮게 둔다. 길은 흙 황토색, 면마다 명도 차이를 조금 준다. 큰 풀 얼룩을 면 단위로 만들고, 아주 작은 얼룩은 넣지 않는다. 플랫 셰이딩으로 낮은 기복이 보이면 좋지만 지형 높이를 크게 바꿔 충돌이나 소품 접지를 깨면 안 된다.
3. **섬 가장자리와 물.** 해안과 절벽 단면이 같은 표현으로 보이게 한다. 절벽 색의 띠가 파스텔이면 흙·돌 색으로 바꾼다. 물은 `client/src`가 그리는 범위이면 건드리지 말고 보고만 한다.

예산: 30,000삼각형·1MiB 이하, 재질 1, 텍스처 0. 삼각형이 부족하면 잔디 격자 내부를 성기게 하고 길 경계에 쓴다. 보이는 길과 통행 가능 구역이 어긋나면 안 된다.

## 검사

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`, `npm --prefix client test`, `npm --prefix client run build`, `npm --prefix client run check:size`. 한국어로 삼각형·바이트 전후, 검사 결과, 끝내지 못한 항목, 미확인 항목을 보고한다.
