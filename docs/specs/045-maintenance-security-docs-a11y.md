# 유지보수: 보안 패치·문서·접근성

## 배경
- 2026-10-21 점검에서 의존성 보안 취약점, 예전 Starter 안내로 남은 README, 문서 간 오래된 기록, 쓰이지 않는 코드, 기본 보안 헤더 부재와 일부 접근성 문제가 확인됐다.
- 기능·사주 계산·AI 지시문·저장 형식은 바꾸지 않는 정리 작업이다. 버전·태그·배포는 이번 범위가 아니다.

## 요구사항
1. 보안 패치: `npm audit`의 `next` 16.0.0–16.3.7(critical: next/og 원격 코드 실행, 캐시 오염, 이미지 최적화 SSRF 등), `sharp` <0.35.5(high), `source-map-js` ≤1.2.1(high)을 해결한다. `next`는 16.3.5 → 16.3.8 패치만 올리고 다른 major/minor는 유지한다. `npm audit fix`는 `--force` 없이 실행한다.
2. README: `README.md`(영문)와 `README.ko.md`(한글)를 외부인이 읽을 수 있는 쉬운 말로 다시 쓴다. 서비스 이름, 운영 주소, 주요 기능, 개인정보 처리(Gemini에는 계산 자료만 전송, 비로그인 결과는 localStorage, 로그인 저장은 Supabase 본인 전용 RLS), 기술 스택, Node ≥22.9, 명령어, 환경변수별로 없을 때 멈추는 기능, 폴더 구성, Spec/status 작업 방식, 참고용이며 조언이 아니라는 안내를 담는다. 언어 전환 링크를 유지한다.
3. 문서 정리(문구만, 체크박스 변경 없음): `docs/status.md`를 Spec 번호순으로 정렬하고 형식을 통일한다. Spec 006·008에 이후 Spec 035~044에서 실제 Gemini HTTP 200 응답이 기록됐다는 메모를 추가한다. Spec 037·038의 “GitHub·Vercel 미반영”을 v0.2.0/v0.3.0 반영 사실로 정정한다.
4. 쓰이지 않는 코드 제거: `lib/saju/manse.ts`의 `tenGod` import, `lib/saju/reading.ts`의 `periodContext()`와 그 함수에서만 쓰던 상수.
5. 기본 보안 헤더: `next.config.ts`의 `headers()`로 모든 경로에 `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`을 붙인다. CSP는 이번 변경에 넣지 않는다.
6. 접근성:
   - 도시 검색 결과는 콤보박스 연결 없이 `listbox`/`option` 역할을 쓰고 있었다. 역할을 빼고 이름이 붙은 목록(`ul`/`li`) 안의 일반 버튼으로 바꾼다.
   - ‘내 길을 비추는 한마디’ 영역의 `aria-label`이 역할 없는 `div`에 붙어 있었다. `role="group"`을 추가한다.
   - 결과 메뉴로 화면을 바꾸면 새 화면의 제목으로 초점을 옮긴다. 제목은 `tabIndex={-1}`로 프로그램 초점만 받게 한다.

## 바꾸지 않는 것
- `supabase/migrations/*`, Gemini 지시문과 품질 검사 파일, 버전 상수·캐시 키, 모델 ID·토큰 한도·시간 제한, `vercel.json` 예약 작업과 `/api/cron/daily`, 저장 형식, `lib/saju` 계산, 도시 별칭 자료, 첫 화면 이미지, `package.json` 이름, CHANGELOG·버전·태그, 상담 패널과 `/api/consultation`, 요청 수 제한(소유자 결정 대기).

