# 오르 소품 제작 근거

2026-11-02. 기존 환경 `PartBuilder`와 dream-v2 팔레트를 이용해 기본 도형으로 직접 만든 소품이다. 외부 모델·이미지·생성 이미지를 사용하지 않았다. 공통 원본은 [제작 스크립트](../lumi/build_resident_props.py)이며 모카와 같은 GLB 내보내기·색 재임포트 검증을 사용한다. 생성 파일은 `assets/_generated/residents-errands/or/`, 배포 후보는 `client/public/assets/abraxas/environment/prop-or-*.glb`에 있다.

빈 양동이와 모래를 채운 양동이는 상태별로 교체한다. 세 톱니는 중심의 동그라미·세모·네모로 구분한다. 시계 작업판과 등불 도면은 독립 모델이다. 기존 `tool-rack`, `prop-moka-dropoff`를 재사용 대상으로 제안한다. 원점은 glTF Y-up 바닥 중심, 충돌 없음, 최대 700 triangles·40,960 bytes다. 손잡이와 도구의 캐릭터 부착, 월드 충돌 및 실제 화면 크기는 통합 뒤 확인해야 한다.
