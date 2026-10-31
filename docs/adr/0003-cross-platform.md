# ADR-0003 macOS · Windows 병행 작업

- 상태: 확정 (2026-10-31)
- 요청: Windows와 Mac을 자유롭게 오가며 작업. 병행 비용이 크면 Mac 기준으로.

## 결정

두 OS를 모두 지원한다. 병행 비용이 작다고 판단했다.

## 비용 평가

| 항목 | OS 차이 | 대응 | 남는 비용 |
| --- | --- | --- | --- |
| Phaser·Vite·Node | 없음 | — | 없음 |
| Go | 없음 (크로스 컴파일 기본 지원) | 컨테이너 빌드는 Cloud Build/CI에서 | 없음 |
| Antigravity CLI | 설치 명령만 다름 | README에 두 줄 | 플러그인은 컴퓨터마다 설치 |
| ink 컴파일러 | inklecate는 OS별 바이너리 | `inkjs` 내장 컴파일러(npm)로 대체 | 없음 |
| 저장소 스크립트 | bash / PowerShell | Node 스크립트로 통일 (`scripts/*.mjs`) | 없음 |
| 스킬 링크 | 심볼릭 링크 권한 차이 | Windows는 junction(관리자 권한 불필요) | 없음 |
| 줄바꿈 | CRLF / LF | `.gitattributes`로 LF 고정 | 없음 |
| 파일명 대소문자 | macOS·Windows 무시, Linux 구분 | 소문자 kebab-case 규칙 | 없음 |
| 도구 버전 차이 | 컴퓨터마다 다를 수 있음 | `.nvmrc`, `engines`, `go.mod` toolchain, `npm run doctor` | 점검 1회 |

## Mac이 꼭 필요한 경우

- iOS 네이티브 앱 빌드(Xcode). 이 게임은 모바일 웹이라 해당 없다.
- iPhone Safari 원격 디버깅(Web Inspector)은 Mac이 있으면 편하다. 없으면 실기에서 화면 확인 + 서버 로그로 대신한다.

## 규칙

`.agents/rules/cross-platform.md`
