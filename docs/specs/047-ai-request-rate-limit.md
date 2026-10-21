# AI 요청 남용·비용 방지: 같은 사이트 확인과 요청 수 제한

## 배경
- `/api/reading`은 제출 한 번에 Gemini를 최대 3번(요약 1번, 상세 최대 2번) 부르고 상세는 출력 16,384토큰·90초 제한을 쓴다. `/api/consultation`은 `maxDuration` 240초, 8,192토큰 호출을 최대 2번 한다.
- 두 경로 모두 로그인·요청 수 제한이 없고 `consent: true`는 요청 본문의 값일 뿐이라, `curl`만으로 누구나 프로젝트의 Gemini 크레딧을 쓸 수 있었다. Spec 045에서 “요청 수 제한(소유자 결정 대기)”로 남겼고, 소유자가 수정을 승인했다.
- `/api/consultation`은 현재 `app/` 화면에서 부르지 않고 `scripts/verify-deep-consultation.ts`만 부른다. Spec 017에 따라 API 형식은 지우지 않는다.

## 요구사항
1. 같은 사이트 확인(두 경로 공통, 본문을 읽기 전): `Origin` 헤더가 있으면 허용 목록과 비교하고, 없으면 `Sec-Fetch-Site`를 본다. 다른 사이트의 브라우저 요청이면 HTTP 403, 오류 코드 `forbidden_origin`.
   - 허용: 요청을 받은 서버 자신의 주소(`Host` 헤더·요청 URL의 호스트), `https://saju-service-steel.vercel.app`, Vercel 환경변수 `VERCEL_URL`·`VERCEL_BRANCH_URL`·`VERCEL_PROJECT_PRODUCTION_URL`의 https 주소, 개발 중(`NODE_ENV`가 `production`이 아님)의 `localhost`·`127.0.0.1`·`[::1]`.
   - `Sec-Fetch-Site`는 `same-origin`·`none`만 허용하고 `cross-site`·`same-site`는 막는다. `Origin: null`도 막는다.
   - `Origin`과 `Sec-Fetch-Site`가 모두 없는 요청(`curl`·스크립트)은 통과시켜 요청 수 제한만 적용한다. 로컬 `scripts/verify-deep-consultation.ts`가 계속 동작해야 하기 때문이다.
2. 요청 수 제한: 서버 메모리의 슬라이딩 윈도 방식. 이용자 구분은 `x-forwarded-for`의 첫 IP, 없으면 `x-real-ip`, 둘 다 없으면 공통 값 하나.
   - 기본값(10분 창): `/api/reading` IP당 6건·서버 인스턴스 전체 60건, `/api/consultation` IP당 3건·전체 20건.
   - 넘으면 HTTP 429, 오류 코드 `too_many_requests`, `Retry-After`(초) 헤더와 본문 `retryAfterSeconds`. 기존 Gemini 쪽 429의 `rate_limited`와 구분하려고 다른 코드를 쓴다.
   - 입력 형식 검사를 통과한 요청만 세고, API 키 확인과 Gemini 호출보다 먼저 막는다. 막힌 요청은 세지 않는다.
   - 선택 환경변수로 바꿀 수 있다: `AI_RATE_LIMIT_WINDOW_SECONDS`, `READING_RATE_LIMIT_PER_IP`, `READING_RATE_LIMIT_GLOBAL`, `CONSULTATION_RATE_LIMIT_PER_IP`, `CONSULTATION_RATE_LIMIT_GLOBAL`. 1 이상의 정수가 아니면 기본값.
   - 메모리 제한: 키마다 최근 허용 시각을 최대 한도 수만큼만 기억하고, 창이 지난 키는 지우며, 키가 5,000개를 넘으면 가장 오래 쓰지 않은 키부터 지운다.
3. 화면: `/api/reading`이 이 보호 장치로 429·403을 돌려주면 일반 오류 대신 한국어 안내를 보여 준다.
   - 429: “요청이 많아 잠시 쉬어 갑니다. N분 뒤에 다시 시도해 주세요.”(N은 `retryAfterSeconds` 또는 `Retry-After`를 분으로 올림, 모르면 “잠시 뒤에”).
   - 403: “이 화면에서 보낸 요청으로 확인되지 않아 처리하지 않았습니다. 사주 서비스 주소에서 페이지를 새로 고친 뒤 다시 시도해 주세요.”
   - 기존처럼 오류 안내와 “Gemini 해석 다시 시도” 버튼을 보여 주고, 가짜 풀이를 만들지 않는다.
   - 요약 요청이 이 보호 장치에 막히면 상세 요청도 같은 이유로 막히므로 상세 요청을 보내지 않고 바로 안내한다. Spec 041의 “요약이 실패해도 전체 풀이를 진행한다”의 예외이며, Gemini 쪽 오류(`rate_limited` 등)로 요약이 실패하면 기존처럼 상세를 진행한다.
   - Vercel Firewall처럼 JSON이 아닌 429·403 응답도 같은 안내로 처리한다.
