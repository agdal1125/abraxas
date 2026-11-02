# 루미 소품 제작 근거

2026-11-02. 기존 환경 `PartBuilder`와 dream-v2 팔레트를 이용해 기본 도형으로 새로 만들었다. 외부 모델·이미지·생성 이미지를 사용하지 않았다. 공통 원본은 [제작 스크립트](build_resident_props.py)이며 세 주민을 함께 재생성한다. 모카의 [제작 방식](../../moka-errand/build_moka_props.py)과 동일한 GLB 내보내기·색 재임포트 검증을 사용한다. 생성 파일은 `assets/_generated/residents-errands/lumi/`, 배포 후보는 `client/public/assets/abraxas/environment/prop-lumi-*.glb`에 있다.

책상·받침은 기존 `bench`, `prop-moka-dropoff`를 제안한다. 안내문은 공연 카드·엽서 역할에도 재사용하고, 재료 묶음과 악보는 선택별 역할 표시를 W가 붙인다. 메타데이터의 좌표는 glTF Y-up, 바닥 중심 원점이다. 새 물체는 충돌 없음으로 제안하며 받침에 올려 배치할 때 표면 높이를 W가 정한다. 최대 700 triangles·40,960 bytes는 모카 소품과 같은 예산이다. 미리보기는 후보 검토용이며 실제 캐릭터 부착과 게임 크기 가독성은 미검증이다.
