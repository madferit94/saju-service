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
   - 입력 형식 검사(출생 입력 `validateInput`·출생지 확인 포함)를 모두 통과한 요청만 세고, API 키 확인과 Gemini 호출보다 먼저 막는다. 막힌 요청은 세지 않는다. 두 경로의 순서가 같다.
   - 선택 환경변수로 바꿀 수 있다: `AI_RATE_LIMIT_WINDOW_SECONDS`, `READING_RATE_LIMIT_PER_IP`, `READING_RATE_LIMIT_GLOBAL`, `CONSULTATION_RATE_LIMIT_PER_IP`, `CONSULTATION_RATE_LIMIT_GLOBAL`. 앞뒤 공백을 뺀 값이 `^[1-9][0-9]*$` 형태의 10진 정수일 때만 쓰고(`1e1`·`0x10`·`5.0`·0·음수·문자는 기본값), 상한(창 86,400초, IP별 10,000, 전체 100,000)을 넘으면 상한으로 줄인다(테스트 담당 관찰을 반영한 2026-10-21 팀장 판단).
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
- `app/api/reading/route.ts`, `app/api/consultation/route.ts`: 모듈에서 제한기를 한 번 만들고, 요청 처음에 같은 사이트 확인, 출생 입력·출생지까지 입력 검사를 마친 뒤·API 키 확인 전에 요청 수 제한.
- `lib/request-guard-message.ts`(화면용, 서버 코드 없음): `requestBlockedMessage(status, body, retryAfterHeader)`가 보호 장치(또는 코드 없는 429·403)면 한국어 안내, 아니면 `null`.
- `app/saju-form.tsx`: 요약 응답이 막히면 상세 요청 없이 안내, 상세 응답이 실패하면 `requestBlockedMessage` → 서버 안내 → 기본 안내 순서. 실패 응답이 JSON이 아니어도 안내를 보여 준다. 새 훅은 없다.
- `.env.example`, `README.md`, `README.ko.md`, `docs/PRD.md`: 환경변수와 보호 장치·한계 설명.

## 검증
- [x] `npm run check`: 타입 검사와 기존 309개 테스트 통과(구현 담당 실행, 테스트 수정 없음).
- [x] `npx tsc --noEmit --noUnusedLocals`: 오류 없음.
- [x] `npm audit`: 0 vulnerabilities.
- [x] 비밀값 없이 `npm run build` 성공.
- [x] 로컬 `next start`(비밀값 없음)에서 `curl`로 같은 사이트 통과·다른 사이트 403·7번째 429·상담 4번째 429 확인(아래 기록).
- [x] 구현을 맡지 않은 서브에이전트의 테스트 작성·보강과 실행(아래 테스트 담당 기록). 발견 1건: `/api/reading`이 출생 정보 검사(`validateInput`·출생지)에 실패한 요청도 센다 → 아래 후속 수정에서 고침.
- [ ] 후속 수정(입력 검사 순서·환경변수 엄격 파싱)에 대한 테스트 담당의 테스트 보강과 실행 — NOT TESTED. 기존 `tests/047-request-guard.test.ts:198` 환경변수 테스트 1개는 의도적으로 바뀐 동작(상한 초과 → 상한) 때문에 실패하며, 테스트 담당의 갱신이 필요하다.
- [ ] 실제 브라우저에서 429·403 안내 문구와 다시 시도 버튼 확인 — 헤드리스 Chrome에서 응답 가로채기로 확인 통과(아래 기록). 실제 서버의 보호 장치가 낸 응답을 브라우저로 받아 본 확인과 사람의 화면 확인은 아직.
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

