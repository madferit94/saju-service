import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("계정 연결 설정이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  client ??= createClient(url, key, {
    auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
  });
  return client;
}

let callbackPromise: Promise<void> | undefined;
// React 개발 모드에서 같은 일회용 코드를 두 번 교환하지 않는다.
export function completeGoogleLogin(url: string): Promise<void> {
  if (callbackPromise) return callbackPromise;
  callbackPromise = (async () => {
    const params = new URL(url).searchParams;
    if (params.has("error")) throw new Error("로그인이 취소되었거나 승인되지 않았습니다. 홈으로 돌아가 다시 로그인해 주세요.");
    const code = params.get("code");
    if (!code) throw new Error("로그인 확인 코드가 없습니다. 홈에서 다시 로그인해 주세요.");
    const { error } = await getBrowserClient().auth.exchangeCodeForSession(code);
    if (error) throw new Error("로그인 확인 시간이 지났거나 연결하지 못했습니다. 로그인을 시작했던 브라우저에서 다시 시도해 주세요.");
  })();
  return callbackPromise;
}
