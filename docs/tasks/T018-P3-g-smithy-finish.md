# T018-P3-g 대장간 앞 마무리

앞 작업이 모델 용량 오류로 끊겨 남은 부분이다. `docs/tasks/T018-P3-faceted-direction.md`를 따른다. 셸 읽기는 자유롭다. 커밋·push 금지.

쓰기: `content/world/village.json`, `assets/source/environment/build_terrain.py`, `terrain.blend`, `asset-metadata.json`, `assets/source/previews/environment/terrain.png`, `client/public/assets/abraxas/environment/terrain.glb`. 3번 때문에 표지판을 고칠 때만 `build_environment.py`와 `signboard` 산출물, `environment_kit.blend`.

1. **엉킨 소품을 푼다.** 대장간 앞 통나무들이 서로 뚫고 들어가 있고 공구대(`tool-rack`)와 엉켜 있다. 통나무는 겹치지 않게 나란히 쌓거나 2~3개를 간격을 두고 놓는다. 공구대는 대장간 작업터 쪽 벽 가까이에 혼자 세운다. 모델이 눕거나 관통한 것처럼 보이면 안 된다. 옮기기 전에 소품 ID 참조를 검색한다.
2. **길을 대장간 입구까지 잇는다.** 오르 쪽 길이 대장간 앞에서 둥글게 끝난다. 대장간의 열린 앞쪽까지 잇고, 입구 앞이 작은 앞마당처럼 읽히게 한다. 도서관 쪽 길 끝도 입구와 이어지는지 확인하고 끊겼으면 잇는다. 오르의 충돌이나 대화 위치를 막으면 안 된다.
3. **표지판.** 지금 판이 빈 나무판이라 표지판으로 덜 읽힌다. 게임 크기에서 보이는 짙은 가로 홈 2~3줄이나 작은 화살표 형태를 넣는다. 글자는 넣지 않는다.

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`, `npm --prefix client test`를 실행한다. 한국어로 옮긴 ID, 검사 결과, 끝내지 못한 항목을 보고한다.
