# T018-P3-i 끊긴 길 잇기

`docs/tasks/T018-P3-faceted-direction.md`를 따른다. 셸 읽기는 자유롭다. 커밋·push 금지. Blender 빌드를 실제로 실행한다.

쓰기: `content/world/village.json`의 길 데이터, `assets/source/environment/build_terrain.py`, `terrain.blend`, `assets/source/environment/asset-metadata.json`의 terrain 항목, `assets/source/previews/environment/terrain.png`, `client/public/assets/abraxas/environment/terrain.glb`. 다른 작업자가 심부름 소품을 동시에 고친다.

감독이 게임 화면에서 본 문제: 호숫가 길이 다리(`bridge`, -5, 8.7) 앞에서 끊겨 풀밭을 지나야 다리에 닿는다. 다리 양쪽 끝이 길과 만나게 잇는다. 정자(`lake-pavilion`, -8, 10.4)까지 다리 건너 이어지면 좋다. 물 위로 길을 그리지 않는다. 기억의 문(-9, -15.6) 앞 길이 문까지 이어지는지도 확인하고 끊겼으면 잇는다. 다른 길 끝 중 건물이나 다리로 이어지지 않고 풀밭에서 끝나는 곳을 찾아 목록으로 보고한다. 일부러 끝나는 곳이면 그대로 둔다.

길 표현은 지금 합격한 흙길 그대로다. 소품을 길 위로 옮기지 않는다.

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`를 실행하고 한국어로 고친 구간, 삼각형·바이트, 검사 결과를 보고한다.
