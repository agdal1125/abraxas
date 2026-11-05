# T018-P2 5단계: 빵집 지붕·굴뚝과 생성기 정리

사람 지시: "한 화면 더 다듬기". 사람 결정과 금지 사항은 `docs/tasks/T018-P2-bakery-prototype.md`, 판정 규칙은 `docs/art/immersion-policy.md` 4절이다. 셸 읽기는 자유롭다. 커밋·push 금지. 현재 게임 화면은 `docs/reviews/immersion/P2/after-bakery-844.jpg`다.

쓰기: `assets/source/environment/`, `assets/source/previews/environment/`, `client/public/assets/abraxas/environment/bakery.glb`, `content/world/village.json`(겹침 해결에 필요할 때만). `client/src`와 지형은 쓰지 않는다.

## 할 일

1. **선택 빌드가 작업 원본을 지우는 문제를 먼저 고친다.** `ABRAXAS_ENV_TARGETS`로 일부만 빌드하면 `build_environment.py` 끝의 `save_as_mainfile`이 `environment_kit.blend`를 그 일부만 든 파일로 덮어쓴다. 일부만 빌드할 때도 원본에서 해당 자산만 갱신해 나머지가 남게 하거나, 그것이 어려우면 일부 빌드에서는 저장하지 않게 한다. 실제 동작을 빌드로 확인한다. 지금 빵집이 옛 버전인 `environment_kit.blend`도 새 빵집이 들어가게 맞춘다. 다른 자산의 GLB는 바꾸지 않는다.
2. **납작한 판 지붕을 지붕답게 고친다.** 지금 지붕은 넓은 단색 슬래브라 블록처럼 보인다. 생성기의 `add_prism_roof`를 써서 경사 지붕으로 바꾼다. 처마 두께와 아랫면 명암으로 벽과 구분하고, 게임 화면에서 2px 이상 읽히는 큰 기와 구획을 몇 줄 넣는다. 정점 색으로 칸마다 명도를 조금씩 달리한다. 다른 집과 같은 재질 수를 유지한다.
3. **화분 같은 굴뚝을 고친다.** 지금은 지붕 위 붉은 원통이 커서 화분처럼 보인다. 지붕 크기에 맞게 줄이고, 벽돌 띠나 윗단 테두리로 굴뚝으로 읽히게 한다. 위치는 지붕 경사에 맞춘다. 연기 입자는 넣지 않는다.
4. **겹침을 확인한다.** 오른쪽 빵집 `prop-10`과 옆의 보라색 건물이 게임 화면에서 겹쳐 보인다. 실제로 충돌 영역이나 모델이 겹치는지 좌표로 확인하고, 겹치면 도달성을 유지하며 `prop-10`을 옮기거나 돌린다. 시점상 앞뒤로만 겹치는 것이면 그대로 두고 그렇게 보고한다.

예산: 빵집 5,000삼각형·180KiB 이하, 재질 수 증가 0, 텍스처 추가 0. 3/4 쿼터뷰 프리뷰를 직접 보고 "블록 위에 판을 얹은 모양"이 아닌지 판정한다. 불합격이면 다시 고친다.

## 검사

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`. 한국어로 바꾼 것, 생성기 수정 방식과 확인 결과, 겹침 판정, 삼각형·바이트, 미확인 항목을 보고한다.
