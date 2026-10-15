# KarmoLab 확장 (Chrome, Edge MV3)

스토어 배포용 확장. 개발용 확장 (Mascari4615.github.io 의 `apps/karmo-web-extension`) 과 별개. 기존 유튜브 기능은 `storage` 와 `www.youtube.com` 사용. Base64 링크 찾기는 `activeTab`, `scripting`과 사용자가 켠 사이트의 선택 접근 권한 사용.
정본: `memo/projects/karmolab/apps/karmolab-extension.md`

## 기능

| 기능 | 파일 | 끄기 |
| --- | --- | --- |
| 쇼츠 올린 날짜 표시 | `features/shorts-date.js`, `.css` | 팝업 체크 (`chrome.storage.sync` 의 `shortsDate`) |
| 오늘 본 쇼츠의 영상 수와 재시청 포함 횟수 | `features/shorts-count.js`, 날짜 배지 아래 표시 | 팝업 집계 체크와 표시 설정 (`chrome.storage.local`) |
| 사용자 차단: 영상, 쇼츠, 댓글 숨김 | `features/user-block.js`, `.css` | 팝업 체크, 차단 목록의 해제 (`chrome.storage.local`) |
| Base64 웹 주소 링크화 | `features/base64-core.js`, `base64-links.js`, `.css` | 팝업의 이 사이트에서 켜기/끄기 (`chrome.storage.local`) |

새 기능은 `features/` 에 파일 한 쌍, 팝업에 체크 하나, `_locales` 문구.

## Base64 링크 찾기 (0.3.0)

일반 웹페이지에서 확장 팝업의 **이 사이트에서 켜기** → 브라우저가 요청하면 해당 사이트 접근 허용. 본문과 댓글의 Base64가 완전한 HTTP/HTTPS 주소면 목적지 도메인의 링크로 표시. 0.3.1부터 원문은 보존하되 기본으로 접고, 옆 화살표로 펼쳐 선택/복사 가능. 링크는 본문 글꼴과 색을 따르며 클릭할 때 새 탭으로 열기. 디코딩 서버, 원문 전송, 목적지 미리 요청 없음.

사이트별 기본값은 꺼짐. 켠 사이트는 다음 방문에도 동작하며 새 댓글도 처리. **이 사이트에서 끄기**로 원문 복원과 자동 실행 등록 해제, 추가 사이트 권한 회수. 기존 유튜브 기능이 쓰는 필수 접근은 유지. 사이트는 프로토콜과 호스트 단위이며 같은 호스트의 포트는 공유.

표준 Base64, URL-safe, 패딩 생략 지원. 스크립트 주소, 계정/암호 포함 URL, 제어문자, 잘못된 인코딩은 무시. 입력창, 편집 영역, 기존 링크와 코드 블록은 건드리지 않음. 브라우저 설정/확장 스토어, iframe/Shadow DOM, 줄바꿈으로 분리된 토큰은 지원 범위 밖.

브라우저 시험: `node scripts/verify-base64.cjs`. 임시 확장 설치의 로컬 fixture 호스트만 사전 허용하여 실제 팝업, 자동 등록, 주입, 동적 본문, 복원을 검증. 운영 manifest의 선택 권한 승인창과 사용자의 실제 설치본 적용은 별도 확인 대상.

홈/구독/검색 카드의 영상 정보 아래, 댓글의 좋아요/답글 줄 또는 영상/쇼츠의 구독 버튼 뒤 **차단** → 확인. 차단한 부모 댓글은 답글까지, 차단한 답글 작성자는 해당 답글만 숨김. 직접 연 차단 영상/쇼츠는 재생을 멈추고 안내 표시. 팝업의 **해제**로 복원. 유튜브 계정의 차단 설정과 별개이며, 목록은 이 브라우저에만 저장.

## 오늘 본 쇼츠 (0.4.0)

시청 시간도 함께 표시: `오늘 12개 / 18회 / 23분`. 1분 미만은 초, 1시간 이상은 시간/분. 팝업의 **시청 시간 함께 표시**로 시간만 숨겨도 기록 유지. 집계 체크를 끄면 영상 수, 횟수와 시간 수집 모두 중지.

시청 시간은 기능 적용 뒤부터 기록. 보이는 현재 쇼츠가 실제로 재생한 시간이며 2초 미만 시청과 같은 영상의 자동 반복도 포함. 2배속으로 10초 시청하면 실제 경과 10초로 집계. 일시 정지, 버퍼링, 광고, 차단, 숨긴 탭, 화면 밖 재생과 탐색 점프 제외. 여러 탭의 겹친 재생 구간은 한 번만 합산.

5초마다 저장하고 탭 숨김, 페이지 이탈, 집계 중지 때도 저장 시도. 브라우저 강제 종료 시 마지막 5초 안팎은 저장되지 않을 수 있음. 기존 영상 수/횟수에서 과거 시청 시간을 추정하지 않음. 같은 기기의 현지 자정 초기화, 로컬 저장만 사용. 시간만의 저장 실패도 기존 숫자로 감추지 않고 오류 표시.

날짜 아래 기본 표시 **오늘 12개 / 18회**. 영상 수는 같은 영상 하루 한 번, 횟수는 다른 쇼츠로 이동했다 돌아온 재시청 포함. 팝업에서 영상 수, 재시청 포함 횟수, 둘 다 중 선택. 표시 설정을 바꿔도 두 수치의 기록 유지.

