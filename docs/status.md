# Status

- [ ] 044-lantern-journey-theme.md — 등불 첫 화면·결과 테마 및 v0.3.0 배포

- [x] 043-stars-integrated-reading.md — 귀인·신살 확장, 클릭 상세와 종합 해석

- [x] 042-contextual-reading-quality.md — 조합별 생활 해석·시기 연결·AI 내용 검증 (독립 262개 테스트·빌드·성인/미성년 실응답 검증)

- [x] 039-combined-flow-reading.md — 원국과 시기의 조합 해석 (독립 테스트·로컬 실응답 검증)
- [x] 040-combined-life-flow.md — 균형 변화 그래프와 현재 계절 보강 (독립 테스트·로컬 화면 검증)
- [x] 041-progressive-ai-reading.md — AI 핵심 요약 선표시·부분 재시도·세션 재사용 (전체 246개 테스트·빌드·로컬 성공/실패/재시도 검증)

- [x] `013-deep-consultation.md` 강약·격국·용신 근거와 8장 상담형 풀이 · 자동118개/가상 실응답 확인

- [ ] `011-google-login.md` 구현·인증 페이지 연결 완료 · 실제 계정 로그인/로그아웃 확인 대기
- [ ] `012-account-reading-storage.md` 구현·DB 권한 검증 완료 · 로그인 후 화면 저장/복원 확인 대기

- [x] `010-integrated-fortune.md` 평생·대운·세운·월운 종합 및 개인별 해석 개선

Spec을 만들면 아래 목록에 파일명을 추가합니다. 구현과 검증이 모두 끝난 뒤에만 체크합니다.

## 기능 진행 상황

<!-- 예시: - [ ] `001-save-results.md` -->

- [ ] `001-daewoon-timeline.md` 개인별 대운을 과거·현재·미래 순서로 표시
- [x] `002-balanced-reading.md` 강점과 주의할 점을 함께 제시하는 로컬 해석
- [x] `003-elements-benefactors.md` 오행과 네 종류의 귀인을 함께 표시
- [x] `004-birthplace.md` 출생 국가·도시의 시간대와 경도를 계산에 반영
- [x] `005-korean-city-search.md` 해외 도시를 국가별로 한글 검색
- [ ] `006-gemini-saju-reading.md` 구현 완료 · Google API 크레딧 충전 후 성공 경로 확인 필요
- [x] `007-local-reading-option.md` 계산 결과에서 로컬 규칙 해석을 개인정보 전송 없이 즉시 표시
- [x] `008-reading-depth-and-hanja.md` 네 기둥·오행·귀인·대운을 근거로 깊이 있게 해석하고 한자 독음과 풀이 제공
- [x] `009-lunar-birth-date.md` 양력·음력 생일과 평달·윤달·모름 입력, 윤달 모름 후보 비교

- [x] 014-readable-manse-report.md — 쉬운 8장 상담과 만세력 결과 화면

- [x] 015-life-seasons-and-counselor-voice.md — 개인 대운의 인생 4계절 그래프와 쉬우면서 솔직한 상담

- [x] 016-continuous-reading.md — 운 항목 현황 점검과 연속 읽기 (자동 Gemini 상담 화면은 Spec 017에서 제거)

- [x] 017-life-domain-fortunes.md — 건강·연애·배우자·자녀 등 생활 주제별 운 풀이 확장 (가상 자료 검증, 참가자 화면 확인 전)

- [ ] 018-saju-prompt-redesign.md — 프롬프트 코드·테스트 통과, 가상 Gemini 실응답의 상투 문장 보완 필요

- [x] 019-reading-without-questions.md — 결과의 회고 질문 칸 제거와 생활 운의 근거 해석 추가 (자동 검증, 참가자 화면 확인 전)

- [x] 020-lifetime-explanation-first.md — 평생운의 용어·계산 근거를 해석보다 먼저 표시 (자동 검증, 참가자 화면 확인 전)

- [ ] 021-daily-fortune-cron.md — 한국 시간 오전 9시 오늘의 운세와 Vercel 예약 작업

- [x] 022-daily-fortune-toggle.md — 오늘의 운세 접기·펼치기 (로컬 검증, 참가자 확인 전)

- [x] 023-plain-fortune-language.md — 오늘·연·월 운세를 쉬운 문장으로 표현 (로컬 검증, 참가자 확인 전)

- [x] 024-independent-life-graph.md — 사주 기반 인생 흐름 그래프와 현재 4계절·개운법 분리 (관계 단서 개수 기준)

- [x] 025-reading-focus-and-clarity.md — 해석의 읽기 순서·근거 연결·문장 품질 개선

- [x] 026-life-peak-graph.md — 단순한 인생 흐름과 전성기 후보 표시 (자동 검증, 화면 확인 전)

- [x] 027-night-sky-readability.md — 밤하늘과 별똥별 화면, 본문 가독성 개선 (로컬 검증, 참가자 확인 전)

- [x] 028-life-period-notes.md — 인생 그래프 시기별 경험 한 줄 메모 (로컬 검증, 참가자 확인 전)

- [x] 029-evidence-disclosure-cleanup.md — 근거 접기 창 정리와 프롬프트 대안 조사 (자동·Vercel 미리보기 검증)

- [x] 030-default-korea-country.md — 출생 국가는 대한민국 기본값, 다른 나라 선택 가능 (로컬 검증, 참가자 확인 전)

- [x] 031-direct-saju-language.md — 결과 화면의 계산 상태 표현을 사주 풀이 문장으로 변경 (로컬 검증, 참가자 확인 전)

- [x] 032-doryeong-one-line.md — 사주 계산 결과 맨 앞의 도령 한줄평 (로컬 검증, 참가자 확인 전)

- [x] 033-doryeong-share-card.md — 한줄평만 담은 이미지 카드 저장·공유 (로컬 검증, 실제 기기 확인 전)

- [x] 034-result-pages.md — 결과 메뉴를 항목별 화면 전환으로 변경 (로컬 검증, 참가자 확인 전)

- [x] 035-plain-grounded-gemini-prompt.md — 쉬운 말과 계산 근거에 맞는 Gemini 풀이 초안 적용 (자동 검증, 참가자 화면 확인 전)

- [x] 036-direct-balance-reading.md — 균형·도움의 중복 안내 제거와 계산 근거를 살린 직접 풀이 (로컬 검증, 참가자 확인 전)

- [x] 037-one-step-gemini-reading.md — 출생 입력 한 번으로 Gemini 해석 추가 (자동 검사·로컬 화면 확인, 참가자 확인 전)
- [x] 038-single-saju-entry.md — 하나의 “내 사주 보기” 버튼으로 계산과 AI 풀이 시작 (자동 검사 완료, 화면 확인 전)