## 검증 기록 (2026-10-21, 테스트 담당 서브에이전트 — 구현에 참여하지 않음)
- 추가한 테스트 33개, 기존 테스트는 고치지 않았다.
  - `tests/047-request-guard.test.ts` 16개(단위)
    - 출처 판정: 자기 Host·요청 URL(대소문자 무시, 포트 다르면 거절), 운영 주소, `VERCEL_URL`·`VERCEL_BRANCH_URL`·`VERCEL_PROJECT_PRODUCTION_URL`(https만, `https://` 붙은 값도 인식, 비슷한 이름 거절), localhost·127.0.0.1·[::1]의 다른 포트는 개발(`NODE_ENV` 없음 포함)만 허용·운영 거절.
    - `Origin: null`·잘못된 값·`file:`·`chrome-extension:`·`ftp:` 거절, Origin이 있으면 Sec-Fetch-Site보다 우선, Sec-Fetch-Site `same-origin`·`none`(공백·대소문자 무시)만 허용·`cross-site`·`same-site`·기타 거절, 헤더 둘 다 없으면 통과.
    - `clientKey`: x-forwarded-for 첫 IP → x-real-ip(첫 칸이 비었을 때 포함) → `unknown`, 64자 자르기, 소문자.
    - 슬라이딩 창: 한도까지 허용, `retryAfterMs` 경계(창 끝 1ms 전 1, 첫 기록+창 시각에 0), 확인만 하면 기록 없음, 창이 지나면 재허용·빈 키 삭제, 키별 기록은 한도 수만, `maxKeys` 초과 시 가장 오래 쓰지 않은 키부터 삭제, 창이 지난 키 정리.
    - IP별+전체: reading 기본 6/60·10분, consultation 3/20, 남은 초·분 올림(61초 → 2분, 1초 미만 → 1초·1분), 전체 한도에 막힌 요청은 IP 기록을 남기지 않고 IP 한도에 막힌 요청은 전체 기록을 남기지 않음.
    - 환경변수: 0·음수·소수(2.5)·문자·빈 값·공백·`Infinity`·`NaN`·상한 초과(창 86,401초, IP 10,001, 전체 100,001)는 기본값, 앞뒤 공백 있는 정수와 상한값은 사용, 다른 경로 변수는 쓰지 않음.
    - `guardFailureResponse`: 429는 `Retry-After`·`no-store`·JSON·`retryAfterSeconds`, 403은 `Retry-After`·`retryAfterSeconds` 없음.
    - `requestBlockedMessage`: 본문 초 우선·헤더 초 사용·날짜 형식 헤더와 음수는 “잠시”, JSON 아닌 429·코드 없는 403 안내, `rate_limited`·`missing_api_key`·`invalid_api_key`·502·예전 mock은 `null`.
  - `tests/047-route-guard.test.ts` 10개(기존 035·consultation-api 방식으로 라우트 파일을 테스트마다 새로 실행, 가짜 Gemini 호출 수 확인)
    - 두 경로 모두 다른 사이트(`Origin` 다른 사이트·`null`, Sec-Fetch-Site `cross-site`·`same-site`)는 403 `forbidden_origin`·`no-store`·Gemini 0회. 깨진 본문이어도 403(본문을 읽기 전). 막힌 요청은 세지 않음.
    - 같은 사이트(Origin 자기 주소, `same-origin`, `none`)와 헤더 없는 요청은 통과.
    - reading: IP당 6건 Gemini 호출 뒤 7번째 429·Gemini 0회·`Retry-After` 595–600초·본문 `retryAfterSeconds` 일치·10분 안내. 다른 IP는 따로, 요약·상세는 같은 한도.
    - reading: 입력 오류 7종(잘못된 JSON, 24,000자 초과, 동의 없음, 계산 기준, input 형식, stage, 연도)을 21번 보내도 세지 않고, 한도 뒤에도 입력 오류는 원래 400.
    - reading: 키가 없어도 6번 503 뒤 7번째 429. 환경변수(IP 2·전체 3·120초) 반영.
    - consultation: 3번(각 Gemini 2회) 뒤 4번째 429·Gemini 0회. 기존 오류 형식 `{error:{message}}`(code 없음) 유지, 상담 주제 오류·출생지 없음은 세지 않음, 키 없음 503 문구 그대로.
    - 라우트를 다시 불러오면 제한기가 초기화되고 reading과 consultation은 따로 센다.
  - `tests/047-guard-ui.test.ts` 7개(실제 `app/saju-form.tsx`, `tests/helpers/saju-form-harness.ts`에 상태·헤더가 있는 응답과 네트워크 오류 흉내를 추가)
    - 요약 429 `too_many_requests` → 상세 요청 0건, `role="alert"` 안내 “2분”, 누를 수 있는 “Gemini 해석 다시 시도” 버튼, 가짜 풀이·요약 없음, 사주표 유지, 저장본 풀이 `null`. 다시 시도하면 요약부터 다시 요청.
    - 요약 403 `forbidden_origin` → 상세 0건, 새로 고침 안내. JSON 아닌 요약 429(헤더 30초 → 1분, 헤더 없음 → 잠시)·403도 같은 처리.
    - Gemini 쪽 요약 실패(429 `rate_limited`, 502, 503 2종, 네트워크 오류)는 기존처럼 상세 진행, 상세의 Gemini 429는 서버 문구 그대로.
    - 상세 429(본문 600초 → 10분, 헤더 125초 → 3분, JSON 아님 59초 → 1분, 정보 없음 → 잠시)·403(JSON·JSON 아님)은 보호 장치 안내가 서버 문구보다 우선, JSON 아닌 502는 기본 문구, 503 키 없음은 서버 문구.
    - 상태·헤더 없는 예전 mock은 기존대로 상세 진행·서버 문구, 코드가 `too_many_requests`면 상태 없이도 안내. 성공한 요약이 JSON이 아니어도 상세 진행.
