# Google 계정 로그인

## 목적과 범위
- Google 계정으로 로그인하고 같은 계정으로 다른 기기에서 사주 보관함을 연다.
- 기존 비로그인 계산·로컬 저장·Gemini 해석을 유지한다.
- 기존 `.env`의 Supabase 프로젝트를 사용한다. 로그인 버튼, 로그인 처리 화면, 계정 표시, 로그아웃, 실패·취소·재시도를 제공한다.
- Google의 이메일·기본 프로필만 요청한다. Google 비밀번호와 제공자 토큰을 앱 코드에서 저장하지 않는다.

## 기술 설계
- 현재 화면은 브라우저에서 동작하므로 `@supabase/supabase-js`의 PKCE 흐름을 사용한다. 서버 렌더링에 개인 결과를 포함하지 않는다.
- `/auth/callback`에서 일회용 코드를 로그인 세션으로 교환한다. SDK가 관리하는 검증값과 인증 서버의 검증을 사용한다. 임의 외부 이동 주소는 받지 않고 성공 시 `/`로 돌아온다.
- 공개용 프로젝트 URL·publishable key만 브라우저에 포함한다. Google Client Secret은 Supabase 제공자 설정에만 보관한다. Gemini 키는 계속 서버 전용이다.
- 인증 상태는 SDK에서 받아 표시하며 데이터 권한은 데이터베이스의 본인 소유 행 정책으로 강제한다.
- 로그아웃·계정 전환 시 이전 계정의 목록과 열었던 서버 결과를 화면에서 제거한다. 브라우저의 기존 비로그인 결과는 자동 업로드하지 않는다.

## 외부 설정
- Supabase Google provider 활성화 및 Google OAuth Client ID/Secret 설정 필요.
- Google 승인 리디렉션 URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Supabase 허용 리디렉션 URL: `http://localhost:3000/auth/callback`, 추후 배포 주소의 동일 경로.
- 로그인·계정 동의는 참가자가 직접 수행한다. 설정이 없으면 완료로 기록하지 않는다.

## 완료 조건
- 로그인 성공 후 계정이 표시되고 새로고침해도 유지된다.
- 취소/잘못된 코드/설정 누락 시 한국어 안내와 재시도 경로가 있다.
- 로그아웃 및 다른 탭의 계정 변경 시 이전 개인 결과가 남지 않는다.
- 테스트와 실제 인증 연결 상태를 별도로 기록한다.

## 참고
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession

## 검증 상태
코드 구현 및 Google 인증 페이지 연결 검증 완료. 참가자 로그인 완료 검증 대기.
- 기존 Supabase 설정 조회에서 Google provider 활성화 확인.
- 브라우저에서 로그인 버튼 → Google 계정 선택 화면 연결 확인. 계정 선택·동의는 참가자에게 요청했다.
- 취소 콜백의 한국어 오류와 홈 복귀 경로 확인.
- 전체 타입 검사·93개 테스트·프로덕션 빌드 통과. 개발 환경에서 로그인 전 보관함 UI 확인.
- 실제 계정 선택 이후 로그인 유지·로그아웃·다른 기기 로그인은 아직 미확인이다.
