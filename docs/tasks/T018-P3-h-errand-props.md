# T018-P3-h 심부름 소품을 같은 표현으로

먼저 `docs/tasks/T018-P3-faceted-direction.md`를 읽는다. 셸 읽기는 자유롭다. 커밋·push 금지. Blender 빌드를 실제로 실행하고 프리뷰를 직접 본다.

쓰기: `assets/source/moka-errand/`, `assets/source/residents-errands/`, `assets/source/previews/`의 해당 프리뷰, `client/public/assets/abraxas/`의 해당 소품 GLB. 다른 작업자가 지형을 동시에 고치므로 `assets/source/environment/`는 **읽기만** 한다. `content/`, `client/src`는 쓰지 않는다.

대상: `prop-moka-*`, `prop-lumi-*`, `prop-echo-*`, `prop-or-*` 전부. 감독이 본 문제: 빵집 앞 진열대와 탁자가 옅은 파스텔로 남아 새 환경에서 튄다.

## 지시

- 목재는 환경 소품(`bench`, `bread-crate`)과 같은 붉은 갈색 부재로, 플랫 셰이딩(`use_smooth=False`), 둥근 베벨 최소.
- 이 소품들은 **퍼즐과 진행에 쓰인다.** 서로 구별돼야 하는 것은 형태로 구별되게 유지한다. 원·삼각형·사각형 조각, 세 가지 빵, 비어 있는 통과 모래 든 통은 게임 크기에서 지금처럼, 또는 더 잘 구별돼야 한다. 진행 표시용 색 차이가 있으면 유지한다.
- 파일 이름, 노드 이름, 원점, scale, 충돌, 메타데이터 계약을 바꾸지 않는다. 코드가 노드 이름을 참조하면(`moka-props.ts`, `resident-props.ts`) 먼저 확인하고 그대로 둔다.
- 선택지의 정답을 암시하는 색이나 강조를 넣지 않는다.
- 삼각형·용량은 기존 상한 안에 둔다. 공유 팔레트 값을 바꾸지 않고 필요한 색은 소품 생성기 안에 둔다.

끝내지 못할 것 같으면 `prop-moka-*`부터 처리하고 남은 것을 보고한다.

## 검사

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`, `npm --prefix client test`. 한국어로 대상별 삼각형·바이트 전후, 끝내지 못한 대상, 미확인 항목을 보고한다.
