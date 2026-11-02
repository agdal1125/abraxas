# RS1-A 소품 인계 — 2026-11-02

상태: GLB·미리보기 제작 및 Blender 자체 검증 완료, 감독의 시각 검수와 W 등록 대기. 기존 캐릭터·월드·manifest·UI·측정 데이터는 변경 대상이 아니다. agy의 지속 429와 Terra 대체 지시는 사용자 제공 사실이며, 이 실행의 실제 모델명·effort는 도구에서 확인할 수 없다.

## 산출과 예산

원본은 [공통 Blender 스크립트](../../assets/source/residents-errands/lumi/build_resident_props.py), 상세 크기·원점·충돌·색 검증과 대상 대응은 [루미 metadata](../../assets/source/residents-errands/lumi/asset-metadata.json), [에코 metadata](../../assets/source/residents-errands/echo/asset-metadata.json), [오르 metadata](../../assets/source/residents-errands/or/asset-metadata.json)에 있다. 세 주민별 provenance는 해당 소스 디렉터리에 있다. GLB는 `client/public/assets/abraxas/environment/<ID>.glb`, 프리뷰는 `assets/_generated/residents-errands/<주민>/<ID>-overview.png`와 `<ID>-close.png`다.

| ID 접두사 `prop-` 생략 | triangles | bytes |
| --- | ---: | ---: |
| lumi-notice | 24 | 1,608 |
| lumi-horn | 144 | 2,864 |
| lumi-material | 36 | 1,776 |
| lumi-score | 60 | 2,008 |
| lumi-decoration-board | 152 | 2,488 |
| lumi-decoration-circle | 88 | 1,904 |
| lumi-decoration-triangle | 16 | 1,548 |
| lumi-decoration-square | 24 | 1,628 |
| echo-book | 48 | 1,848 |
| echo-books-board | 272 | 3,336 |
| or-bucket-empty | 168 | 2,748 |
| or-bucket-sand | 168 | 2,744 |
| or-sand | 20 | 1,788 |
| or-gear-board | 88 | 2,144 |
| or-gear-circle | 184 | 2,628 |
| or-gear-triangle | 148 | 2,528 |
| or-gear-square | 152 | 2,508 |
| or-bell | 144 | 2,360 |
| or-lantern-diagram | 104 | 2,264 |

전체 19개, 42,720 bytes. 각 모델의 한도는 모카와 같은 700 triangles·40,960 bytes. 위 용량은 GLB 파일 크기이며 다운로드량·드로 콜·기기 성능이 아니다.

## W 등록·연결 제안

- 루미: `lumi-horn`은 `prop-lumi-horn`, `lumi-notices`는 `prop-lumi-notice`. `notice` 운반 표시는 확정 선택에 따라 둘 중 하나를 쓴다. `lumi-ribbon-source`·`lumi-field-source`와 운반 `material`은 `prop-lumi-material`, `lumi-score-new`·`lumi-score-old`와 운반 `score`는 `prop-lumi-score`를 쓰고 역할 문구로 분기를 구분한다. `lumi-decoration-board`와 여섯 조각은 각각 보드와 모양별 조각을 두 번 배치한다. 공연 카드·엽서는 `prop-lumi-notice`, 작업 자리에는 기존 `bench`, 받침과 작업대에는 `prop-moka-dropoff` 재사용을 제안한다.
- 에코: 그림책·두 기록철·수첩·전설집 및 `book/record/notebook/legend` 운반 표시에는 `prop-echo-book`을 쓴다. `echo-bookshelf`는 `prop-echo-books-board`; 식물·요리·별 두 권씩의 구체적 주제와 새/기존 배치의 차이는 W/UI가 역할 표기와 배치로 제공한다. 기존 `book-stack`, `prop-moka-dropoff`를 서가·열람대·받침에 재사용한다. 서가와 다락 문은 서로 다른 접근점으로 유지하며 유리함·열린 전시는 기존 환경과 역할 표시로 구분할 구체적 배치를 W가 정한다.
- 오르: `or-bucket`은 모래 채우기 전 `prop-or-bucket-empty`, 이후 `prop-or-bucket-sand`; 채집지 `or-sand`는 `prop-or-sand`. `or-clock-board`는 `prop-or-gear-board`, 각 `gear-circle/triangle/square`는 같은 이름의 개별 GLB, `or-lantern-link`는 독립된 `prop-or-lantern-diagram`, `or-bell`은 `prop-or-bell`이다. 연장은 기존 `tool-rack`, 받침·연마대·광장 받침에는 `prop-moka-dropoff`를 제안한다. 화덕·추·걸이·지도는 기존 환경과 역할 표시로 구분할 배치를 W가 정한다.

모든 신규 소품은 바닥 중심 원점, glTF Y-up, scale 1, 충돌 없음으로 제안한다. 보드·소형 운반물의 충돌은 받침이나 기존 월드에 맡긴다. `lumi-rest`·`echo-rest`·`or-rest`는 각각 독립 배치하며 기존 모카 배달 상태를 덮지 않는다. 물건을 손에 붙이는 오프셋, 받침 높이, 목적지의 안전 접근점과 상태별 표시·복원은 W에서 실제 장면으로 검증한다.

## 검증과 한계

- Blender 5.2.3에서 공통 스크립트로 GLB의 Draco, `COLOR_0`, 치수·바닥 원점과 예산을 검사했다. 각 GLB를 Blender로 다시 가져와 팔레트별 색 오차 ±6/255 이내를 검사했다. 기존 환경 빌더가 sRGB→linear 변환과 선형 AO를 각각 한 번 적용한다.
- 같은 worktree에서 전체 스크립트를 다시 실행해 19개 GLB의 SHA-256이 모두 일치했다. 프리뷰 픽셀의 동일성은 비교하지 않았다.
- 프리뷰는 개별 정사영 스튜디오 이미지다. 나팔 입구·양동이 손잡이·오르 세 자리와 에코 보드를 확대해 확인했다. 게임 카메라에서의 크기·실루엣·손 부착·가림, 좌표와 충돌, 애니메이션은 미검증이며 시각 수락을 뜻하지 않는다.
- 클라이언트 `npm run typecheck`, `npm test`는 각각 `tsc`, `vitest` 미설치로 실행 실패했고 `govulncheck`도 미설치다. 서버 `go vet ./...`, `go test ./...`는 이 작업의 독점 쓰기 경로 밖에 빌드 캐시를 생성하지 않기 위해 실행하지 않았다. 실기기 FPS·월드/UI 통합은 측정하지 않았다.
- 공유 memory/devlog, manifest·월드는 독점 소유권 밖이므로 감독에게 인계한다. 설치·배포·커밋은 수행하지 않았다.
- 작업 시작 시 금지된 Git 명령을 놓치고 읽기 전용 `git status --short`를 한 차례 실행했다. Git 변경 명령은 실행하지 않았다.
