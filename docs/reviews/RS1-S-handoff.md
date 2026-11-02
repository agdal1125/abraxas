# RS1-S 서버 인계

2026-11-02 · 구현자 인계 · 커밋 전

## 범위 수정과 점수 계약

검수 지시에 따라 독점 범위를 `server/internal/scoring/scoring.go`, `scoring_test.go`, `client/src/core/scoring/index.ts`, `scoring.test.ts`까지 확장했다. 기존 모카 전용 완료 허용 목록을 루미·모카·에코·오르의 닫힌 목록으로 확대하고, 알 수 없는 ID와 프로토타입 이름을 거부한다. 각 주민의 반복 완료 ID는 한 번만 계산한다. 수치·가중치·문항·기존 골든 데이터는 변경하지 않았다.

`Engine.Apply`의 임시 보상 계산과 완료 ID 필터를 제거했다. 서버의 실제 `CompletedErrands`를 기존 `Score`와 `Progress`에 전달하며 두 구현은 `rules.json`의 기존 완료 보상과 상한을 사용한다. 기존 골든 여섯 건 각각에서 네 주민 완료·중복 완료 후의 전체 결과를 양쪽 언어로 검사하고, 호감도 상한·알 수 없는 주민 거부도 확인했다. 새 골든 파일은 필요하지 않았다.

## 서버 API와 파일

- `server/internal/play/play.go`, `lumi.go`, `echo.go`, `or.go`: 신규 회차에 세 주민의 `phase`, `objects`, `placements`, `completedAt`을 추가하고 RS1-C JSON의 대상·조각·자리를 읽는다. `Engine.Apply`가 주민별 행동과 선택을 순서대로 판정하며 다른 주민 물건을 든 상태, 잘못된 조각과 대상, 조기 완료 및 `finish_segment` 우회를 거부한다.
- 최종 보고 성공 시 `{npc}-errand-completed` 고정 사건, `CompletedErrands`, 서버 시각과 완료 주민의 `episodeEnd`를 기록한다. 완료 수에 따라 막간 1~3 또는 축제로 이동한다. 이미 완료한 주민의 사건이나 보상을 다시 기록하지 않는다.
- `server/internal/http/play.go`: `place_piece { pieceId, slotId }`를 엄격히 파싱하고 완료 대상 A/B/C/D를 각 주민 사건에 대응한다. 동일 키·본문은 기존 영수증, 키 충돌은 409, 같은 답·같은 완료의 의미상 재전송은 기존 영수증과 현재 스냅샷, 다른 답은 `choice_locked`를 반환한다.
- `server/internal/play/lumi_test.go`, `play_test.go`, `server/internal/http/play_test.go`: 공유 주민 fixture 성공·거부 경로, 받침대 복구, 잘못된 배치와 다른 주민 물건, 오류 시 불변성, 24가지 실제 완료 순서, HTTP 완료·답·키 재전송 및 파싱을 검사한다. 기존 모카 fixture의 신규 주민 초기 상태는 테스트에서만 보충한다.

## 검증과 남은 범위

- 로컬 `GOCACHE`를 지정한 서버 `go vet ./...`, `go test ./... -count=1`: 통과.
- 클라이언트 `npm run typecheck`: 통과. `npm test -- core`: 10개 파일·65개 테스트 통과. `npm test`: 23개 파일·99개 테스트 통과.
- `npm run check:scoring`: 38문항·타이브레이커 4개, 10,000회 유형 분포 5.60~6.73%, 경고 없이 통과.
- `gofmt`, `git diff --check`: 통과. 기존 저장소 설치본에서 클라이언트 의존성만 비삭제 복사했다. 네트워크 설치, 설정·ACL·비밀값 변경은 없다.
- 브라우저·E2E·에뮬레이터와 `govulncheck`는 실행하지 않았다. 현재 게이트는 `Score`의 완전성을 검증하며 공식 결과 저장은 별도 통합 범위다. 통합·CI·공유 기억·개발 일지와 git 작업은 감독 담당이다.
- agy `gemini-4-argon-medium` 사용량 한도 이후 승인된 대체 모델 `gpt-6.1-terra`, xhigh, priority로 구현했다.
