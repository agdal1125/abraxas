# server

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