활성 쇼츠 플레이어가 화면에 절반 이상 보이고 탭이 보이는 상태에서 실제로 2초 재생하면 집계. 일시 정지, 버퍼링, 광고, 차단 덮개, URL과 영상 DOM이 다른 전환 구간은 제외. 같은 화면의 자동 반복은 새로운 방문으로 세지 않음. 과거 유튜브 기록을 가져오지 않으며 기능을 켠 뒤부터 집계.

기기 현지 자정에 초기화, 이전 날짜의 영상 ID/방문 기록 삭제. 이 브라우저의 로컬 저장소만 사용하며 서버 전송 없음. 방문마다 별도 키로 저장해 여러 탭의 수 증가가 서로 덮어쓰지 않음. 집계 체크를 끄면 새 기록과 표시 중지, 오늘의 기존 기록 유지. 날짜 표시를 꺼도 집계 표시 독립 동작. 읽기/저장 실패는 배지에 표시.

검증: `node --test`, `node scripts/verify-shorts-count.cjs`. 브라우저 시험은 임시 프로필의 실제 확장, 재생되는 MediaStream 시험 영상, 홈/구독 레이아웃 fixture와 팝업 사용. `VERIFY_PUBLIC=1`은 공개 유튜브 채널의 카드도 검증. 로그인한 사용자의 홈/구독 실제 설치본은 별도 확인. `node scripts/preview-shorts-count.cjs`로 직접 조작할 미리보기.

표시 이름 대신 채널 핸들/ID로 구분. 공개 채널 페이지 조회 성공 시 둘을 연결. 작성자 링크가 없는 썸네일은 공개 영상 정보 조회, 동시 요청 최대 3개. 조회 실패, 미지원 레이아웃은 추측해서 숨기지 않음. 핸들 변경, 로그인 전용 콘텐츠, 라이브 채팅은 지원 보장 범위 밖.

브라우저 검증: Playwright 설치 후 `node scripts/verify-user-block.cjs` (Edge, 격리된 DOM 시험), `node scripts/verify-user-block-live.cjs` (번들 Chromium, 실제 확장과 공개 유튜브). `PLAYWRIGHT_MODULE`로 모듈 경로, `VERIFY_OUTPUT`으로 캡처 경로 지정 가능. `VERIFY_MUTATION=1`은 차단 판정 제거 후 검사 실패 확인용. 실제 시험은 임시 프로필만 사용.

## 로컬로 써 보기

1. `edge://extensions` 또는 `chrome://extensions` 에서 개발자 모드
2. 압축해제된 확장 로드 -> 이 폴더

### 개발 중 다시 읽기

로컬 수신기를 처음 추가한 설치본은 확장 관리의 다시 로드 1회 필요. 이전 코드에는 수신기가 없으므로 소스 변경이나 유튜브 새로고침만으로 활성화되지 않음. 그 뒤에는 에이전트가 설치 경로에서 실행:

```
node scripts/reload-local.mjs
```

기본 ID는 이 PC의 로컬 KarmoLab. 다른 설치는 `--id <확장 ID>`, 다른 소스 폴더는 `--root <설치 폴더>`. KarmoDevExtension의 갱신 명령과 별도. 실행할 때만 127.0.0.1:17379에서 최대 65초 대기, 알람으로 명령을 받은 KarmoLab이 자기 자신을 다시 읽고 열린 유튜브 페이지 새로고침. 다른 사이트는 필요할 때 페이지 새로고침. 새 창이나 새 탭 생성 없음.

완료 판정은 버전 번호가 아니라 새 실행 식별자, 현재 소스의 SHA256, 갱신 요청 응답 모두 일치. 응답 없음/포트 점유/새 코드 불일치는 실패. 명령 서버 없이 상시 로컬 서버 실행 불필요. 로컬 연결은 확장 ID와 전용 헤더 확인, 웹페이지 Origin 및 preflight 거부. 임의 코드나 페이지 조작 명령 미지원.

로컬 manifest의 개발용 background, alarms, loopback 접근은 `pack.mjs`에서 제거. 스토어 ZIP에 개발 수신기 파일 제외. 버전 0.4.0 유지. `node scripts/verify-local-reload.cjs`는 임시 Edge 프로필에서 같은 버전의 코드 변경과 자기 재로드, 유튜브 재주입을 두 차례 검증. `VERIFY_BROWSER=chromium`은 추가 Chromium 시험용.

## 스토어 zip

```
node pack.mjs
```

`dist/karmolab-<버전>.zip`. 로컬 개발과 화면 수정마다 manifest 버전을 올리지 않음. 같은 개발 묶음에서는 번호 고정, 서로 다른 작업본은 Git 커밋과 ZIP SHA256으로 구분.

사용자 체험 뒤 배포를 맡긴 릴리스 묶음을 확정할 때 스토어에 제출한 버전과 비교해 다음 번호를 한 번 선택. 이미 정한 미제출 버전은 묶음 확정 시 그대로 사용할 수 있음. 현재 0.4.0은 로컬 개발 번호, 스토어 제출이나 공개 증거 아님. CI는 같은 번호의 runtime 수정 허용, 번호를 바꿀 때의 역행은 차단.

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
