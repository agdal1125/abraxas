# ER1-E 인계 · 2026-11-02

- 작업 경로: `C:\Users\jake1\.codex\worktrees\016b\er4-env`; 최초 HEAD: `aef0bfbd1e4cf19e67e59eaa50278e51f463a07e`, 부모의 main 통합 후 현재 HEAD: `9e7ad73c8977a205519d3c7c310346c49487f253`, 브랜치 `codex/firebase-er1e`. 원본 `C:\Users\jake1\Desktop\abraxas\.claude\worktrees\er4-env`은 수정하지 않았다. 이 작업자는 커밋·push·병합·배포를 하지 않았다. 사용자 지시상 agy Argon4의 429 한도에 따른 `gpt-6.1-terra` xhigh 대체 작업이며 실행 모델 설정은 별도 검증하지 못했다.
- 기존 초안은 Firebase SDK를 동적으로 불러오고 Firestore 트랜잭션으로 상태·영수증·완료 사건을 저장한다. 로그인 실패 Promise가 계속 재사용되어 일시 장애 뒤에도 복구할 수 없었다. 실패한 초기화 캐시를 비우고 에뮬레이터 중복 연결은 막았다. App Check 디버그 토큰 자동 활성화는 제거했다.
- E2E는 최초 `GET http://127.0.0.1:5173/v1/plays/current` 404만 새 플레이어의 예상 응답으로 취급한다. 같은 요청의 후속 404, 다른 메서드·주소, 생성 후 404와 그 밖의 HTTP 오류는 실패이며 메서드·URL·상태를 보고한다. Three.js의 `KHR_parallel_shader_compile` 미지원 콘솔 경고만 정확히 분리하고 다른 콘솔 오류·경고, 비정상 프로세스 종료와 네트워크 오류는 실패로 처리한다. 데모 자식 프로세스의 상속 Firebase·Google 설정을 제거하고 데모 값과 로컬 XDG 경로를 사용한다.
- 변경 파일: `client/src/main.ts`, `client/src/net/select-auth.ts`와 테스트, `client/.env.example`, `scripts/e2e-play.mjs`와 테스트, `scripts/test-firestore-emulator.mjs`, `server/internal/store/firestore_transaction_test.go`, `server/README.md`, `docs/adr/0006-firebase-backend.md`, 이 문서. Firebase 서버 검증기와 Firestore 구현은 유지했다. 의존성·측정 데이터 변경은 없다.
- 기존 의존성의 이유: Firebase Web은 익명 인증·App Check, Firebase Admin Go는 서버 토큰 검증, Firestore Go는 원자적 영속 저장, firebase-tools는 로컬 에뮬레이터다. 버전과 대안은 ADR-0006에 기록했다.

## 검증

- 이번 후속 작업에서 통과: 클라이언트 `npm run typecheck`, `npm test` 77개, `npm run build`, `npm run check:size`; 스크립트 `node --test scripts/e2e-play.test.mjs` 4개. 최초 인증 요청 전 인증 지연, 실패 후 재시도와 App Check를 단위 테스트했다. 이전 작업에서 서버 `gofmt -l` 변경 파일 출력 없음, `go vet ./...`, `go test ./...` 통과. 실패한 Firestore 커밋에서 상태·사건·영수증 보존도 검증했다.
- Firestore 에뮬레이터 테스트 통과: 원본의 읽기 전용 firebase-tools 실행 파일을 사용해 이 작업본 서버 소스에서 `go test ./internal/store/... -run Emulator -count=1`을 실행했다. 데모 프로젝트와 로컬 XDG를 사용했으며, 재시도·동일 리비전 경쟁·중복 완료·응답 유실 후 영수증 복구를 확인했다. CLI는 원격 설정 조회 실패를 경고했지만 에뮬레이터 테스트는 통과했다.
- 이전에 `node scripts/test-firestore-emulator.mjs`는 작업본 루트의 firebase-tools 부재로 실행되지 않았다. 부모가 의존성을 복원한 뒤 Java 21의 `JAVA_HOME`을 지정해 해당 스크립트 통과를 보고했다. 부모는 `govulncheck`에서 호출된 취약점 0건과 미호출 모듈 취약점 3건도 보고했다. 이 후속 작업에서 에뮬레이터와 `govulncheck`는 다시 실행하지 않았다. `.staging/`에 이전 검사 캐시가 남아 있다.
- 이전 격리본 ko E2E는 포트 충돌과 GPU·CDP 오류로 실패했다. 부모가 별도로 보고한 새 main ko E2E는 148단계에서 결과에 도달했다. 이 후속 작업에서는 지시에 따라 브라우저·E2E 실행이나 포트 바인딩을 하지 않았다. 부모가 수정 후 ko/en과 Auth+Firestore, 실제 시작 네트워크 요청을 검증해야 한다.
- 부모의 에뮬레이터 E2E는 Firestore 준비 확인 경로가 404를 반환해 시간 초과됐다. 부모가 별도 확인한 루트 `http://127.0.0.1:8081/`은 200이므로 준비 확인 주소를 루트로 수정했다. 문서 경로는 deny-all 규칙에 따라 보호되며 시간 제한은 바꾸지 않았다. 수정 후 전체 E2E는 부모가 재실행한다.
- 부모의 수정 후 ko 에뮬레이터 E2E는 143단계에서 결과에 도달했으나 Vite가 전달한 Three.js 경고, Edge 진단, favicon 404로 실패했다. 또한 인증 대기 중 자동화가 마을 상호작용을 직접 호출해 순서가 어긋났다. 자동화가 탐색·마을 입력 가능 상태를 확인하고 대기·재연결 실패를 제한 시간 안에 보고하도록 수정했다. 정확히 일치하는 Vite 경고와 Edge fallback 진단만 경고로 분류하고 브라우저 확장을 비활성화했다. 데이터 favicon으로 불필요한 요청을 제거했다. 이 수정 후 스크립트 테스트 6개는 통과했으며 브라우저 E2E는 부모가 재검증한다.
- 부모의 최신 에뮬레이터 E2E에서 ko는 145단계로 통과했고, en은 163단계에서 결과에 도달했지만 임시 브라우저 프로필 정리의 EPERM으로 실패했다. 생성된 임시 디렉터리만 Node의 제한된 재시도로 정리하도록 수정했으며 최종 실패는 계속 보고한다. en 재검증은 부모가 수행한다.
- 이 작업자의 이전 `govulncheck ./...` 시도는 실행 파일 부재로 실패했으며 이후 부모가 검사를 수행했다. 배포 빌드는 Pretendard CSS의 빌드 시 미발견 및 큰 청크 경고를 출력했다.

