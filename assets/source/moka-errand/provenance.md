# 모카 심부름 소품 출처

- 2026-11-02, Codex가 Blender에서 기하 도형으로 직접 제작한 오리지널 소품이다. 외부 모델이나 이미지 생성 결과는 사용하지 않았다.
- 제작 스크립트는 `build_moka_props.py`이며 기존 환경 키트의 PartBuilder와 dream-v2 팔레트, 단일 색공간 변환·AO·Draco 내보내기·재임포트 색 검증을 재사용한다.
- 기존 `bread-crate`는 상자와 빵이 하나의 메시로 결합되어 있다. 제작 소스의 개별 도형은 확인했지만 상자를 분해하거나 기존 파일을 재생성하지 않고, 운반과 진열용 모델을 새로 제작했다.
- 미리보기는 시각 검수 후보이다. 실제 캐릭터 부착, 화면 크기, 월드 충돌과 가림은 통합 후 확인해야 한다.


## 소품 예산 근거

- `prop-moka-basket`: 기존 `bread-crate`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-display`: 기존 `bread-crate`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-bread-round`: 기존 `bread-crate`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-bread-long`: 기존 `bread-crate`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-bread-flower`: 기존 `bread-crate`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-dropoff`: 기존 `bread-crate`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-ledger`: 기존 `book-stack`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-plate`: 기존 `barrel`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
- `prop-moka-mold`: 기존 `barrel`와 같은 소품 등급으로 최대 700 triangles, 40,960 bytes.