## 구현 내용
- `package.json`의 `next`를 16.3.8로 고정하고 `npm audit fix`로 lockfile의 `sharp` 0.35.5(및 `@img/sharp-*` 0.35.5, `@img/sharp-libvips-*` 1.3.4), `source-map-js` 1.2.2를 반영했다.
- `README.md`, `README.ko.md`를 다시 썼다. 환경변수 표의 동작은 코드(`lib/supabase/client.ts`, `app/api/reading/route.ts`, `app/api/cron/daily/route.ts`)와 로컬 서버 응답으로 확인했다.
- `docs/status.md`를 번호순·`- [ ] \`NNN-name.md\` — 설명` 형식으로 정리했다. 기존 44개 항목의 체크 상태는 그대로다.
- Spec 006·008에 후속 기록을 추가하고, Spec 037·038의 반영 상태를 정정했다(근거: Spec 파일의 마지막 변경 커밋 9d61c51이 `v0.2.0`·`v0.3.0` 태그에 포함, `v0.2.0` 시점 `app/saju-form.tsx`에 “내 사주 보기” 단일 버튼 존재, Spec 044의 v0.3.0 운영 배포 기록).
- `lib/saju/manse.ts`의 `tenGod` import, `lib/saju/reading.ts`의 `periodContext()`와 그 함수에서만 쓰던 `stemElements`·`branchElements`·`stems`·`branches` 상수를 지웠다.
- `next.config.ts`에 기본 보안 헤더 네 가지를 추가했다.
- `app/saju-form.tsx`: 도시 결과를 `<ul aria-label="도시 검색 결과">`의 `<li><button>`으로 바꾸고(`app/globals.css`에 목록 기본 여백·글머리표 제거), 한마디 영역에 `role="group"`을 추가했다. `navigateTo`가 초점 요청을 남기면 화면이 바뀐 뒤 입력 화면은 `#input-title`, 사주표는 `#result-title`, 나머지 화면은 입력 영역·메뉴 밖의 첫 `h2`로 초점을 옮긴다. 두 제목에는 `tabIndex={-1}`을 넣었고, 다른 패널의 제목은 초점을 옮길 때 `tabindex="-1"`을 붙인다. 새 훅은 기존 훅 뒤에 두어 기존 테스트의 훅 순서 가정을 바꾸지 않았다.

## 검증
- [x] `npm ci` 후 `npm audit`: 0 vulnerabilities.
- [x] `npx tsc --noEmit --noUnusedLocals`: 오류 없음.
- [x] `npm run check`: 타입 검사 및 기존 282개 테스트 통과(구현 담당 실행).
- [x] 비밀값 없이 `npm run build` 성공(Next.js 16.3.8).
- [x] 로컬 프로덕션 서버(`next start`)에서 `/`, `/api/locations` 응답의 보안 헤더 네 가지 확인. 비밀값 없이 `/api/reading` HTTP 503 `missing_api_key`, `/api/cron/daily` HTTP 401 확인.
- [x] 구현을 맡지 않은 서브에이전트의 테스트 작성·보강과 실행: 도시 목록 역할, 한마디 `role="group"`, 화면 전환 초점, 보안 헤더 설정, 미사용 코드 검사(아래 테스트 담당 기록).
- [ ] 실제 브라우저에서 도시 목록 키보드 선택, 스크린리더 안내, 화면 전환 후 초점 위치 확인. (헤드리스 Chrome 키보드 확인은 통과, 스크린리더·실제 모바일 기기는 미확인 — 아래 기록)
- [ ] Vercel 미리보기 또는 운영 주소의 응답 헤더 확인(배포는 이번 범위가 아님).

## 검증 기록 (2026-10-21, 구현 담당)
- `npm audit`(변경 전): next critical 1, sharp high 1, source-map-js high 1 → 3 vulnerabilities (2 high, 1 critical).
- `npm install next@16.3.8 --save-exact` 후 `npm audit fix`(--force 없음) → `found 0 vulnerabilities`. `npm ls`: next@16.3.8, sharp@0.35.5, source-map-js@1.2.2.
- `npx tsc --noEmit --noUnusedLocals`(변경 전): `lib/saju/manse.ts(3,36) 'tenGod'`, `lib/saju/reading.ts(64,10) 'periodContext'` 두 건. 함수 제거 후 함수 안에서만 쓰던 상수 4개가 추가로 보고되어 함께 제거 → 오류 없음.
- `npm run check`: tests 282, pass 282, fail 0.
- `npm run build`(비밀값 환경변수 해제): 성공, 경로 8개 생성.
- `tests/032-doryeong-one-line.test.ts:41`은 `aria-label="내 길을 비추는 한마디"` 문자열 위치를 찾는다. `role="group"`을 앞에 추가해도 같은 문자열이 남아 현재 통과한다. 테스트 갱신 여부는 테스트 담당이 판단한다.
- NOT TESTED: 실제 브라우저·스크린리더·모바일 화면 확인, 테스트 담당의 독립 테스트.

