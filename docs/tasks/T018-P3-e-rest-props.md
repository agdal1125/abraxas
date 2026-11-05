# T018-P3-e 남은 건물과 소품

`docs/tasks/T018-P3-faceted-direction.md`와 `docs/tasks/T018-P3-c-props.md`의 형태 지시·계약·쓰기 범위 그대로다. 앞 단계에서 끝내지 못한 대상을 끝낸다. 셸 읽기는 자유롭다. 커밋·push 금지. 지형과 `content/`는 쓰지 않는다.

합격한 기준은 지금의 `bench`, `barrel`, `log`, `tree-round`다. 감독이 게임 화면에서 본 남은 문제:

- 대장간(`smithy`)이 분홍·보라 파스텔 지붕과 기단으로 남아 있다. 가장 눈에 띈다. 목재·돌·짙은 지붕으로 바꾼다. 작업장으로 읽히게 지붕에 처마와 굴뚝을 재료답게 만든다.
- `book-stack`이 파스텔 상자처럼 보인다. 책등 색을 낮추고 책이 쌓인 형태로 읽히게 한다.
- `tool-rack`은 어수선하다. 기둥과 걸린 도구가 읽히게 정리한다.
- `signboard`의 흰 받침과 파스텔 판. 받침을 돌이나 나무로, 판을 목재로 바꾼다.
- `streetlight`, `fence`, `well`, `bridge`, `shore-post`, `plaza-hall`, `lake-pavilion`, `memory-gate`, `festival-stage`, `water-reed`, `water-flower`, `mushroom`: 같은 표현으로 바꾼다.
- `entrance-house`, `library`, `bakery`: 보라색 기단을 돌색으로, 빈 벽에 부재를 넣는다. 이미 잘 된 지붕과 앞면 방향은 유지한다.

여러 대상을 끝내지 못할 것 같으면 위 순서대로 처리하고 남은 것을 보고한다. 각 대상의 프리뷰를 보고 합격을 판정한다.

`node client/scripts/check-abraxas-assets.mjs`, `node scripts/check-village-reach.mjs`를 실행한다. 한국어로 대상별 삼각형·바이트 전후, 끝내지 못한 대상을 보고한다.
