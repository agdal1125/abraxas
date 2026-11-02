# RS1-V 통합 검증 하네스 인계

2026-11-03 · 승인된 agy 429 대체 작업. 사용자 지시에 따라 Terra xhigh priority 대체로 진행했으며, 실행 환경에서 모델명·추론 수준·우선순위를 독립적으로 확인하지는 못했다. 커밋·병합, 의존성 설치, 공유 기억과 개발 일지는 부모 담당이다.

## 변경

- `scripts/e2e-play.mjs`는 기존 언어·출력 폴더와 `--emulators`를 유지하고 스크립트 이름 다음 세 번째 인자로 `a-auto`(기본값), `b-manual`, `resume`만 받는다. 주민 뷰의 phase와 활성 대상을 읽고, 실제 대화·선택·작업판을 이용한다. 수동 작업판은 콘텐츠의 조각·자리 순서와 서버 확정 배치를 대조해 화면의 HTML 버튼을 누른다. 오르 등불은 기존 UI의 단일 연결 동작을 사용한다.
- 월드 대상은 `interactTarget` 또는 CDP 포인터 입력으로 접근하고 자동 이동이 끝나기 전에 다시 시작하지 않는다. 도착 확인을 기록하며 주민별 포인터 도착이 없으면 실패한다. 화면상 앵커가 `hitTargetAt`의 적중 대상과 다르면 `pointerMismatches`에 기록한다. 직접 `onInteract` 호출이나 테스트용 순간이동을 사용하지 않는다.
- `resume`은 루미·에코·오르 각각 선택 확정, 운반 물건을 받침에 둔 뒤, 퍼즐 일부 배치, 보고 응답 적용 뒤 새로고침한다. 같은 회차와 revision·답·해당 주민 상태·완료 목록, 대기 명령 제거 및 탐색 복귀를 확인하며 새 회차 생성 시 실패한다. **마지막 보고 응답 유실은 주입하지 않았다.** 그 유실과 중복 재전송의 주 증거는 HTTP·통신 테스트다.
- 결과 도달 시 답 42개, 네 주민 완료 목록과 각 완료 phase를 확인한다. `run-summary.json`에 시나리오, 답 수, 완료 상태, 복구 항목, 포인터·이동 증거, 오류와 HTTP 이상을 남긴다. 전체 스냅샷이나 인증 정보를 기록하지 않는다. 단계별 스크린샷은 지정 폴더에 저장한다.
- 서버 이미지는 저장소 루트 컨텍스트에서 서버 소스와 런타임 점수·심부름 JSON을 복사하고 `/content`를 지정한다. `server/README.md`에 빌드 컨텍스트와 클라이언트와 동일한 콘텐츠 버전 설정 절차를 적었다. 배포하지 않았다.

## 실행 결과와 남은 통합

- 부모의 첫 `ko a-auto` 실행에서 브라우저 시작 전 `content/i18n/ko/items.json` 누락으로 실패했다. 게임 로더처럼 한국어는 `content/scoring/items.json`의 원문을 사용하고, 영어는 `content/i18n/en/items.json` 번역을 우선하며 없는 선택 문구는 원문으로 대체하도록 고쳤다. 실제 저장소 파일로 양 언어의 모든 선택지와 네 심부름 콘텐츠를 읽는 사전 검사 테스트를 추가했다.
- `node --test scripts/e2e-play.test.mjs`: 10개 통과. `node --check scripts/e2e-play.mjs`: 통과. 콘텐츠 버전 계산과 런타임 JSON·컴파일 스크립트 경로를 정적으로 확인했다. 모카 및 주민 작업판의 보드·그리드 순서와 자동 버튼 문구도 실제 UI 및 한·영 콘텐츠와 대조했다.
- `client`의 `npm run typecheck`: 실패. 이 작업트리에서 `tsc` 실행 파일을 찾지 못했다. 사용자 지시에 따라 설치하지 않았다.
- `docker`와 `podman`을 찾지 못해 이미지 빌드·컨테이너 기동은 확인하지 않았다. 브라우저, 포트, 에뮬레이터도 실행하지 않았다. 따라서 실제 이동·좌표 적중·복구 및 전체 결과 성공은 아직 검증되지 않았다.
- 부모가 RS1-W와 Firebase 보안 수정을 포함한 통합 HEAD로 작업트리를 갱신했다. 현재 월드 코드에서 신규 주민 활성 대상 처리와 하네스가 쓰는 메서드를 확인했다. 실제 좌표 불일치는 브라우저를 실행하지 않아 관찰하지 못했다. 실행 후 `pointerMismatches`, `pointerEvidence`, `interactionEvidence`와 실패 화면을 확인해 W 담당에게 전달한다. 이 작업트리에는 Vite와 Firebase CLI 실행 파일이 없어 부모의 의존성 준비 환경에서 실행해야 한다.

## 부모 실행 예시

필요한 의존성을 준비한 부모 환경의 저장소 루트에서 각 언어·시나리오 조합을 별도 증거 폴더로 실행한다. 예를 들어 다음과 같다.

```text
node scripts/e2e-play.mjs ko .e2e/ko-a-auto a-auto
node scripts/e2e-play.mjs ko .e2e/ko-b-manual b-manual
node scripts/e2e-play.mjs ko .e2e/ko-resume resume
node scripts/e2e-play.mjs en .e2e/en-a-auto a-auto
node scripts/e2e-play.mjs en .e2e/en-b-manual b-manual
node scripts/e2e-play.mjs en .e2e/en-resume resume
node scripts/e2e-play.mjs --emulators ko .e2e/ko-emulators a-auto
```

에뮬레이터의 한·영 및 시나리오 범위는 부모 검증 계획에 따라 추가 실행한다. 실행 결과와 실패 원인을 실제 산출물에서 확인하고, 계획의 나머지 필수 전체 검사와 실기기 검증도 별도로 수행한다.