4. 문서: `.env.example`(주석 포함), `README.md`·`README.ko.md` 환경변수 표와 보호 장치 설명, PRD.

## 바꾸지 않는 것
- Gemini 지시문, 모델 ID, 토큰 한도, 시간 제한, 저장 형식, `vercel.json` 예약 작업, `/api/consultation`의 요청·응답 형식(앞에 보호 장치만 추가; 새 403·429 응답에만 `code` 필드가 있다), 데이터베이스·마이그레이션. 새 npm 의존성 없음.

## 한계 (정직하게 적는 부분)
- 요청 수는 서버 인스턴스마다 메모리에서 따로 센다. Vercel은 인스턴스를 여러 개 띄우거나 언제든 새로 시작할 수 있으므로 실제 허용량은 “인스턴스 수 × 한도”까지 늘 수 있고, 재시작하면 숫자가 초기화된다. 최선 노력이다.
- 전체 한도가 필요하면 소유자가 Vercel 대시보드 Firewall에서 `/api/reading`, `/api/consultation`에 요청 수 제한 규칙을 추가해야 한다(소유자 작업, 이번 변경에서 하지 않음).
- `Origin`·`Sec-Fetch-Site` 확인은 브라우저를 통한 다른 사이트 요청만 막는다. `curl`·스크립트는 헤더를 빼거나 꾸밀 수 있으므로 요청 수 제한만 받는다.
- IP 구분은 프록시 헤더를 믿는다. Vercel은 `x-forwarded-for`를 플랫폼이 다시 쓰지만, 다른 환경(예: 직접 띄운 `next start`)에서는 요청자가 헤더를 꾸며 IP별 한도를 피할 수 있다. 이때도 인스턴스 전체 한도는 적용된다. IPv6 주소 묶음(/64) 단위 구분은 하지 않는다.
- 풀이 한 번에 요청 2건(요약 + 상세)을 쓰므로 기본값 6은 IP당 10분에 풀이 약 3번이다. 같은 공유기(학원·회사)를 쓰는 여러 사람은 한도를 함께 쓴다.
- `scripts/verify-deep-consultation.ts`는 8장을 차례로 요청하므로 기본값(IP당 3건)에서는 4번째 장부터 429가 난다. 로컬에서 `CONSULTATION_RATE_LIMIT_PER_IP=10` 이상으로 올려 실행한다(스크립트는 이미 만든 장을 다시 쓰므로 이어서 실행할 수도 있다).

## 구현
- `lib/request-guard.ts`(서버 전용)
  - `checkSameOrigin(request, env)`: 요구사항 1의 판정. 막으면 `{ status: 403, code: "forbidden_origin", message }`, 아니면 `null`.
  - `clientKey(request)`: IP 구분 값(최대 64자, 소문자).
  - `SlidingWindowLimiter`: `retryAfterMs(key)`(기록 없이 확인)와 `record(key)`. 키별 기록은 한도 수만큼만 남기고 창이 지난 키를 정리한다.
  - `aiRateLimitConfig(route, env)`, `createAiRateLimiter(route, env)`: IP별·전체 제한을 함께 확인한 뒤 둘 다 통과할 때만 기록한다(전체 한도에 막힌 요청은 IP별 기록도 남기지 않는다).
  - `guardFailureResponse(failure)`: `{ error: { code, message, retryAfterSeconds? } }`, `Cache-Control: no-store`, 429면 `Retry-After`.
- `app/api/reading/route.ts`, `app/api/consultation/route.ts`: 모듈에서 제한기를 한 번 만들고, 요청 처음에 같은 사이트 확인, 입력 검사 뒤·API 키 확인 전에 요청 수 제한.
- `lib/request-guard-message.ts`(화면용, 서버 코드 없음): `requestBlockedMessage(status, body, retryAfterHeader)`가 보호 장치(또는 코드 없는 429·403)면 한국어 안내, 아니면 `null`.
- `app/saju-form.tsx`: 요약 응답이 막히면 상세 요청 없이 안내, 상세 응답이 실패하면 `requestBlockedMessage` → 서버 안내 → 기본 안내 순서. 실패 응답이 JSON이 아니어도 안내를 보여 준다. 새 훅은 없다.
- `.env.example`, `README.md`, `README.ko.md`, `docs/PRD.md`: 환경변수와 보호 장치·한계 설명.

