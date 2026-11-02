# 에코 소품 제작 근거

2026-11-02. 기존 환경 `PartBuilder`와 dream-v2 팔레트로 기본 도형을 조합한 오리지널 소품이다. 외부 모델·이미지·생성 이미지를 사용하지 않았다. 공통 원본은 [제작 스크립트](../lumi/build_resident_props.py)이며 모카와 같은 GLB 내보내기·색 재임포트 검증을 사용한다. 생성 파일은 `assets/_generated/residents-errands/echo/`, 배포 후보는 `client/public/assets/abraxas/environment/prop-echo-*.glb`에 있다.

단권 책은 그림책·기록철·수첩·전설집에 재사용한다. 책장 작업판은 식물·요리·별을 서로 다른 모양의 표식으로 나타낸다. 여섯 권의 개별 주제와 새/기존 배치 구분은 W와 UI가 표시해야 하며 이 GLB에 글자를 굽지 않았다. 기존 `book-stack`, `prop-moka-dropoff`를 재사용 대상으로 제안한다. 원점은 glTF Y-up 바닥 중심, 충돌 없음, 최대 700 triangles·40,960 bytes다. 실제 가독성과 위치는 월드 통합 뒤 검토해야 한다.