## 크기와 통합 주의

- 부모 제공 main `271be63` 기준 초기 JS 968.17 kB / gzip 252.39 kB, `check:size` 6.88 MiB. main 통합 후 수정 전은 971.20 kB / gzip 253.73 kB였고, 인증 선택 지연 후 969.88 kB / gzip 253.11 kB, `check:size` 7.04 MiB다. 두 배포 파일을 같은 Node gzip 설정으로 직접 측정하면 기준 968,171바이트 / gzip 250,606바이트, 현재 969,889바이트 / gzip 251,316바이트다. `client/public`, `content`, `assets`의 추적 파일은 기준과 동일하다. 초기 JS는 기준보다 1,718바이트 / gzip 710바이트 커서 크기 증가 금지 조건이 미충족이다. HTML과 빌드 코드는 인증 청크를 첫 토큰 요청에서만 호출하지만 브라우저 네트워크 실측은 남았다. 공유 메모리와 개발 일지는 부모 담당이다.
- 추가 측정: Vite `build.modulePreload: false`와 `build.modulePreload: { polyfill: false }`는 모두 초기 JS 969,357바이트 / Node gzip 250,943바이트였다. 기준보다 각각 1,186바이트 / 337바이트 커서 두 설정 모두 유지하지 않았다. 전자는 청크 의존성 사전 로딩을 꺼 첫 인증 시 요청이 더 순차화될 수 있고, 후자는 네이티브 modulepreload 미지원 브라우저의 폴리필을 제거한다. Vite가 빈 사전 로딩 목록에도 동적 import 보조 코드를 남기는 점을 설치된 구현에서 확인했다. 기본 설정으로 되돌린 뒤에도 크기 조건 해결이 필요하다.
## 감독 최종 로컬 검증 · 2026-11-03

- 부모 Astra가 직접 실행한 Auth·Firestore 에뮬레이터 E2E는 ko 145단계, en 159단계에서 결과 화면 도달 및 종료 코드 0이었다. 두 실행 모두 errors 0건, 예상 밖 HTTP 응답 0건이다. 증거는 `.e2e/orchestrator-firebase-ko/run.log`, `.e2e/orchestrator-firebase-en/run.log`이며 이 로컬 경로는 저장소에 배포하지 않는다. 이전 실패의 캡처가 ko 폴더에 함께 남아 있어 최종 run.log를 기준으로 판정한다.
- 배포 빌드 시작 화면의 실제 네트워크 요청에서 인증 선택 및 Firebase 청크 요청은 없었고 오류도 없었다. `.e2e/firebase-production-startup.json`과 화면 캡처로 확인했다.
- 부모 실행: 클라이언트 typecheck·77개 테스트·build·check:size, E2E 하네스 6개 테스트, 기존 reach 32/32·assets·visible-names, 서버 gofmt·vet·test, Firestore 에뮬레이터 스크립트 통과. govulncheck는 호출된 취약점 0건, 미호출 모듈 취약점 3건을 보고했다.
- 초기 JS +1,718바이트(gzip +710바이트)는 요청된 증가 없음 조건을 충족하지 못한다. 사용자에게 해당 증가량 허용 여부를 물었으며 답변 전에는 main에 병합하지 않는다. HTML은 데이터 favicon으로 38바이트 늘었다. SDK 지연 로딩과 초기 용량 조건은 별도 판정이다.
- 구현자는 workspace-write를 유지했고 부모는 사용자가 허용한 로컬 검증·저장소 관리 범위에서 실행했다. 원래 자동 승인 거부의 정확한 원인은 확인하지 못했으나 Codex 기본 managed worktree에서 동일 편집은 가능했다. 전역 설정·ACL 변경, 비밀값 읽기, 운영 배포는 하지 않았다.
