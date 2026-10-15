# KarmoLab 확장 (Chrome, Edge MV3)

스토어 배포용 확장. 개발용 확장 (Mascari4615.github.io 의 `apps/karmo-web-extension`) 과 별개. 기존 유튜브 기능은 `storage` 와 `www.youtube.com` 사용. Base64 링크 찾기는 `activeTab`, `scripting`과 사용자가 켠 사이트의 선택 접근 권한 사용.
정본: `memo/projects/karmolab/apps/karmolab-extension.md`

## 기능

| 기능 | 파일 | 끄기 |
| --- | --- | --- |
| 쇼츠 올린 날짜 표시 | `features/shorts-date.js`, `.css` | 팝업 체크 (`chrome.storage.sync` 의 `shortsDate`) |
| 사용자 차단: 영상, 쇼츠, 댓글 숨김 | `features/user-block.js`, `.css` | 팝업 체크, 차단 목록의 해제 (`chrome.storage.local`) |
| Base64 웹 주소 링크화 | `features/base64-core.js`, `base64-links.js`, `.css` | 팝업의 이 사이트에서 켜기/끄기 (`chrome.storage.local`) |

새 기능은 `features/` 에 파일 한 쌍, 팝업에 체크 하나, `_locales` 문구.

## Base64 링크 찾기 (0.3.0)

일반 웹페이지에서 확장 팝업의 **이 사이트에서 켜기** → 브라우저가 요청하면 해당 사이트 접근 허용. 본문과 댓글의 Base64가 완전한 HTTP/HTTPS 주소면 원문 옆에 목적지 도메인의 링크 표시. 원문 유지, 클릭할 때 새 탭으로 열기. 디코딩 서버, 원문 전송, 목적지 미리 요청 없음.

사이트별 기본값은 꺼짐. 켠 사이트는 다음 방문에도 동작하며 새 댓글도 처리. **이 사이트에서 끄기**로 원문 복원과 자동 실행 등록 해제, 추가 사이트 권한 회수. 기존 유튜브 기능이 쓰는 필수 접근은 유지. 사이트는 프로토콜과 호스트 단위이며 같은 호스트의 포트는 공유.

표준 Base64, URL-safe, 패딩 생략 지원. 스크립트 주소, 계정/암호 포함 URL, 제어문자, 잘못된 인코딩은 무시. 입력창, 편집 영역, 기존 링크와 코드 블록은 건드리지 않음. 브라우저 설정/확장 스토어, iframe/Shadow DOM, 줄바꿈으로 분리된 토큰은 지원 범위 밖.

브라우저 시험: `node scripts/verify-base64.cjs`. 임시 확장 설치의 로컬 fixture 호스트만 사전 허용하여 실제 팝업, 자동 등록, 주입, 동적 본문, 복원을 검증. 운영 manifest의 선택 권한 승인창과 사용자의 실제 설치본 적용은 별도 확인 대상.

댓글의 좋아요/답글 줄 또는 영상/쇼츠의 구독 버튼 뒤 **차단** → 확인. 차단한 부모 댓글은 답글까지, 차단한 답글 작성자는 해당 답글만 숨김. 직접 연 차단 영상/쇼츠는 재생을 멈추고 안내 표시. 팝업의 **해제**로 복원. 유튜브 계정의 차단 설정과 별개이며, 목록은 이 브라우저에만 저장.

표시 이름 대신 채널 핸들/ID로 구분. 공개 채널 페이지 조회 성공 시 둘을 연결. 작성자 링크가 없는 썸네일은 공개 영상 정보 조회, 동시 요청 최대 3개. 조회 실패, 미지원 레이아웃은 추측해서 숨기지 않음. 핸들 변경, 로그인 전용 콘텐츠, 라이브 채팅은 지원 보장 범위 밖.

브라우저 검증: Playwright 설치 후 `node scripts/verify-user-block.cjs` (Edge, 격리된 DOM 시험), `node scripts/verify-user-block-live.cjs` (번들 Chromium, 실제 확장과 공개 유튜브). `PLAYWRIGHT_MODULE`로 모듈 경로, `VERIFY_OUTPUT`으로 캡처 경로 지정 가능. `VERIFY_MUTATION=1`은 차단 판정 제거 후 검사 실패 확인용. 실제 시험은 임시 프로필만 사용.

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

main push는 검사와 ZIP 생성만 실행. 로컬 언팩판으로 사용자가 체험한 뒤 배포를 맡기면 workflow_dispatch의 submit으로 같은 ZIP을 Chrome과 Edge 양쪽에 제출. 워크플로는 양쪽 결과와 재개용 receipt를 별도 보관. 제출 접수와 심사 승인, 실제 공개는 다른 상태.

- Edge secrets: `EDGE_CLIENT_ID`, `EDGE_API_KEY`. 기존 등록 product ID는 workflow에 고정.
- Chrome secrets: `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`. variables: `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`.
- 수동 실행: workflow action `package`는 검사만, `submit`은 제출, `status`는 조회. 제출 대상 기본값 `both`.
- 재개: 이전 workflow run의 receipt를 `resume_run`으로 복원. 불명확한 POST 결과는 재전송 없이 먼저 상태 확인.
- Edge 작업 상태 조회의 HTTP 200/202 모두 처리. 저장된 작업 ID로 재개해 같은 ZIP 재업로드 방지.
- 새 등록, 메타데이터 변경, 최초 공개에 필요한 항목은 스토어 대시보드에서 설정. 키는 소스, zip, 로그에 담지 않음.

## 스토어 문구

- 이름: KarmoLab
- 짧은 설명 (ko): 유튜브 쇼츠 날짜 표시와 원치 않는 채널의 영상, 쇼츠, 댓글 숨김.
- 짧은 설명 (en): Show YouTube Shorts dates and hide videos, Shorts and comments from unwanted channels.
- 분류: 도구 (Tools)
- 권한 사유
  - `storage`: 기능 설정과 브라우저 내 차단 목록 저장
  - `www.youtube.com`: 쇼츠 날짜 표시, 채널/영상 공개 정보 조회, 차단 버튼과 콘텐츠 숨김
- 개인정보: 수집하는 사용자 데이터 없음. 날짜 조회 요청에 쿠키를 싣지 않는다 (`credentials: "omit"`)
- 원격 코드: 없음

## 개인정보

- 수집하거나 보내는 사용자 데이터 없음
- 날짜 조회는 유튜브의 공개 영상 정보에서, 쿠키 없이 (`credentials: "omit"`)
- 쇼츠 날짜 설정은 `chrome.storage.sync`, 차단 설정, 채널 ID, 이름은 `chrome.storage.local`
- 공개 채널/영상 정보 조회에 쿠키 제외. 차단 목록을 외부 서버에 보내지 않음
- 확장 삭제 시 로컬 차단 목록 삭제
