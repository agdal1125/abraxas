# T003 서버 뼈대 (로컬 실행)

- 담당: 로컬 에이전트 (Antigravity CLI `agy`)
- 검수: Claude (코드 리뷰)
- 승인: 사람
- 브랜치: `feat/server-skeleton`

## 목표

`server/`에 Go API 뼈대를 만든다. **로컬에서 실행·테스트되는 것까지가 범위**다. Firebase 연동(실제 ID 토큰 검증, Firestore)은 배포 단계의 별도 작업에서 한다.

## 먼저 읽을 것

1. `.agents/rules/backend-go.md` — 서버 규칙 (위반 금지)
2. `.agents/rules/security.md` — 신뢰 경계, 로그, 의존성
3. `.agents/rules/cross-platform.md` — macOS·Windows 병행
4. `docs/adr/0001-tech-stack.md` — 서버·클라이언트 책임 분리

## 범위

| 항목 | 내용 |
| --- | --- |
| `server/go.mod` | 모듈 `github.com/agdal1125/abraxas/server`, `go 1.27.0`, `toolchain go1.27.0` |
| `server/cmd/api/main.go` | `PORT` 환경변수(기본 8080), `log/slog` JSON 로거, `http.Server`에 ReadHeader/Read/Write/Idle 타임아웃, SIGINT·SIGTERM 수신 시 graceful shutdown |
| `server/internal/http/` (패키지명 `httpapi`) | 라우터 구성 함수, `GET /healthz` → `200 {"status":"ok"}` |
| 미들웨어 | 패닉 복구(500, 내부 상세는 로그만), 요청 로그(메서드·경로·상태·소요시간만. 쿼리·헤더·본문·토큰 금지), 요청별 `context` 타임아웃, 본문 크기 제한 기본 64KB(`http.MaxBytesReader`) |
| JSON 헬퍼 | 알 수 없는 필드 거부(`DisallowUnknownFields`), 크기 초과 → 413, 형식 오류 → 400. 오류 응답은 `{"error":"<외부용 메시지>"}` |
| 인증 미들웨어 | `TokenVerifier` 인터페이스(`VerifyIDToken(ctx, token) (uid string, err error)`), `Authorization: Bearer <token>` 파싱, 실패 시 401, 성공 시 uid를 context에 저장하고 `UIDFromContext`로 꺼낸다. uid는 토큰에서만 얻는다 |
| `server/Dockerfile`, `server/.dockerignore` | 멀티 스테이지, 최종 `gcr.io/distroless/static-debian12:nonroot`, `CGO_ENABLED=0` |
| `server/README.md` | 로컬 실행·테스트 방법 갱신 |

## 하지 말 것

- **외부 Go 모듈을 추가하지 않는다.** 표준 라이브러리만 쓴다 (Firebase Admin SDK는 연동 작업 때 추가).
- **인증을 끄거나 우회하는 스위치·환경변수·개발용 검증기를 만들지 않는다.** 아직 인증이 필요한 API가 없으므로 인증 미들웨어는 `main`에 연결하지 않고 테스트에서 가짜 검증기로만 검증한다.
- 초대권·결과 저장·성향 계산 API는 만들지 않는다 (별도 작업).
- `client/`, `content/`, 다른 브랜치는 건드리지 않는다.

## 테스트 (필수)

- `/healthz` 200 및 응답 본문
- 인증: 헤더 없음 / `Bearer` 형식 아님 / 검증 실패 → 401, 성공 → 핸들러에서 uid 확인
- 본문 64KB 초과 → 413, 알 수 없는 필드 → 400
- 핸들러 패닉 → 500, 서버는 계속 동작
- 타임아웃 미들웨어가 context에 deadline을 건다

## 제출 전 셀프 체크 (`server/`에서)

```
gofmt -l .                     # 출력 없음
go vet ./...
go test ./...
go run golang.org/x/vuln/cmd/govulncheck@latest ./...
```

모두 통과할 때까지 고친다. 로컬 실행도 확인한다: `go run ./cmd/api` 후 `http://localhost:8080/healthz`.

## 제출

1. `feat/server-skeleton` 브랜치에 커밋한다 (커밋 메시지 본문 한국어). **push하지 않는다**, main에 직접 커밋하지 않는다.
2. `docs/memory/status.md`의 '서버 뼈대' 줄을 '검수 대기'로 바꾸고, `docs/devlog/2026-10-31.md`에 작업 기록을 덧붙인다.
3. 마지막 응답에 만든 파일 목록과 셀프 체크 결과를 요약한다.