## 검증 기록 (2026-10-21, 테스트 담당 서브에이전트 — 구현에 참여하지 않음)
- 추가한 테스트: `tests/045-a11y-security-cleanup.test.ts` 11개. 실제 `app/saju-form.tsx`를 vm에서 실행하는 하네스 `tests/helpers/saju-form-harness.ts`를 새로 만들었다(훅 순서 번호 대신 효과 본문 문자열로 효과를 찾고, 출생지는 실제 도시 검색 목록을 눌러 고른다). 기존 `tests/account-ui-races.test.ts`의 `slots[16]`·`effects[1]` 가정은 그대로 두었고 계속 통과한다.
  - 도시 결과: `ul[aria-label="도시 검색 결과"] > li > button[type=button]`, 화면 어디에도 `role="listbox"`·`role="option"`·`aria-selected` 없음, 버튼을 누르면 출생지 선택·목록 닫힘, 고른 도시로 제출하면 출생지 오류 없이 계산.
  - 한마디 영역 `role="group"` + `aria-label`, `#input-title`·`#result-title`의 `tabIndex={-1}`.
  - 초점: 첫 화면·브라우저 저장본 자동 복원에서는 초점 이동 없음. 계정 결과 열기 → `#result-title`, 메뉴로 daily·elements·balance·graph·seasons·flow·domains·chart·input 이동 → 각 화면의 제목 h2(`tabindex="-1"`, `preventScroll: true`)로 한 번만 이동. 다른 화면에서 숨겨진 입력 영역의 h2(보관함·입력 제목)는 건너뜀.
  - `next.config.ts` `headers()`: `/:path*` 한 규칙에 네 헤더가 정확히 이 순서·값으로 있고 CSP 없음, 기존 `agentRules`·`experimental` 유지.
  - 미사용 코드: 테스트 안에서 TypeScript API로 `tsconfig.json` + `noUnusedLocals` 검사 → 진단 0건. `tenGod` import·`periodContext` 계열 상수가 다시 들어오지 않았는지 확인.
- `tests/032-doryeong-one-line.test.ts:41`은 고치지 않았다. 문자열 위치(한마디가 만세력보다 먼저)를 보는 테스트라 여전히 유효하고, `role="group"`은 새 테스트가 렌더 결과에서 직접 확인한다.
- 테스트가 실제로 잡는지 확인(구현을 잠시 바꿨다가 `git checkout`으로 원복): 입력 영역 제외 조건 삭제, `role="group"` 삭제, 첫 화면 초점 방지(`pageFocusRequest === 0`) 삭제, 도시 버튼에 `role="option" aria-selected` 복귀, CSP 헤더 추가 → 모두 새 테스트가 실패로 잡음.
- 명령과 결과:
  - `npm ci` → 설치 성공, `found 0 vulnerabilities`.
  - `npm run check` 변경 전(구현 커밋 그대로) tests 282 / pass 282 / fail 0 → 테스트 추가 후 tests 306 / pass 306 / fail 0.
  - `npx tsc --noEmit --noUnusedLocals` → 오류 없음(exit 0).
  - `npm audit` → `found 0 vulnerabilities`.
  - 비밀값 환경변수 없이 `npm run build` → 성공(Next.js 16.3.8, 경로 8개).
- 실제 브라우저(Playwright + 설치된 Google Chrome 헤드리스, `next start` 로컬 프로덕션 서버, 폼 제출 없음): 26개 확인 항목 모두 통과(데스크톱 1280×720, 모바일 375×812 에뮬레이션 각각).
  - `/` 응답 헤더 네 가지 확인, CSP 없음.
  - 첫 화면 초점은 body. Tab 12번으로 도시 칸 도달 → “서울” 입력 → 접근성 트리 `list "도시 검색 결과" > listitem > button` → Tab 2번으로 첫 도시 버튼 → Enter로 선택(“선택: 대한민국 · Seoul · Asia/Seoul”).
  - 브라우저 저장본을 연 직후 초점 이동 없음. 결과 메뉴 링크에 초점을 두고 Enter로 9개 화면을 오가면 각각 해당 h2(`tabindex="-1"`)에 초점이 간다. h2는 Tab 순서에 들어가지 않는다.
  - 전체 과정에서 `/api/reading`·`/api/consultation` 요청 0건.
