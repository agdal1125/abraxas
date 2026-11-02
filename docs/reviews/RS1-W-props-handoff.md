# RS1-W 주민 소품 인계

2026-11-03 · 소품·좌표 담당 범위 구현. 월드 장면 연결과 실제 경로 검증은 별도 담당 작업이다.

## 월드 연결 계약

`ResidentProps.load(npc, scene, player, placements, load)`는 `npc: 'lumi' | 'echo' | 'or'`, `THREE.Scene`, 플레이어 `THREE.Group`, `{ id, asset, x, z, rot?, scale? }[]`, 기존 `(key) => Promise<GLTF>`를 받아 `Promise<ResidentProps>`를 반환한다. 전체 `map.props`를 넘겨도 해당 주민 접두사만 읽으며, 해당 주민 모델과 필요한 기존 환경 모델만 지연 로드한다. `objects: Map<string, THREE.Object3D>`는 대상 ID별 실제 모델이다.

`setView(view)`는 `lumiView`, `echoView`, `orView`의 반환값 또는 `null`을 받는다. 각 스냅샷에서 세 주민 각각의 뷰를 넘겨야 완료 장식이 다른 에피소드 중에도 유지된다. `null` 또는 잠금은 해당 소품을 숨기고 플레이어에서 운반물을 제거한다. 같은 뷰 재적용 시 GLB나 도형을 다시 만들지 않는다. 월드는 activeTargetIds만 상호작용 대상으로 등록하고, 모델과 별개인 안전 접근점을 기존 경로 탐색으로 정해야 한다.

## 좌표와 상태

- `village.json`에 루미 19개, 에코 19개, 오르 18개 물리 대상 및 세 주민별 독립 받침을 등록했다. NPC 대상은 소품으로 중복 등록하지 않았다. 역사 서가와 다락문, 유리함과 열린 전시, 톱니판과 등불 도면은 각각 별도다.
- NPC 위치 zone은 `lumi-stagekeeper`, `lumi-neighbor-1`, `lumi-neighbor-2`, `echo-organizer`, `echo-borrower`, `or-assistant`, `or-fisher`, `or-merchant`, `or-review-fisher`, `or-review-merchant`, `or-report`이다. 월드가 기존 `s1j2`, `t1p2`, `s2j2`를 임시 이동하고 나머지 역할에는 기존 `quest-npc` 모델을 쓰며, 종료 시 원위치를 복원해야 한다. `or-report`는 `(4, 1)`, 종 받침은 `(4, 2)`다.
- 서버 위치가 손·받침·전달이면 각각 한 개의 운반 모델을 재부착한다. 오르 양동이는 모래 채우기 직후 단계부터 채운 모델을 쓴다. 루미 장식 6개, 에코 책 6개, 오르 톱니 3개는 확정된 `placements`만 보이며, 에코의 확정 선택에 따라 책 배열이 달라지고 연결 이후 등불 도면에 선이 보인다. 선택 a의 완료 종은 대장간에, b의 전달된 종은 광장 받침에 남는다.
- 루미 우편함과 에코 다락문·유리함은 기존 모델에 단순 형상을 더해 구별한다. 책상 위 운반물은 기존 받침·벤치·책더미의 높이에 맞춰 놓는다.

## 검증과 남은 확인

- `npm run typecheck`: 통과.
- `npm test -- src/scenes/resident-props.test.ts`: 6개 통과. 운반 복원, 초기화, 완료 장식 독립성, 분기 배치, 대상 목록, 소품 중심의 기존 충돌체 바깥 여부 및 주민별 로딩을 확인했다.
- `node client/scripts/check-abraxas-assets.mjs`: 오류 0건, 전체 695,248 bytes. 이전 작업에서 19종 manifest와 metadata 검사 연결을 완료했다.
- 좌표는 기존 지형·충돌체에서 여유를 두어 배치했지만, 실제 경로 탐색·이동한 NPC와 모든 상태의 충돌은 아직 검증하지 않았다. 월드 담당의 도달성 검사 결과에 따라 좌표 조정이 필요하다. 브라우저·실기기·게임 카메라의 손 부착, 가림, 모델 높이는 확인하지 않았다.
- `village.ts`, 도달성 검사, UI, 서버, source art, 공유 memory/devlog는 수정하지 않았다. 이번 작업에서 manifest와 에셋 검사기는 추가 수정하지 않았다.
