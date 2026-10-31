---
name: art-asset
description: Generates and registers 2D art assets for Abraxas (characters, backgrounds, UI, result cards) in the project's pastel SD quarter-view style using an image generation model such as Nano Banana. Use when the user asks for a sprite, background, icon, character sheet, result card illustration, or placeholder art.
---

# 아트 에셋 만들기

먼저 `docs/art/style-guide.md`와 `.agents/rules/design-policy.md`를 읽는다.

## 순서

1. **요청 정리**: 종류(bg/chr/ui/fx/card), 용도(어느 씬), 크기, 투명 배경 여부, 변형 수.
2. **기준 이미지 확인**: 같은 캐릭터·장소의 승인된 에셋이 `client/public/assets/`에 있으면 참조 이미지로 넣어 일관성을 유지한다. 없으면 `docs/art/reference/`의 무드 레퍼런스를 쓴다.
3. **프롬프트 작성**: 스타일 가이드의 '공통 프롬프트 머리말' + 대상 설명 + 금지 요소. 캐릭터는 정면·3/4·측면 시트를 먼저 만든 뒤 표정·포즈를 파생한다.
4. **생성**: 이미지 생성 모델로 2~4안을 만든다. 결과는 `assets/_generated/<종류>/<이름>-v<번호>.png`로 저장하고, 같은 이름의 `.prompt.md`에 프롬프트·모델·참조 이미지·날짜를 남긴다.
5. **후처리**: 캐릭터·UI는 배경 제거(투명 PNG), 배경은 WebP 변환. 기준 해상도(720×1280) 대비 크기를 맞춘다.
6. **사람 확인**: 후보를 보여주고 고른 안만 `client/public/assets/<종류>/`로 옮긴다. 승인 전에는 게임 코드에서 참조하지 않는다.
7. **기록**: 승인된 에셋을 `docs/art/asset-registry.md`에 한 줄 추가(파일, 씬, 원본 프롬프트 경로, 승인일).

## 하지 말 것

- 실존 작품·캐릭터·브랜드를 이름으로 지정하거나 닮게 만들기.
- 공략 캐릭터에 성별이 드러나는 고정 요소 넣기(성별 중립 원칙).
- 주인공 얼굴을 세밀하게 그리기(외형 최소화 원칙).
- 비용이 큰 고해상도·대량 생성을 사람 확인 없이 돌리기. 한 번에 4장 이하.
