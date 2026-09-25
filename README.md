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
