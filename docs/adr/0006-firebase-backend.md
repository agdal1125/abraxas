# ADR-0006: Firebase 백엔드 의존성

- 상태: 검토 중 (2026-11-02). 운영 배포는 이 문서로 승인되지 않는다.

## 결정과 대안

| 의존성 | 잠금 버전 | 이유 | 대안 |
| --- | --- | --- | --- |
| Firebase Admin Go | 4.22.0 | 서버의 Firebase ID 토큰 및 App Check 검증 | 직접 JWT·공개 키·토큰 정책을 구현하면 보안 유지 부담이 커진다. |
| Cloud Firestore Go | 1.29.2 | 서버의 트랜잭션과 지속 저장 | 인메모리 저장은 재시작 시 데이터가 사라진다. |
| Firebase Web | 13.1.0 | 익명 인증과 선택적 App Check 토큰 발급 | 인증 REST API 직접 구현은 세션·갱신 처리를 별도로 요구한다. |
| firebase-tools (개발 전용) | 15.34.2 | Auth·Firestore 로컬 에뮬레이터 | 운영 프로젝트를 테스트에 사용하면 격리가 어렵다. |

Web SDK는 서버 요청 시 동적 로드한다. 설치 디렉터리 크기는 이 환경에서 Firebase Web 37,763,673바이트, firebase-tools 6,103,939바이트이며 각각 전이 의존성은 제외한 디스크 크기다. 대체본을 적용한 임시 빌드에서 초기 JS는 970.65 kB(압축 253.50 kB), 기존 빌드는 967.67 kB(압축 252.16 kB)였고, 지연 로드 청크 네 개는 합계 171.13 kB(압축 50.92 kB)였다. 정적 에셋을 포함한 배포 빌드 크기는 별도로 측정해야 한다. Go 모듈과 서버 실행 파일의 증가분은 아직 측정하지 않았다. 디스크 크기는 전송량이 아니다.

Firestore 에뮬레이터에는 Java 21이 필요하다. 로컬 검증은 `demo-abraxas` 프로젝트만 사용하고 `node scripts/test-firestore-emulator.mjs`로 실행한다.

## 운영 승인

[운영 변경 승인 항목](../design/moka-errand-plan.md#사람-승인-필요인-환경-작업)을 따른다. 실제 프로젝트 설정, Firestore 규칙·IAM, Auth·App Check 등록, Cloud Run·Hosting 연결, 비밀값과 배포는 사람 승인 후 별도 진행한다.
