> 이 문서는 최초 등록 단계의 이력이다. 후속 구현·검증은 RS1-W-props-handoff.md와 RS1-W-bridge-handoff.md를 따른다.

# RS1-W 인계 — 미완료

2026-11-02 · 승인된 월드 통합 전체는 아직 구현되지 않았다. 이 문서는 완료 승인이 아니다.

## 완료한 범위

- 신규 루미 8개, 에코 2개, 오르 9개 GLB를 `content/assets/manifest.json`에 등록하고, 에셋 검사에 세 주민의 원본 metadata를 연결했다. 크기·삼각형·Draco 검사는 전체 에셋 오류 0건이다.
- 클라이언트 의존성은 지정된 기존 worktree에서 복사했다. 다른 소스나 에셋 원본은 변경하지 않았다.

## 남은 필수 작업

- `Village.setLumiView`, `setEchoView`, `setOrView`와 `resumeLumi`, `resumeEcho`, `resumeOr`, 공개 뷰 필드는 아직 없다. UI 담당은 이 인터페이스에 연결할 수 없다.
- 모든 계약 대상의 물리 소품·접근점, 임시 주민과 원래 위치 복원, 단계별 운반·받침·완료 장식, 오르의 광장 보고, 재개 상태 및 지연 로딩은 미구현이다. 세 주민의 월드 좌표도 등록하지 않았다.
- 도달성 검사기는 기존 모카 대상만 포함한다. 신규 주민의 모든 대상과 이동한 NPC의 충돌·경로 테스트, 게임 카메라 배치 및 실기기 검증이 필요하다.

## 실행한 확인

- 클라이언트 `npm run typecheck` 통과, `npm test` 23파일 110개 통과.
- 기존 `node scripts/check-village-reach.mjs` 32/32 통과. 신규 주민 도달성 증거는 아니다.
- `node client/scripts/check-abraxas-assets.mjs` 전체 오류 0건, 전체 695,248 bytes.
- ink 출력 파일을 다시 쓰지 않도록 `npm run build` 대신 클라이언트에서 `vite build`를 한 번 실행했고 성공했다. Pretendard CSS가 빌드 시점에 없어 런타임에 해결한다는 경고와 500 kB 초과 청크 경고가 나왔다. 실제 모바일·게임 화면은 확인하지 않았다.
- 부모가 브라우저와 포트를 소유하므로 실행하지 않았다. 공유 memory/devlog는 독점 쓰기 범위 밖이어서 갱신하지 않았다.