- 관찰(요구사항 위반은 아님, 판단 필요): 메뉴 이동 때 `window.scrollTo({ top: 0 })` 뒤 `focus({ preventScroll: true })`를 하므로 초점이 간 제목이 첫 화면 영역 밖에 있다. 측정값: 데스크톱 1280×720에서 제목 top 882–1004px, 모바일 375×812에서 983–1092px, 모두 scrollY 0. 화면을 보는 키보드 이용자는 초점 위치를 바로 보지 못한다. 스크린리더 안내는 제목을 읽을 것으로 예상되나 확인하지 않았다.
- NOT TESTED: 실제 스크린리더(VoiceOver·NVDA·TalkBack) 안내, 실제 모바일 기기, Vercel 미리보기·운영 주소의 응답 헤더(배포는 범위 밖), 브라우저 뒤로 가기(popstate)로 화면이 바뀔 때의 초점 동작.

## 후속 수정: 화면 전환 후 초점 제목이 보이지 않던 문제 (2026-10-21, 구현 담당)
- 근거: 테스트 담당의 실제 브라우저 측정에서 메뉴 이동 때 `window.scrollTo({ top: 0 })` 뒤 `focus({ preventScroll: true })`를 해서, 초점을 받은 제목이 scrollY 0에서 데스크톱 1280×720 기준 882–1004px, 모바일 375×812 기준 983–1092px에 있어 화면 밖이었다. 화면을 보는 키보드 이용자가 초점 위치를 볼 수 없었다.
- 수정(`app/saju-form.tsx` 초점 효과): 초점을 옮기기 전에 제목의 화면 위치를 재고, 화면 밖(위나 아래로 벗어남)이면 `scrollIntoView({ block: "start", behavior: "auto" })`로 제목을 화면 위쪽에 맞춘다. 그다음 기존처럼 `focus({ preventScroll: true })`로 초점을 옮긴다. 이미 보이는 제목이면 `navigateTo`의 맨 위 위치를 그대로 둔다. 앱 CSS에는 부드러운 스크롤 설정이 없고 `behavior: "auto"`라 동작 줄이기 설정과 상관없이 즉시 이동한다.
- 수정(`app/globals.css`): id가 없는 제목(오행·십성 화면의 h2)도 다른 제목과 같이 위쪽 24px 여백을 두고 맞춰지도록 `h2[tabindex="-1"]`에 `scroll-margin-top: 24px`를 더했다(초점 테두리가 화면 위끝에 잘리지 않게).
- 첫 화면·저장본 자동 복원 때는 기존처럼 초점 요청이 없어(`pageFocusRequest === 0`) 초점과 스크롤이 움직이지 않는다.
- 입력 화면도 scrollY 0에서는 첫 화면 이미지와 보관함 아래(데스크톱 기준 제목 top 1003px)에 제목이 있어 화면 밖이었다. 따라서 입력 화면으로 갈 때도 ‘언제 태어나셨나요?’ 제목이 화면 위쪽에 오고, 그 위의 첫 화면 이미지·보관함은 화면 밖으로 올라간다(보관함은 Shift+Tab으로 닿는다). 맨 위를 보여 줄지 제목을 보여 줄지는 화면 확인 때 판단이 필요하다.
- 실제 브라우저 확인(Claude 브라우저 창, `next start` 로컬 프로덕션 서버, 2015년 기준 브라우저 저장본, 폼 제출·AI 요청 없음):
  - 데스크톱 1280×720, 모바일 375×812에서 메뉴로 daily·elements·balance·graph·seasons·flow·domains·chart·input 9개 화면을 차례로 열었을 때 초점 제목이 모두 화면 안에 있었다. 대부분 제목 top 약 24px(scroll-margin). 오늘의 운세는 화면 내용이 짧아 더 내려가지 않아 top 490px(데스크톱)·639px(모바일)이지만 화면 안이다.
  - 데스크톱에서 메뉴 링크에 초점을 두고 실제 Enter 키로 ‘인생 4계절’을 열면 `#life-seasons-title`에 초점, top 23.9px, 화면 안. 저장본 자동 복원 직후 초점은 body.