- 테스트가 실제로 잡는지 확인(구현을 잠시 바꿨다가 `git checkout`으로 원복, 8가지 모두 실패로 잡음): `same-site` 허용, 배포 주소 http 허용, IP 기록을 전체 확인 전에 남김, 본문 읽기 전에 세기, 요약 차단 무시, 코드 없는 429 무시, 상담 제한 제거, `Retry-After` 제거.
- 발견한 문제(구현은 고치지 않음): `/api/reading`은 요청 수 제한(`rateLimiter.take`)을 `validateInput`·출생지 검사보다 먼저 한다. 그래서 날짜가 잘못되었거나 출생지가 없는 요청(400 `invalid_input`)도 한도에 들어간다. 증거(임시 스크립트, 키 있음): 잘못된 날짜(`2000-13-45`) 요청 6번 → 모두 400 `invalid_input`, 이어서 정상 입력 → 429 `too_many_requests`. 출생지 없는 요청 6번도 같은 결과. 요구사항 2의 “입력 형식 검사를 통과한 요청만 세고”와 다르고, `/api/consultation`은 같은 검사 뒤에 센다. 화면은 계산을 먼저 하므로 일반 이용자에게는 드물고, Gemini 비용도 생기지 않는다. 다만 직접 만든 요청이 IP별·전체 한도를 Gemini 비용 없이 쓸 수 있다. 위 테스트에는 이 경우를 넣지 않았다(구현 결정 뒤 추가 필요).
- 관찰(판단 필요, 버그로 보지 않음): 환경변수는 `Number()`로 읽어 `"1e1"`(10)·`"0x10"`(16)·`"5.0"`(5)도 정수로 받아들인다. 상한을 넘는 값은 상한으로 줄이지 않고 기본값으로 돌아간다.
- 명령과 결과: `npm run check` 변경 전 309 / 309 → 추가 후 tests 342 / pass 342 / fail 0. `npx tsc --noEmit --noUnusedLocals` 오류 없음. `npm audit` 0 vulnerabilities. 비밀값 없이 `npm run build` 성공.
- 실제 브라우저(Playwright + 헤드리스 Chrome, `next start` 비밀값 없음): 화면에서 출생 정보를 입력하고 “내 사주 보기”를 눌렀다. `/api/reading`·`/api/consultation` 요청은 모두 브라우저에서 가로채 가짜 응답을 돌려주었고, 실제 서버로 간 AI 요청은 0건이었다(Gemini 호출 없음). 25개 확인 항목 모두 통과.
  - 요약 429 JSON(600초) → “10분” 안내·상세 요청 없음·`role="alert"`·버튼 사용 가능·가짜 풀이 없음·사주표 유지. 다시 시도 → 요약만 다시 요청, 61초 응답에 “2분”.
  - 요약 403 → 새로 고침 안내, 상세 없음. HTML 429(`Retry-After: 30`) → “1분”, 상세 없음.
  - 요약 Gemini `rate_limited` → 상세 진행 → 상세 HTML 429(`Retry-After: 120`) → “2분”. 요약 502 → 상세 빈 본문 403 → 새로 고침 안내.
