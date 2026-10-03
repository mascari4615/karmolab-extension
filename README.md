# KarmoLab 확장 (Chrome, Edge MV3)

스토어 배포용 확장. 개발용 확장 (Mascari4615.github.io 의 `apps/karmo-web-extension`) 과 별개. 권한은 `storage` 와 `www.youtube.com` 뿐.
정본: `memo/projects/karmolab/apps/karmolab-extension.md`

## 기능

| 기능 | 파일 | 끄기 |
| --- | --- | --- |
| 쇼츠 올린 날짜 표시 | `features/shorts-date.js`, `.css` | 팝업 체크 (`chrome.storage.sync` 의 `shortsDate`) |

새 기능은 `features/` 에 파일 한 쌍, 팝업에 체크 하나, `_locales` 문구.

## 로컬로 써 보기

1. `edge://extensions` 또는 `chrome://extensions` 에서 개발자 모드
2. 압축해제된 확장 로드 -> 이 폴더

## 스토어 zip

```
node pack.mjs
```

`dist/karmolab-<버전>.zip`. 올리기 전 `manifest.json` 의 `version` 을 올린다.

## 업데이트 자동화

`node scripts/prepare-release.mjs`로 테스트, 문법 검사, zip 생성. `release-notes/<버전>.txt`에 심사 테스트 안내를 함께 작성.

main에 버전 증가가 반영되면 GitHub Actions가 같은 zip을 Chrome과 Edge 양쪽에 제출. 인증을 한 번 설정한 뒤 사용 가능. 워크플로는 양쪽 결과와 재개용 receipt를 별도 보관. 제출 접수와 심사 승인, 실제 공개는 다른 상태.

- Edge secrets: `EDGE_CLIENT_ID`, `EDGE_API_KEY`. 기존 등록 product ID는 workflow에 고정.
- Chrome secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`. variables: `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`.
- 수동 실행: workflow action `package`는 검사만, `submit`은 제출, `status`는 조회. 제출 대상 기본값 `both`.
- 재개: 이전 workflow run의 receipt를 `resume_run`으로 복원. 불명확한 POST 결과는 재전송 없이 먼저 상태 확인.
- 새 등록, 메타데이터 변경, 최초 공개에 필요한 항목은 스토어 대시보드에서 설정. 키는 소스, zip, 로그에 담지 않음.

## 스토어 문구

- 이름: KarmoLab
- 짧은 설명 (ko): 유튜브 쇼츠를 넘길 때 영상 올린 날짜를 표시합니다.
- 짧은 설명 (en): Shows the upload date on YouTube Shorts as you scroll.
- 분류: 도구 (Tools)
- 권한 사유
  - `storage`: 기능 켜고 끄기 설정 저장
  - `www.youtube.com`: 쇼츠 화면에 날짜 표시, 유튜브에서 그 영상의 공개 날짜 조회
- 개인정보: 수집하는 사용자 데이터 없음. 날짜 조회 요청에 쿠키를 싣지 않는다 (`credentials: "omit"`)
- 원격 코드: 없음

## 개인정보

- 수집하거나 보내는 사용자 데이터 없음
- 날짜 조회는 유튜브의 공개 영상 정보에서, 쿠키 없이 (`credentials: "omit"`)
- 저장하는 것은 기능 켜고 끄기 설정 하나 (`chrome.storage.sync`)
