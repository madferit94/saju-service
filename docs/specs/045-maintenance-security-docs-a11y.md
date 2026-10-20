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
- [ ] 구현을 맡지 않은 서브에이전트의 테스트 작성·보강과 실행: 도시 목록 역할, 한마디 `role="group"`, 화면 전환 초점, 보안 헤더 설정, 미사용 코드 검사.
- [ ] 실제 브라우저에서 도시 목록 키보드 선택, 스크린리더 안내, 화면 전환 후 초점 위치 확인.
- [ ] Vercel 미리보기 또는 운영 주소의 응답 헤더 확인(배포는 이번 범위가 아님).

## 검증 기록 (2026-10-21, 구현 담당)
- `npm audit`(변경 전): next critical 1, sharp high 1, source-map-js high 1 → 3 vulnerabilities (2 high, 1 critical).
- `npm install next@16.3.8 --save-exact` 후 `npm audit fix`(--force 없음) → `found 0 vulnerabilities`. `npm ls`: next@16.3.8, sharp@0.35.5, source-map-js@1.2.2.
- `npx tsc --noEmit --noUnusedLocals`(변경 전): `lib/saju/manse.ts(3,36) 'tenGod'`, `lib/saju/reading.ts(64,10) 'periodContext'` 두 건. 함수 제거 후 함수 안에서만 쓰던 상수 4개가 추가로 보고되어 함께 제거 → 오류 없음.
- `npm run check`: tests 282, pass 282, fail 0.
- `npm run build`(비밀값 환경변수 해제): 성공, 경로 8개 생성.
- `tests/032-doryeong-one-line.test.ts:41`은 `aria-label="내 길을 비추는 한마디"` 문자열 위치를 찾는다. `role="group"`을 앞에 추가해도 같은 문자열이 남아 현재 통과한다. 테스트 갱신 여부는 테스트 담당이 판단한다.
- NOT TESTED: 실제 브라우저·스크린리더·모바일 화면 확인, 테스트 담당의 독립 테스트.
