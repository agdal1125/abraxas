# 오프닝 영상 출처

`client/public/cinematics/prelude-v2.mp4`는 게임의 자체 모델과 `content/world/village.json` 배치를 Blender 5.2 Cycles로 렌더링한 영상이다. 소리는 v1 영상의 완성 믹스를 재인코딩 없이 그대로 쓴다. 1280×720, 24fps, H.264 High(2패스, faststart)다.

## 다시 만드는 법

장면 전체는 `prelude-v2/build_film.py`에 있고, 모든 프레임은 시각 `t`만으로 결정된다. 게임 GLB를 읽고, 풀밭·알·조각·구름·바다·강아지는 코드로 만든다.

```bash
node scripts/render-prelude.mjs frames --t 12.5,30
node scripts/render-prelude.mjs frames --draft
node scripts/render-prelude.mjs frames
node scripts/render-prelude.mjs encode
```

첫 줄은 지정한 시각의 정지 프레임, 둘째 줄은 640×360 12fps 초안, 셋째 줄은 전체 프레임, 넷째 줄은 인코딩이다. Blender와 ffmpeg 경로는 `ABRAXAS_BLENDER`, `ABRAXAS_FFMPEG`로 바꿀 수 있다. 결과물은 git에서 제외된 `prelude-v2/out/`에 쌓인다. 렌더 설정은 OptiX(NVIDIA GPU) 기준이다.

`prelude-v2/title.png`는 `title.html`을 Chrome 헤드리스로 찍은 글자 이미지다. Pretendard를 쓴다.

## 소리

`prelude-audio-v1.m4a`는 v1 영상에서 `-c:a copy`로 뽑은 AAC 112kbps 트랙이다. v1 제작 원본은 저장소 밖에 있어 음원별로 분리할 수 없다. 화면의 착지, 금, 터짐은 이 트랙의 소리 시점에 맞춘다.

제3자 저작물 중 표기 의무가 있는 것은 음악뿐이다. 효과음은 모두 CC0이다. 전체 목록은 `client/public/cinematics/prelude-v2-credits.txt`에 있다.

- 음악: "HoneyTune - The Day We Smiled (60s Edit)" by HoneyTune, Internet Archive, CC BY 3.0 (http://creativecommons.org/licenses/by/3.0/). 뒷부분 약 29.5초를 잘라 페이드인을 넣었다.

## 강아지

영상 전용 모델이다. 코드로 새로 만들었고 사진을 쓰지 않았다. 게임의 `Demi`는 이 모델을 쓰지 않는다.
