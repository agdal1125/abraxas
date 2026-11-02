# ADR-0006: Firebase 백엔드 의존성

- 상태: 검토 중 (2026-11-02). 운영 배포는 이 문서로 승인되지 않는다.

## 결정과 대안

| 의존성 | 잠금 버전 | 이유 | 대안 |
| --- | --- | --- | --- |
| Firebase Admin Go | 4.22.0 | 서버의 Firebase ID 토큰 및 App Check 검증 | 직접 JWT·공개 키·토큰 정책을 구현하면 보안 유지 부담이 커진다. |
| Cloud Firestore Go | 1.29.2 | 서버의 트랜잭션과 지속 저장 | 인메모리 저장은 재시작 시 데이터가 사라진다. |
| Firebase Web | 13.1.0 | 익명 인증과 선택적 App Check 토큰 발급 | 인증 REST API 직접 구현은 세션·갱신 처리를 별도로 요구한다. |
| firebase-tools (개발 전용) | 15.34.2 | Auth·Firestore 로컬 에뮬레이터 | 운영 프로젝트를 테스트에 사용하면 격리가 어렵다. |

2026-11-03 보안 수정: Firebase Web의 `@firebase/firestore` 4.19.0이 `@grpc/grpc-js` 1.9.x를 고정해 [GHSA-m9gg-hp2v-232j](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j)에 노출되므로 해당 하위 의존성만 1.14.7로 override한다. 클라이언트는 Firebase의 app·auth·app-check만 사용하며 Firestore의 Node 전송 코드는 브라우저 번들에 포함하지 않는다. 업스트림이 해당 pin을 취약하지 않은 버전으로 수정하면 override를 제거하고 lockfile과 감사를 다시 검증한다. 감독이 lockfile로 새로 설치하고 npm audit에서 취약점 0건, 실제 의존성 트리의 1.14.7 적용, 타입 검사·77개 테스트·빌드 통과를 확인했다. 브라우저 초기 엔트리와 청크 해시는 변경 전후 동일하다.

Web SDK는 첫 인증 요청 시 동적 로드한다. 2026-11-03에는 제목 화면에서 쓰지 않는 ink 대사 파서도 실제 대사 로딩 시 불러오도록 분리했다. 같은 Node gzip 설정으로 측정한 초기 JS는 이전 Firebase 빌드 969,889바이트 / gzip 251,316바이트에서 842,460바이트 / gzip 219,959바이트로 줄었다. 부모가 빌드한 main `271be63` 기준 968,171바이트 / gzip 250,606바이트보다 각각 125,711바이트 / gzip 30,647바이트 작다. 새 ink 청크는 127,088바이트 / gzip 31,090바이트이며 전체 `check:size`는 7.04 MiB다. HTML은 초기 JS와 CSS만 참조하고 빌드 코드의 ink import는 대사 로딩 경로에 있다. 부모가 수정 후 제목 화면의 실제 네트워크와 ko/en E2E를 검증해야 한다. 이전 초기 JS 증가에 관한 사용자 답변은 아직 받지 못했다. Go 모듈과 서버 실행 파일의 증가분은 측정하지 않았다.

Firestore 에뮬레이터에는 Java 21이 필요하다. 로컬 검증은 `demo-abraxas` 프로젝트만 사용하고 `node scripts/test-firestore-emulator.mjs`로 실행한다.

## 운영 승인

[운영 변경 승인 항목](../design/moka-errand-plan.md#사람-승인-필요인-환경-작업)을 따른다. 실제 프로젝트 설정, Firestore 규칙·IAM, Auth·App Check 등록, Cloud Run·Hosting 연결, 비밀값과 배포는 사람 승인 후 별도 진행한다.
