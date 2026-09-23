"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getBrowserClient } from "../lib/supabase/client";
import { deleteReading, listReadings, loadReading, PAGE_SIZE, saveReading, type CloudPayload, type ReadingSummary } from "../lib/account/results";

type Props = {
  current: CloudPayload | null;
  busy: boolean;
  onLoad: (payload: CloudPayload) => void;
  onClearCloud: () => void;
};

export default function AccountPanel({ current, busy, onLoad, onClearCloud }: Props) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("나의 사주 흐름");
  const [rows, setRows] = useState<ReadingSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const owner = useRef<string | null>(null);
  const epoch = useRef(0);
  const clearRef = useRef(onClearCloud);
  clearRef.current = onClearCloud;

  useEffect(() => {
    let active = true;
    try {
      const supabase = getBrowserClient();
      setClient(supabase);
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        const nextOwner = session?.user.id ?? null;
        if (owner.current !== nextOwner) {
          owner.current = nextOwner;
          epoch.current++;
          setRows([]); setHasMore(false); setOpenedId(null); setDeleteId(null);
          setTitle("나의 사주 흐름");
          setMessage(""); setError(""); setPending("");
          clearRef.current();
        }
        setUser(session?.user ?? null);
        setChecking(false);
      });
      supabase.auth.getUser().then(({ data, error: authError }) => {
        if (!active) return;
        if (authError && authError.name !== "AuthSessionMissingError") setError("로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.");
        if (!data.user) setChecking(false);
      }).catch(() => { if (active) { setChecking(false); setError("계정 연결에 실패했습니다. 새로고침해 주세요."); } });
      return () => { active = false; epoch.current++; subscription.unsubscribe(); };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "계정 연결 설정을 확인해 주세요.");
      setChecking(false);
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    const ticket = epoch.current;
    setPending("list");
    listReadings(client, user.id).then(items => {
      if (active && ticket === epoch.current) { setRows(items); setHasMore(items.length === PAGE_SIZE); }
    }).catch(caught => { if (active && ticket === epoch.current) setError(caught.message); })
      .finally(() => { if (active && ticket === epoch.current) setPending(""); });
    return () => { active = false; };
  }, [client, user?.id]);

  async function login() {
    if (!client) return;
    setError(""); setPending("login");
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: {
        redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" },
      } });
      if (error) throw error;
    } catch {
      setError("Google 로그인에 연결하지 못했습니다. 잠시 후 다시 눌러 주세요.");
      setPending("");
    }
  }

  async function logout() {
    if (!client) return;
    setPending("logout"); setError("");
    const ticket = epoch.current;
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch { setError("로그아웃하지 못했습니다. 다시 시도해 주세요."); }
    finally { if (ticket === epoch.current) setPending(""); }
  }

  async function operate(action: "save" | "list" | "more" | "load" | "delete", id?: string) {
    if (!client || !user || pending) return;
    const ticket = epoch.current;
    const isCurrent = () => ticket === epoch.current && owner.current === user.id;
    setPending(action); setError(""); setMessage("");
    try {
      if (action === "save" && current) {
        const saved = await saveReading(client, user.id, title, current);
        if (!isCurrent()) return;
        setMessage(saved.duplicate ? "같은 제목과 결과가 이미 저장되어 있습니다." : "계정에 저장했습니다. 다른 기기에서도 같은 계정으로 열 수 있습니다.");
      } else if (action === "load" && id) {
        const payload = await loadReading(client, user.id, id);
        if (!isCurrent()) return;
        onLoad(payload); setOpenedId(id);
        setTitle(rows.find(row => row.id === id)?.title ?? "나의 사주 흐름");
        setMessage("저장한 결과를 열었습니다. 아래에서 해석을 확인하세요.");
        document.getElementById("result-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      } else if (action === "delete" && id) {
        await deleteReading(client, user.id, id);
        if (!isCurrent()) return;
        if (openedId === id) { clearRef.current(); setOpenedId(null); }
        setDeleteId(null); setMessage("계정 저장본을 삭제했습니다. 별도로 저장한 브라우저 결과는 유지됩니다.");
      }
      const items = await listReadings(client, user.id, action === "more" ? rows.length : 0);
      if (!isCurrent()) return;
      setRows(action === "more" ? [...rows, ...items.filter(item => !rows.some(row => row.id === item.id))] : items);
      setHasMore(items.length === PAGE_SIZE);
    } catch (caught) { if (isCurrent()) setError(caught instanceof Error ? caught.message : "요청을 마치지 못했습니다. 다시 시도해 주세요."); }
    finally { if (isCurrent()) setPending(""); }
  }

  return <section className="account-panel" aria-labelledby="account-title">
    <div className="account-heading"><div><p className="eyebrow">나만의 기록</p><h2 id="account-title">내 사주 보관함</h2></div>
      {user && <button type="button" className="secondary-button" disabled={pending === "logout"} onClick={logout}>로그아웃</button>}
    </div>
    {checking ? <p role="status">로그인 상태를 확인하고 있습니다…</p> : user ? <>
      <p className="account-identity">{user.email ?? "Google 계정"}으로 로그인했습니다.</p>
      <p className="method-help">출생 정보와 계산·해석 결과를 계정에 저장하면 본인만 다시 볼 수 있습니다. 저장본은 직접 삭제할 때까지 보관됩니다.</p>
      {current ? <div className="cloud-save-row"><div><label htmlFor="reading-save-title">저장할 결과 제목</label>
        <input id="reading-save-title" maxLength={80} value={title} onChange={e => setTitle(e.target.value)} /></div>
        <button type="button" disabled={!!pending || busy || !title.trim()} onClick={() => operate("save")}>{pending === "save" ? "저장 중…" : "계정에 저장"}</button>
      </div> : <p>아래에서 사주를 계산하거나 저장된 결과를 열어 주세요.</p>}
      <div className="account-heading"><h3>저장한 결과</h3><button type="button" className="secondary-button" disabled={!!pending} onClick={() => operate("list")}>목록 새로고침</button></div>
      {!rows.length && !pending && !error && <p className="method-help">아직 저장한 결과가 없습니다.</p>}
      {pending === "list" && <p role="status">결과 목록을 불러오고 있습니다…</p>}
      <ul className="saved-reading-list">{rows.map(row => <li key={row.id}>
        <div><strong>{row.title}</strong><span>{new Date(row.created_at).toLocaleString("ko-KR")}</span></div>
        <div className="saved-reading-actions"><button type="button" className="secondary-button" disabled={!!pending || busy} onClick={() => operate("load", row.id)} aria-label={`${row.title} 열기`}>열기</button>
          <button type="button" className="secondary-button" disabled={!!pending || busy} onClick={() => setDeleteId(row.id)} aria-label={`${row.title} 삭제`}>삭제</button></div>
        {deleteId === row.id && <div className="delete-confirm" role="group" aria-label="결과 삭제 확인"><p>‘{row.title}’ 계정 저장본을 삭제할까요? 삭제 후 되돌릴 수 없습니다.</p>
          <button type="button" disabled={!!pending} onClick={() => operate("delete", row.id)}>삭제하기</button>
          <button type="button" className="secondary-button" disabled={!!pending} onClick={() => setDeleteId(null)}>취소</button></div>}
      </li>)}</ul>
      {hasMore && <button type="button" className="secondary-button" disabled={!!pending} onClick={() => operate("more")}>더 불러오기</button>}
    </> : <><p>Google 계정으로 로그인하면 다른 기기에서도 저장한 사주를 다시 볼 수 있습니다.</p>
      <button type="button" className="google-login" disabled={!client || !!pending || busy} onClick={login}>{pending === "login" ? "Google로 이동 중…" : "Google 계정으로 로그인"}</button>
      <p className="method-help">로그인하지 않아도 사주를 볼 수 있습니다. 기존 브라우저 결과는 자동으로 업로드되지 않습니다.</p></>}
    {message && <p className="account-message" role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
