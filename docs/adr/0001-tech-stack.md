# ADR-0001 기술 스택

- 상태: 확정 (2026-10-31)
- 근거 문서: 기획서 v2.0 §10 (모바일 웹, 세로 고정, 첫 화면 5초·초기 10MB 목표, 서버 권위 초대권)

## 결정

| 영역 | 선택 | 버전 기준 (2026-10) |
| --- | --- | --- |
| 게임 클라이언트 | TypeScript (strict) + Phaser 4 + Vite | Phaser 4.x 최신 안정판 |
| 대사·선택지 스크립트 | ink (inkjs 런타임, inklecate로 JSON 컴파일) | inkjs 최신 |
| 백엔드 API | Go, 표준 라이브러리 `net/http` 중심 | Go 1.27.x |
| 서버 실행 | Google Cloud Run (컨테이너, 0까지 축소) | — |
| 정적 호스팅·CDN | Firebase Hosting | — |
| 사용자 식별 | Firebase Anonymous Auth (로그인 없음) | — |
| 데이터베이스 | Cloud Firestore (클라이언트 직접 접근 금지, 서버만 접근) | — |
| 비밀값 | Secret Manager | — |
| 광고 | AdSense H5 Games Ads (Ad Placement API, 승인제 베타) | 신청 필요 |
| 테스트 | Vitest(클라이언트 로직) · Go test · Playwright(모바일 뷰포트 E2E) | — |

## 왜 이렇게 정했나

**Phaser 4**: 2.5D 프리렌더 배경 + 스프라이트 구성에 맞고 번들이 작다. 공식 저장소에 에이전트용 스킬 28종이 포함돼 있어 Antigravity·Claude 모두 바로 활용할 수 있다. Unity WebGL은 첫 로딩이 무거워 링크 유입형 게임과 맞지 않는다.

**ink**: 데이트 심 대사는 분기·변수·조건이 많다. 기획자가 텍스트 파일로 대사를 쓰고, 선택지에 태그로 성향 가중치를 달 수 있다(`.agents/skills/ink-scenario`). 대사가 코드에 섞이지 않는다.

**Go (Python·Rust 대비)**:

- 메모리 안전 언어이면서 단일 정적 바이너리로 빌드된다. distroless 이미지에 올리면 공격 표면이 작다.
- 표준 라이브러리만으로 HTTP 서버를 만들 수 있어 외부 의존성이 적다. 공급망(패키지) 리스크가 웹 보안 사고의 큰 축이라 이 점이 중요하다.
- `govulncheck`가 실제로 호출되는 취약 코드만 골라 알려준다.
- Cloud Run에서 콜드 스타트가 빠르다. 바이럴로 트래픽이 몰렸다가 빠지는 패턴에 맞다.
- Rust는 안전성은 더 높지만 학습 곡선과 빌드 시간이 길고, 에이전트가 짠 코드를 사람이 검토하기 어렵다. 이 서버는 초대권·결과 저장 수준의 단순한 API라 그 비용을 정당화하기 어렵다.

보안 사고 대부분은 언어보다 애플리케이션 로직(인증, 입력 검증, 권한)에서 난다. 그래서 언어 선택과 함께 `.agents/rules/security.md`의 규칙을 같이 둔다.

**Firebase + Cloud Run**: 정적 파일 CDN, 익명 인증, DB가 한곳에 있다. Antigravity 플러그인 마켓플레이스에 Firebase·Google Cloud 플러그인이 있어 에이전트가 배포·설정을 도울 수 있다. 서버는 컨테이너라 필요하면 Azure Container Apps 등으로 옮길 수 있다.

## 서버와 클라이언트의 책임 분리

| 항목 | 클라이언트 | 서버 (권위) |
| --- | --- | --- |
| 성향 계산 | 진행 중 계산(연출용) | 선택 로그로 재계산해 최종 결과 확정·저장 |
| 초대권 | 잔량 표시만 | 발급·소모·인당 최대 8장 판정 |
| 공유 카드 이미지 | canvas로 생성 후 공유 | 저장하지 않음 |
| 링크 미리보기(OG) | — | 유형×수식어 48종 정적 이미지를 결과 URL에 연결 |

성향 가중치는 코드가 아니라 데이터(`content/` 아래 JSON)로 둔다. TypeScript와 Go가 같은 데이터를 읽어 계산하고, 같은 선택 로그로 같은 결과가 나오는지 골든 테스트로 확인한다.

## 저장소 구조

```
client/   Phaser 4 + Vite (TypeScript)
server/   Go API (Cloud Run)
content/  ink 대사, 성향 가중치 데이터, 16유형 텍스트
docs/     기획·ADR·메모리·개발 일지
.agents/  에이전트 규칙·스킬 (Antigravity 기본 경로, Claude Code는 링크)
```

## 다시 검토할 조건

- 3D 연출이 필요해지면 렌더러를 Three.js로 재검토한다.
- H5 Games Ads 승인이 나지 않으면 결과 화면 배너 광고 등 대안을 정한다.
