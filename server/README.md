# server

## ER1-E Firebase 연결

Firestore 저장과 Firebase 익명 인증·App Check가 연결되어 있다. 운영에 사용하기 전에는 아래 승인이 필요하다. `ABRAXAS_STORE=firestore`, `GOOGLE_CLOUD_PROJECT`와 ADC를 사용한다. 에뮬레이터에서는 데모 프로젝트와 `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`를 지정한다. App Check 생략은 루프백에서만 허용된다.

추가 의존성: Firebase Admin Go SDK v4.22.0은 ID 토큰과 App Check 검증, Firestore Go 클라이언트 v1.29.2는 원자적 서버 저장, Firebase Web SDK v13.1.0은 익명 인증과 App Check에 사용한다. 자세한 근거는 `docs/adr/0006-firebase-backend.md`에 있다.

대안인 메모리 저장소는 재시작과 다중 인스턴스에서 기록을 보존하지 못한다. 토큰 검증을 직접 구현하면 보안 검증과 유지보수 부담이 커지고, 클라이언트의 Firestore 직접 접근은 서버 권위 경계에 맞지 않는다. Firebase CLI v15.34.2는 로컬 에뮬레이터 실행에만 쓰는 루트 개발 의존성이다.

### 에뮬레이터 실행

Java 21 이상과 루트 npm 의존성이 필요하다. 저장소 루트에서 `node scripts/test-firestore-emulator.mjs`로 Firestore 통합 테스트를 실행한다. `npm run e2e:play -- --emulators ko` 또는 `en`은 Auth·Firestore 에뮬레이터, 서버와 브라우저를 실행하며 캡처는 기본적으로 `.e2e/<언어>`에 저장한다. `JAVA_HOME`을 우선하고 Windows에서는 지정된 Java 21 설치 경로를 대안으로 사용한다. 데모 실행은 상속된 Firebase·Google 설정을 제거하고 `demo-abraxas`만 사용한다. Vite 환경 파일이 있으면 읽지 않고 실행을 중단한다. App Check는 루프백에서만 생략하며 디버그 토큰을 자동으로 활성화하지 않는다.

### 운영 배포 전 사람 승인

- Firebase 프로젝트와 익명 인증 및 App Check 공급자 설정을 확인한다.
- Cloud Run 서비스 계정의 최소 권한, Firestore 규칙과 Hosting 연결을 검토한다.
- 운영 도메인, 보안 헤더, 환경 변수 및 비밀값 관리 방식을 확인한다.
- 인증·저장·재시도와 배포 절차를 검증하고 배포를 별도로 승인한다.

스테이징 절차는 `docs/design/staging-deploy.md`에 있다.

## ER1 서버 저장 경계

`POST /v1/plays`, `GET /v1/plays/current`, `GET /v1/plays/{playId}`, `POST /v1/plays/{playId}/commands`는 `docs/design/moka-errand-api.md` 계약을 사용한다. 서버가 선택 순서와 심부름 전이를 판정하고, 상태·영수증·완료 사건을 같은 저장 갱신에서 처리한다. 모카 완료 명령은 완료 화면 정보와 함께 다음 막간 또는 축제 구간으로 진행한다.

기본 메모리 저장소는 재시작하면 기록이 사라지며 여러 인스턴스에서 공유되지 않는다. Firebase 연결의 운영 설정과 브라우저 통합 검증은 남아 있다. `Store.Update` 콜백은 Firestore 트랜잭션에서 재실행될 수 있으므로 외부 동작 없이 상태만 갱신해야 한다.

서버는 `ABRAXAS_CONTENT_DIR`에서 콘텐츠를 읽고 `ABRAXAS_CONTENT_VERSION`으로 지정한 빌드 버전을 회차에 고정한다. 버전 해시의 생성과 클라이언트 빌드 주입은 ER1-E 담당이다. 버전이 없거나 콘텐츠가 없으면 서버가 시작하지 않는다. 로컬에서만 `ABRAXAS_BIND_ADDR=127.0.0.1:8080`, `ABRAXAS_DEV_FAKE_AUTH=1`, `ABRAXAS_DEV_SKIP_APP_CHECK=1`을 지정하면 `Bearer dev-<uid>`를 사용할 수 있다. 개발 인증이나 App Check 생략을 켠 상태에서 루프백 이외의 주소를 사용하면 시작이 실패한다.

Abraxas Go API 서버 (Cloud Run 배포 대상). 표준 라이브러리 `net/http`를 중심으로 구성한다.

## 컨테이너 빌드와 콘텐츠 버전

저장소 루트를 빌드 컨텍스트로 사용한다. `server/`를 컨텍스트로 지정하면 런타임 콘텐츠가 빠진다.

```text
docker build -f server/Dockerfile -t abraxas-api .
node --input-type=module -e "import { contentVersion } from './scripts/content-version.mjs'; console.log(contentVersion(process.cwd()))"
```

같은 커밋과 콘텐츠로 클라이언트를 빌드하고, 위 명령의 해시를 서버 런타임의 `ABRAXAS_CONTENT_VERSION`에 지정한다. 클라이언트 Vite 빌드는 같은 함수로 버전을 주입한다. 콘텐츠가 바뀌면 이미지와 클라이언트를 같은 버전으로 다시 빌드해 함께 맞춘다. 실행 이미지는 서버가 읽는 점수 및 네 심부름 JSON을 `/content`에 포함하고 `ABRAXAS_CONTENT_DIR=/content`를 사용한다. 버전이 다르면 클라이언트는 회차를 적용하지 않는다. 운영 환경 설정과 배포는 별도 승인 절차를 따른다.

## 구조

- `cmd/api/`: 서버 진입점 (`PORT` 환경변수 기본값 `8080`, `log/slog` JSON 로거, graceful shutdown)
- `internal/http/` (패키지 `httpapi`): 라우터(`GET /healthz`), 미들웨어(패닉 복구, 요청 로그, 요청 타임아웃, 본문 64KB 제한, ID 토큰 검증), JSON 헬퍼

## 로컬 실행 (`server/` 디렉터리 기준)

```text
go run ./cmd/api
```

서버가 뜨면 `http://localhost:8080/healthz` 요청 시 `200 {"status":"ok"}`를 반환한다.
포트를 바꾸려면 실행 환경의 `PORT` 환경변수를 설정한다 (서버는 `.env` 파일을 읽지 않는다).

## 테스트 및 정적 검사 (`server/` 디렉터리 기준)

```text
gofmt -l .
go vet ./...
go test ./...
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
```

## 규칙

- `.agents/rules/backend-go.md`
- `.agents/rules/security.md`
- `.agents/rules/cross-platform.md`