## 검증
- [x] `npm run check`: 타입 검사와 기존 309개 테스트 통과(구현 담당 실행, 테스트 수정 없음).
- [x] `npx tsc --noEmit --noUnusedLocals`: 오류 없음.
- [x] `npm audit`: 0 vulnerabilities.
- [x] 비밀값 없이 `npm run build` 성공.
- [x] 로컬 `next start`(비밀값 없음)에서 `curl`로 같은 사이트 통과·다른 사이트 403·7번째 429·상담 4번째 429 확인(아래 기록).
- [ ] 구현을 맡지 않은 서브에이전트의 테스트 작성·보강과 실행 — NOT TESTED(이 기록 시점).
- [ ] 실제 브라우저에서 429·403 안내 문구와 다시 시도 버튼 확인 — NOT TESTED.
- [ ] Vercel 미리보기·운영 주소에서 같은 사이트 요청 통과 확인(배포는 이번 범위가 아님) — NOT TESTED.
- [ ] Vercel Firewall 요청 수 제한 규칙 추가(소유자 작업) — 하지 않음.

## 검증 기록 (2026-10-21, 구현 담당)
- `npm run check`: tests 309, pass 309, fail 0. 기존 API 테스트 하네스는 라우트 파일을 테스트마다 새로 실행하므로 제한기도 테스트마다 새로 만들어지고, 입력 오류 요청은 세지 않아 기존 테스트가 그대로 통과한다.
- `npx tsc --noEmit --noUnusedLocals`: 오류 없음(exit 0). `npm audit`: `found 0 vulnerabilities`.
- `npm run build`(`GEMINI_API_KEY`·`CRON_SECRET`·Supabase 변수 해제, `.env.local` 없음): 성공, 경로 8개.
- 로컬 `next start -p 3047`(비밀값 없음) + `curl`, `/api/reading` 요약 단계 본문:
  - `Origin: https://evil.example`(Content-Type `text/plain`) → 403 `forbidden_origin`.
  - `Origin` 없이 `Sec-Fetch-Site: cross-site` → 403 `forbidden_origin`.
  - `Origin: http://localhost:3047` + `Sec-Fetch-Site: same-origin` 6번 → 모두 503 `missing_api_key`(보호 장치 통과, Gemini 호출 전 키 확인에서 멈춤). 7번째 → 429 `too_many_requests`, `retry-after: 600`, 본문 `retryAfterSeconds: 600`, 안내 “요청이 많아 잠시 쉬어 갑니다. 10분 뒤에 다시 시도해 주세요.”
  - 한도에 걸린 뒤 잘못된 JSON(`{`) → 400 `invalid_json`(입력 오류는 세지 않음).
  - `Origin`·`Sec-Fetch-Site` 없는 `curl` → 429(`retry-after: 592`): 같은 컴퓨터의 요청은 같은 키로 묶인다.
  - `X-Forwarded-For: 203.0.113.9`를 붙이면 503(다른 키) — 직접 띄운 서버에서는 헤더를 꾸며 IP별 한도를 피할 수 있다는 한계를 실제로 확인.
- `/api/consultation`(natal 장): `Origin: https://evil.example` → 403 `forbidden_origin`. `Origin` 없는 요청 3번 → 503(기존 형식 `{"error":{"message":...}}` 그대로), 4번째 → 429 `too_many_requests`, `retry-after: 600`. 429 응답 헤더 `cache-control: no-store`, `content-type: application/json`, 기존 보안 헤더(`X-Content-Type-Options: nosniff` 등) 유지.
- 환경변수 확인: `READING_RATE_LIMIT_PER_IP=2 READING_RATE_LIMIT_GLOBAL=3 AI_RATE_LIMIT_WINDOW_SECONDS=120`으로 다시 띄워 `X-Forwarded-For` 198.51.100.1 ×3 → 503, 503, 429(`retry-after: 120`), 198.51.100.2 → 503, 198.51.100.3 → 429(`retry-after: 120`, 전체 한도 3).
- 서버는 PID로 종료하고 포트 3047이 비었음을 확인했다.
- 별도 임시 스크립트(저장소 밖)로 확인: 한도 직후 창이 지나면 다시 허용, 전체 한도 60, `maxKeys` 3에서 키 10개를 기록해도 3개만 유지, 잘못된 환경변수는 기본값, 출처 판정(운영 주소 허용, 다른 사이트·`null`·`cross-site` 거절, 운영 모드의 다른 포트 localhost 거절·개발 모드 허용, `VERCEL_BRANCH_URL` 허용), 화면 안내 문구(61초 → 2분, 헤더 30초 → 1분, Gemini `rate_limited` → `null`, `missing_api_key` → `null`).
- NOT TESTED: 실제 브라우저 화면, 독립 테스트, Vercel 배포 환경, 여러 인스턴스에서의 동작.
