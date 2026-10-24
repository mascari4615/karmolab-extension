# Local development changes

- 미확인 Shorts 판정 전 가림과 조회 실패 재시도. 댓글/영상/Shorts 키워드 체크 분리. 현재 페이지의 가린 항목 수와 이유, 한 번 보기와 항목별 예외 허용/해제.
- 시간과 닉네임, 본문을 한 줄에 배치하는 컴팩트 댓글. 홈 일반 영상 카드 크기 3단계, 화면 밀도 설정과 백업 연결.

- 차단 판정 즉시 원문과 썸네일 가림, 중립색 자리만 퇴장. 같은 키워드 목록으로 댓글과 영상/Shorts 제목 숨김, 설정 표시 범위 갱신.
- 차단 직후 되돌리기, 관리 패널의 쇼츠 날짜와 집계 설정, 유튜브 설정과 차단 목록 JSON 백업/합쳐 복원.

- 차단 클릭은 저장 먼저, 채널 정보 보완은 뒤에서 처리. 영상 소유자 탭 캐시와 화면 우선 조회, 관련 변경만 검사. 보이는 항목은 140ms 퇴장과 180ms 재배치, 동작 줄이기 설정 존중.

- 검색 결과의 차단 채널 카드와 빈 영상 묶음 숨김. Shorts 카드의 바깥 칸 제거와 남은 카드 앞당김, 차단 해제 시 복원.
- 유튜브 상단 KarmoLab 버튼과 오른쪽 관리 패널. 번역, 키워드, 차단 목록 검색과 해제, 기존 팝업과 설정 공유.

- 유튜브 댓글과 답글의 한국어 번역 버튼 자동 클릭, 기본 켜짐과 팝업 중지. 원문 보기 선택 보존.

Not a store submission or a release approval. Keep the manifest version during local iteration.
Identify trial builds by Git commit and package SHA256. Choose a version once for an approved release bundle.

- Base64 HTTP/HTTPS links on individually enabled sites; compact destination links with source disclosure.
- Daily unique Shorts and views including revisits, three display modes below the date.
- Home and subscription video card blocking with current metadata markup.

At release preparation, collect the approved changes into the selected version's certification notes.
## 쇼츠 시청 시간 (로컬)

- 날짜 아래 영상 수/횟수 옆 실제 시청 시간, 시간 표시 체크 추가
- 배속은 경과 시간 기준, 겹친 탭 재생 한 번 합산, 숨김/정지/광고 제외
- 0.4.0 개발 번호 유지, 스토어 제출 없음

## 댓글 키워드와 사이트 음량 (로컬)

- 등록한 단어가 포함된 유튜브 댓글 접기, 펼치기와 즉시 중지
- 사이트별 0-300% 음량 기억. 100% 초과는 새 탭에서 확장 적용 필요
- 탭 소리 재생용 offscreen, 선택 tabCapture 권한. 녹음/마이크/외부 전송 없음
- 100% 이하 HTML 영상/오디오 다음 방문 복원, 증폭 중지와 탭 종료 시 연결 해제