- 명령: `npm run check` tests 306 / pass 306 / fail 0, `npx tsc --noEmit --noUnusedLocals` 오류 없음, 비밀값 없이 `npm run build` 성공.
- NOT TESTED: 실제 동작 줄이기(prefers-reduced-motion) 설정 화면, 스크린리더, 실제 모바일 기기, 브라우저 뒤로 가기(popstate) 때의 스크롤·초점. 테스트 하네스의 가짜 요소에는 `getBoundingClientRect`·`scrollIntoView`가 없어 새 스크롤 분기는 자동 테스트에서 실행되지 않는다.

## 후속 수정 검증 (2026-10-21, 테스트 담당 서브에이전트 — 32429b1 구현에 참여하지 않음)
- 자동 테스트 보강(`tests/045-a11y-security-cleanup.test.ts` 3개 추가, 이 파일은 총 14개): 하네스의 가짜 요소에 `getBoundingClientRect`·`scrollIntoView`와 `window.innerHeight`(720)를 넣었다.
  - 제목이 화면 아래 밖(top 900px)이면 9개 화면 모두 `navigateTo`가 맨 위로 한 번 올린 뒤 같은 제목에 `scrollIntoView({ block: "start", behavior: "auto" })` 정확히 한 번 → `focus({ preventScroll: true })` 순서.
  - 위로 벗어남(top −30)·아래 끝 1px 초과(bottom 721)는 스크롤, 화면 안(0–720, 24–64, 680–720)은 스크롤 없이 초점만.
  - 첫 화면·브라우저 저장본 자동 복원은 제목이 화면 밖이어도 `scrollTo`·`scrollIntoView`·`focus` 모두 0회.
  - 구현을 잠시 바꿔 확인 후 원복: 스크롤 분기 삭제(3개 실패), 항상 스크롤(2개 실패), `behavior: "smooth"`(1개 실패), 초점 뒤에 스크롤(3개 실패).
- 실제 브라우저(Playwright + 헤드리스 Chrome, `next start`, 2015년 기준 브라우저 저장본, 폼 제출 없음): 데스크톱 1280×720·모바일 375×812 × 동작 줄이기 끔/켬(`reducedMotion: "reduce"`, `matchMedia` 일치 확인) 4가지 조건에서 각 16개 항목 모두 통과.
  - 자동 복원 직후 초점 body·scrollY 0.
  - 메뉴 링크에서 Enter로 9개 화면(입력 화면 포함)을 열면 초점 제목이 모두 화면 안. 데스크톱 top 24.2–24.4px(오늘의 운세만 490px, 내용이 짧아 더 내려가지 않음), 모바일 top 23.6–24.4px(오늘의 운세 640px). 두 번의 프레임 뒤와 0.4초 뒤의 scrollY·제목 위치가 같아 바로 이동했다. 동작 줄이기 켬/끔 결과가 같다.
  - 브라우저 뒤로 가기 3번·앞으로 가기 1번: 화면이 바뀌고 초점이 그 화면의 h2로 가며 화면 안에 있다. 이때 스크롤 위치는 브라우저의 기록 복원 위치라 제목이 화면 아래쪽에 올 수 있다(데스크톱 top 490–609px, 모바일 518–742px). 뒤로 가기에도 초점이 옮겨지는 것은 초점 효과가 `activePage` 변경에도 실행되기 때문이다.
  - `/api/reading`·`/api/consultation` 요청 0건.
- 명령: `npm run check` tests 309 / pass 309 / fail 0(이전 306에서 3개 추가). `npx tsc --noEmit --noUnusedLocals` 오류 없음. 비밀값 없이 `npm run build` 성공.
- NOT TESTED: 실제 스크린리더 안내, 실제 모바일 기기(에뮬레이션만), 운영체제의 실제 동작 줄이기 설정(브라우저 에뮬레이션만), Vercel 응답 헤더.
