# T003 검수 · 2026-10-31 · 검수자: Claude

- 대상: `feat/server-skeleton` (agy `gemini-4-argon-medium` 작업분, 커밋 전 작업 트리)
- 기준: `docs/tasks/T003-server-skeleton.md`, `.agents/rules/backend-go.md`, `.agents/rules/security.md`

## 판정: 승인

## 기계 검사 (검수자가 직접 재실행)

- `gofmt -l .` 출력 없음 · `go vet ./...` 통과 · `go test -count=1 ./...` 통과 · `govulncheck` 취약점 0
- 로컬 실행 `PORT=18080`: `GET /healthz` → 200 `{"status":"ok"}`, `POST /healthz` → 405, `GET /nope` → 404
- 요청 로그에 메서드·경로·상태·소요시간만 남고 쿼리·토큰은 없음 (테스트로도 검증됨)

## 지시서 대비

| 항목 | 결과 |
| --- | --- |
| 외부 모듈 없음 | 지킴 (`go.mod`에 require 없음) |
| 인증 우회 스위치 없음, `main`에 인증 미연결 | 지킴 |
| 미들웨어 4종 + JSON 헬퍼 + `TokenVerifier` | 모두 있음, 테스트 5종 통과 |
| Dockerfile distroless nonroot | 지킴 |
| toolchain | `go1.27.3`으로 올림. 1.27.0 표준 라이브러리 취약점 때문이며 규칙(1.27.x) 범위 안이라 수용 |

## 검수자가 고친 것

- `server/README.md`: 서버가 읽지 않는 `.env.local`로 `PORT`를 설정한다는 안내를 삭제.

## 다음 작업 때 반영할 것 (이번 승인에는 영향 없음)

- `DecodeJSON`이 `DefaultMaxBodyBytes`를 하드코딩한다. 엔드포인트별 한도가 필요해지면 인자로 받는다.
- 패닉 로그에 스택이 없다. 디버깅이 필요해지면 `runtime/debug.Stack()`을 추가한다.
- 인증 미들웨어는 Firebase 연동 작업에서 실제 검증기와 함께 라우터에 연결한다.
