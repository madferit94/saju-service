# 보안 업데이트와 기본 보안 헤더

## 요구사항
- `npm audit --omit=dev`에서 나온 취약점 3개(심각 1, 높음 2)를 없앤다.
  - `next` 16.3.5: 16.0.0~16.3.7에 해당하는 공지 7건(next/og 원격 코드 실행, 이미지 최적화 SSRF, 캐시 오염 등). 이 서비스는 `next/image`를 쓰므로 영향 범위에 들어간다. 16.4.2로 올린다(버전 고정 유지).
  - `sharp` <0.35.5(높음), `source-map-js` 1.0.0~1.2.1(높음): `npm audit fix`로 해결한다.
- 운영 응답에 HSTS 말고는 보안 헤더가 없다. 동작에 영향이 적은 기본 헤더 3개를 모든 경로에 추가한다.
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY` (다른 사이트가 이 서비스를 iframe으로 감싸지 못하게 함)
  - CSP 전체 적용은 Supabase·Google 로그인·Next 인라인 스크립트 검증이 필요해 이번 범위에서 제외한다.
- `package.json`의 이름이 연습용 템플릿 이름(`saju-starter-code`)으로 남아 있어 `saju-service`로 바꾼다.
- 사주 계산, Gemini 프롬프트·검증 규칙, 저장 형식, DB, 배포 설정은 바꾸지 않는다.
- 버전: 수정이므로 patch, v0.3.1.

## 검증
- [x] `npm audit --omit=dev` 취약점 0개.
- [x] 독립 테스트 담당(구현하지 않은 서브에이전트)이 보안 헤더 테스트를 작성하고 실행한다.
- [x] 타입 검사·전체 테스트·프로덕션 빌드 통과.
- [x] 로컬 프로덕션 서버에서 첫 화면·그래프 주소·빈 API 요청(400) 응답과 보안 헤더 확인.
- [ ] 운영 배포 후 보안 헤더 확인. main 병합과 배포는 사용자 결정.

## 결과 (2026-10-21)
- PASS: `npm audit --omit=dev` 0 vulnerabilities (변경 전 심각 1·높음 2).
- PASS: 독립 테스트 담당이 `tests/045-security-maintenance.test.ts` 4개 작성(헤더 값·전체 경로 적용, package/lock 이름·버전, next 16.4.2 세 곳 일치). 타입 검사 통과, 전체 286개 테스트 통과(기존 282 + 신규 4), 프로덕션 빌드 성공.
- PASS: 로컬 프로덕션 서버(`next start`) `/` 200, `/?view=graph` 200, 빈 `POST /api/reading` 400(`consent_required`), `/api/daily` 200(오전 9시 전 `ready:false`), 없는 주소 404. 다섯 응답 모두 보안 헤더 3개 확인.
- NOT TESTED: 운영 배포 후 헤더, 실제 Supabase 조회 경로, Google 로그인. 운영 배포는 main 병합 후 사용자 결정이며 그때까지 status 체크박스는 미완료로 둔다.
