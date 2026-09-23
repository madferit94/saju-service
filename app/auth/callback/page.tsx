"use client";

import { useEffect, useState } from "react";
import { completeGoogleLogin } from "../../../lib/supabase/client";

export default function AuthCallback() {
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    completeGoogleLogin(window.location.href)
      .then(() => { if (active) window.location.replace("/"); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "로그인하지 못했습니다. 다시 시도해 주세요."); });
    return () => { active = false; };
  }, []);
  return <main><section className="input-card">
    <h1>{error ? "로그인을 마치지 못했습니다" : "로그인을 확인하고 있습니다"}</h1>
    {error ? <p role="alert">{error}</p> : <p role="status">잠시 기다려 주세요. 확인 후 사주 화면으로 돌아갑니다.</p>}
    <a href="/">사주 화면으로 돌아가기</a>
  </section></main>;
}
