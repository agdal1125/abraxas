# 스테이징 배포

폰과 카카오톡 인앱에서 한 회차를 끝까지 플레이해 보는 공개 환경이다. 운영과 Firebase 프로젝트를 분리한다.

## 구성

- 클라이언트: Firebase Hosting.
- 서버: Cloud Run `abraxas-api`, 서울 리전 `asia-northeast3`. 인스턴스 0~3개, 실제 인증·App Check·Firestore 사용.
- 연결: Hosting이 `/v1/**`를 Cloud Run으로 넘긴다. 같은 주소라 CORS 설정이 없다.
- 권한: 서버 계정 `abraxas-api@<프로젝트>.iam.gserviceaccount.com`에는 `roles/datastore.user`만 준다.
- 요청 제한: uid당 분당 300회. 인스턴스별로 세므로 실제 상한은 인스턴스 수만큼 늘어난다.

## 사람이 준비할 것

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 `abraxas-staging`을 만든다. 이미 쓰인 이름이면 콘솔이 붙여 주는 ID를 그대로 쓴다.
2. Blaze 요금제를 연결하고 Google Cloud 결제에서 예산 알림을 건다.
3. Firestore 데이터베이스를 `asia-northeast3`에 만든다. 위치는 나중에 바꿀 수 없다.
4. Authentication에서 익명 로그인을 켠다.
5. 프로젝트에 웹 앱을 하나 등록한다.
6. reCAPTCHA v3 키를 만들어 허용 도메인에 `<프로젝트>.web.app`, `<프로젝트>.firebaseapp.com`을 넣는다. App Check에 이 웹 앱의 공급자로 등록한다. 비밀 키는 콘솔에만 넣는다.
7. 도구를 설치하고 로그인한다.

```text
winget install --id Google.CloudSDK
brew install --cask google-cloud-sdk
gcloud auth login
npx firebase login
```

`winget`은 Windows, `brew`는 macOS용이다.

8. 저장소 루트에 `.env.staging`을 만든다. git에 올라가지 않는다. 공개 사이트 키만 적는다.

```text
ABRAXAS_STAGING_PROJECT=
ABRAXAS_STAGING_APP_CHECK_SITE_KEY=
```

## 배포

추적 중인 파일에 변경이 없는 상태에서 실행한다. 사람이 확인한 뒤에만 실행한다.

```text
npm run deploy:staging -- --dry-run
npm run deploy:staging
```

스크립트는 API 켜기, 클라이언트 빌드, 이미지 저장소와 서버 계정 준비, Cloud Build, Cloud Run, Hosting과 Firestore 규칙 배포를 차례로 한다. 다시 실행해도 같은 상태가 된다. 마지막에 Hosting을 거친 API가 토큰 없는 요청에 401을 돌려주는지 확인한다.

처음 배포할 때는 `gcloud meta list-files-for-upload`로 업로드 범위가 `server/`, `content/scoring/`, `content/quests/`뿐인지 먼저 본다.

## 배포 뒤 확인

- 결과까지 플레이하고 Firestore에 저장되는지 본다.
- 도중에 새로고침해 이어지는지 본다.
- App Check 토큰 없는 요청이 403으로 거절되는지 본다.
- 오프닝 영상이 Range 요청에 206으로 응답하는지 본다. iOS Safari에 필요하다.
- 콘솔에 CSP 위반이 없는지 본다. reCAPTCHA와 인증 도메인은 실제 환경에서만 확인된다.

## 알려진 제약

초대권이 없어 결과까지 간 계정은 새 회차를 만들 수 없다(`replay_not_ready`). 다시 테스트할 때는 시크릿 창이나 브라우저 데이터 삭제로 새 익명 계정을 쓴다.
