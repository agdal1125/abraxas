# server

## ER1 서버 저장 경계

`POST /v1/plays`, `GET /v1/plays/current`, `GET /v1/plays/{playId}`, `POST /v1/plays/{playId}/commands`는 `docs/design/moka-errand-api.md` 계약을 사용한다. 서버가 선택 순서와 심부름 전이를 판정하고, 상태·영수증·완료 사건을 같은 저장 갱신에서 처리한다. 모카 완료 명령은 완료 화면 정보와 함께 다음 막간 또는 축제 구간으로 진행한다.

현재 저장소는 프로세스 안의 메모리만 사용하므로 재시작하면 기록이 사라지며 여러 인스턴스에서 공유되지 않는다. Firebase ID 토큰과 App Check의 실제 검증기, Firestore 구현 및 배포용 콘텐츠 포함은 ER1-E에서 연결해야 한다. 검증기가 없으면 API는 인증 또는 App Check를 거부한다. `Store.Update` 콜백은 Firestore 트랜잭션에서 재실행될 수 있으므로 외부 동작 없이 상태만 갱신해야 한다.

서버는 `ABRAXAS_CONTENT_DIR`에서 콘텐츠를 읽고 `ABRAXAS_CONTENT_VERSION`으로 지정한 빌드 버전을 회차에 고정한다. 버전 해시의 생성과 클라이언트 빌드 주입은 ER1-E 담당이다. 버전이 없거나 콘텐츠가 없으면 서버가 시작하지 않는다. 로컬에서만 `ABRAXAS_BIND_ADDR=127.0.0.1:8080`, `ABRAXAS_DEV_FAKE_AUTH=1`, `ABRAXAS_DEV_SKIP_APP_CHECK=1`을 지정하면 `Bearer dev-<uid>`를 사용할 수 있다. 개발 인증이나 App Check 생략을 켠 상태에서 루프백 이외의 주소를 사용하면 시작이 실패한다.

Abraxas Go API 서버 (Cloud Run 배포 대상). 표준 라이브러리 `net/http`를 중심으로 구성한다.

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
