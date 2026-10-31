---
trigger: glob
globs: "server/**/*.go, server/go.mod, server/Dockerfile"
description: "Go API 서버(Cloud Run) 코드 규칙."
---

# 서버 규칙 (Go)

- Go 1.27.x. `go.mod`의 `toolchain`으로 고정한다.
- HTTP는 표준 라이브러리 `net/http`(메서드·경로 패턴 라우팅)로 작성한다. 웹 프레임워크를 추가하지 않는다.
- 허용 외부 모듈(추가 시 ADR 필요): Firebase Admin SDK(`firebase.google.com/go/v4`), Firestore 클라이언트(`cloud.google.com/go/firestore`), 그 의존성.
- 폴더:
  - `cmd/api/` 진입점
  - `internal/http/` 핸들러, 미들웨어(인증, 요청 크기 제한, 타임아웃, 로깅)
  - `internal/scoring/` 성향 재계산. `content/scoring/*.json`을 읽는다. 클라이언트와 같은 골든 테스트 케이스를 통과해야 한다.
  - `internal/ticket/` 초대권 발급·소모. Firestore 트랜잭션 필수.
  - `internal/store/` Firestore 접근
- 모든 요청: Firebase ID 토큰 검증 → uid 추출. uid는 토큰에서만 얻는다(요청 본문의 uid 무시).
- 핸들러마다 `context` 타임아웃. 요청 본문 크기 제한(기본 64KB). JSON은 알 수 없는 필드 거부.
- 초대권 지급 요청은 멱등 키(클라이언트 생성 UUID)를 받아 중복 지급을 막는다.
- 로그는 `log/slog` JSON. 토큰·개인정보·전체 요청 본문을 로그에 남기지 않는다.
- 핸들러에서 panic하지 않는다. 오류는 내부용 상세와 외부용 메시지를 분리한다.
- 컨테이너: 멀티 스테이지 빌드, 최종 이미지는 distroless, 비루트 사용자.
- 완료 전 확인: `gofmt`, `go vet ./...`, `go test ./...`, `govulncheck ./...`.
