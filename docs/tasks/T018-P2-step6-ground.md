# T018-P2 6단계: 길 가장자리와 지면 질감

사람 지시: "한 화면 더 다듬기". 사람 결정과 금지 사항은 `docs/tasks/T018-P2-bakery-prototype.md`, 판정 규칙은 `docs/art/immersion-policy.md` 4절의 '지면·길', '지면 질감', '소품 반복'이다. 셸 읽기는 자유롭다. 커밋·push 금지. 앞 단계가 빵집을 이미 고쳤으니 빵집은 건드리지 않는다.

쓰기: `assets/source/environment/build_terrain.py`, `assets/source/environment/terrain.blend`, `assets/source/environment/asset-metadata.json`, `assets/source/environment/provenance.md`, `assets/source/previews/environment/terrain.png`, `client/public/assets/abraxas/environment/terrain.glb`, `content/world/village.json`.

## 감독이 본 원인

지면은 간격 0.5 격자의 정점 색으로 칠해진다(`build_terrain.py`). 그래서 길 가장자리가 번져 보이고, 빵집 입구 앞에는 뿌옇게 번진 얼룩이 생긴다. 잔디는 넓은 단색이다.

## 할 일

1. **길 가장자리를 또렷하게.** 번짐을 줄인다. 빵집 앞 시제품 구간의 길 경계를 따라 정점을 넣는 방식을 먼저 검토한다(격자 전체를 촘촘히 하지 않는다). 가장자리는 완전한 직선이 아니라 손으로 칠한 듯 살짝 물결치는 형태가 좋다. 다른 구간이 함께 나아져도 되지만 나빠지면 안 된다.
2. **지면에 세 층을 만든다.** 정책대로 넓은 풀 색면, 밟힌 길, 건물과 나무 밑 접촉부가 구별되게 한다. 잔디에 크고 부드러운 명도·색 얼룩을 넣는다. 작은 노이즈를 뿌리지 않는다. 이동 중 반짝이면 안 된다. 입구 앞 번진 얼룩은 발에 닳은 작은 앞마당처럼 읽히게 고친다. 건물 기단 둘레에 어두운 접촉부를 넣는다.
3. **길가를 조금 채운다.** 시제품 구간의 굽이 바깥쪽과 길 가장자리에 기존 풀·돌·꽃 애셋으로 작은 군집 2~3곳을 놓는다. 새 애셋은 만들지 않는다. 통행 중심은 비우고 군집 소품에 충돌이 있으면 길을 막지 않게 한다. 같은 소품·크기·방향이 3개를 넘지 않게 한다.

인물은 환경보다 선명해야 한다. 지면 채도를 올려 인물을 묻지 않는다. 예산: 지형 30,000삼각형·1MiB 이하, 재질 1, 텍스처 추가 0.

`terrain.png`를 직접 보고 판정한다. 불합격이면 고친다.

## 검사

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`, `npm --prefix client test`, `npm --prefix client run build`, `npm --prefix client run check:size`. 한국어로 바꾼 것, 삼각형·바이트 전후, 추가한 소품 ID, 검사 결과, 다른 구간에 미친 영향, 미확인 항목을 보고한다.