- NOT TESTED: 실제 서버의 보호 장치가 낸 429·403을 브라우저로 받아 본 화면(가로챈 응답만 확인), 사람의 화면·스크린리더 확인, 실제 모바일 기기, Vercel 미리보기·운영 주소(같은 사이트 요청 통과, `x-forwarded-for` 처리, 여러 인스턴스), Vercel Firewall 규칙, `scripts/verify-deep-consultation.ts` 실제 실행.

## 후속 수정: 입력 오류 요청 집계와 환경변수 파싱 (2026-10-21, 구현 담당)
- 근거: 테스트 담당이 `/api/reading`에서 잘못된 날짜 요청 6번(모두 400 `invalid_input`) 뒤 정상 요청이 바로 429가 되는 것을 확인했다. 제한기가 `validateInput`·출생지 확인보다 앞에 있었다(consultation과 순서도 달랐다).
- 수정(`app/api/reading/route.ts`): 출생 입력 검사(`validateInput`)와 출생지 확인을 먼저 하고, 통과한 요청만 `rateLimiter.take`로 센 다음 API 키를 확인한다. 이제 두 경로의 순서가 같다. 그 결과 API 키가 없을 때 잘못된 출생 입력은 503 대신 400 `invalid_input`을 받는다(consultation과 같은 동작). Gemini 지시문·호출·응답 형식은 그대로다.
- 수정(`lib/request-guard.ts` 환경변수, 팀장 판단 반영): 앞뒤 공백을 뺀 값이 `^[1-9][0-9]*$`일 때만 쓰고, 상한을 넘으면 기본값 대신 상한으로 줄인다. `.env.example`, `README.md`, `README.ko.md`, 이 Spec 요구사항 2를 같은 내용으로 고쳤다.
- 명령과 결과:
  - `npm run check`: tests 342, pass 341, fail 1. 실패는 `tests/047-request-guard.test.ts:198` “환경변수: … 상한 초과는 기본값” 하나뿐이다(`"10001"` → 실제 10000, 테스트 기대 6). 상한 초과를 상한으로 줄이도록 동작을 일부러 바꿨기 때문이며, 지시에 따라 테스트 파일은 고치지 않았다. 같은 테스트의 `"86401"`(→ 86,400초)·`"100001"`(→ 100,000) 기대값도 함께 갱신이 필요하다. 나머지 341개는 통과(입력 검사 순서 변경으로 깨진 테스트 없음).
  - `npx tsc --noEmit --noUnusedLocals`: 오류 없음(exit 0). 비밀값 없이 `npm run build`: 성공.
  - 임시 스크립트(저장소 밖): `"8"`→8, `" 9 "`→9, `"1e1"`·`"0x10"`·`"5.0"`·`"010"`·`"+5"`·`"0"`·`"-3"`·`"2.5"`→기본값 6, `"10001"`·`"99999999999999999999"`→10000, 창 `"86401"`→86,400초, consultation 전체 `"100001"`→100,000.
  - 로컬 `next start -p 3047`(비밀값 없음) + `curl`, `Origin: http://localhost:3047`: 잘못된 날짜(`2000-13-45`) 6번 → 모두 400 `invalid_input`, 출생지 없는 입력 3번 → 모두 400 `invalid_input`, 이어서 정상 입력 1~6번 → 503 `missing_api_key`(429 아님), 7번째 → 429 `too_many_requests`, `retry-after: 600`. 서버는 PID로 종료하고 포트가 비었음을 확인했다.
- NOT TESTED: 이 후속 수정에 대한 테스트 담당의 독립 테스트, 실제 브라우저 화면.
