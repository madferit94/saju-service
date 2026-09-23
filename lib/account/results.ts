import type { SupabaseClient } from "@supabase/supabase-js";
import { isSavedSajuResult, type SavedSajuResult } from "../saju/persistence";

export const MAX_PAYLOAD_BYTES = 500_000;
export const PAGE_SIZE = 20;
export type CloudPayload = { version: 1; result: SavedSajuResult; fortuneYear: number };
export type ReadingSummary = { id: string; title: string; created_at: string };

export function validateCloudPayload(value: unknown): CloudPayload {
  if (!value || typeof value !== "object") throw new Error("저장된 결과 형식을 확인할 수 없습니다.");
  const v = value as CloudPayload;
  if (v.version !== 1 || !Number.isInteger(v.fortuneYear) || v.fortuneYear < 1990 || v.fortuneYear > 2100 || !isSavedSajuResult(v.result)) {
    throw new Error("저장된 결과 형식을 확인할 수 없습니다. 새로 계산한 결과를 저장해 주세요.");
  }
  const { chart, timeline } = v.result;
  const stems = "甲乙丙丁戊己庚辛壬癸";
  const branches = "子丑寅卯辰巳午未申酉戌亥";
  const elements = ["목", "화", "토", "금", "수"];
  if (chart.pillars.some(p => !stems.includes(p.stem) || p.stem.length !== 1 || !branches.includes(p.branch) || p.branch.length !== 1 ||
    typeof p.korean !== "string" || p.korean.length !== 2 || !elements.includes(p.stemElement) || !elements.includes(p.branchElement)) ||
    typeof chart.dayMaster.character !== "string" || !stems.includes(chart.dayMaster.character) || chart.dayMaster.character.length !== 1 ||
    timeline.periods.some(p => !Number.isInteger(p.startAge) || !Number.isInteger(p.endAge) || p.endAge < p.startAge || p.endYear < p.startYear ||
      (p.index !== 0 && (p.ganji.length !== 2 || !stems.includes(p.ganji[0]) || !branches.includes(p.ganji[1]))))) {
    throw new Error("저장된 사주 계산 자료가 손상되어 열 수 없습니다.");
  }
  if (new TextEncoder().encode(JSON.stringify(v)).length > MAX_PAYLOAD_BYTES) throw new Error("결과가 저장 가능한 크기를 넘었습니다.");
  return v;
}

export function validateTitle(value: string): string {
  const title = value.trim();
  if (!title || [...title].length > 80) throw new Error("제목을 1~80자로 입력해 주세요.");
  return title;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function resultFingerprint(payload: CloudPayload, title: string): Promise<string> {
  validateCloudPayload(payload);
  const { savedAt: _savedAt, ...result } = payload.result;
  const normalized = JSON.parse(JSON.stringify({ title: validateTitle(title), ...payload, result }));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(normalized)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function requireOwner(client: SupabaseClient, owner: string) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== owner) throw new Error("로그인 상태가 바뀌었습니다. 다시 로그인한 뒤 시도해 주세요.");
}

function databaseError(error: { code?: string }): Error {
  if (error.code === "42P01" || error.code === "PGRST205") return new Error("결과 보관함을 준비 중입니다. 잠시 후 다시 시도해 주세요.");
  if (error.code === "42501" || error.code === "PGRST301") return new Error("저장 권한을 확인하지 못했습니다. 다시 로그인해 주세요.");
  return new Error("보관함에 연결하지 못했습니다. 현재 결과는 그대로 있습니다. 다시 시도해 주세요.");
}

export async function listReadings(client: SupabaseClient, owner: string, offset = 0): Promise<ReadingSummary[]> {
  await requireOwner(client, owner);
  const { data, error } = await client.from("saju_readings").select("id,title,created_at").eq("user_id", owner)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  if (error) throw databaseError(error);
  return data ?? [];
}

export async function saveReading(client: SupabaseClient, owner: string, rawTitle: string, payload: CloudPayload): Promise<{ id: string; duplicate: boolean }> {
  const title = validateTitle(rawTitle);
  validateCloudPayload(payload);
  const fingerprint = await resultFingerprint(payload, title);
  await requireOwner(client, owner);
  const { data, error } = await client.from("saju_readings").insert({ user_id: owner, title, fingerprint, payload }).select("id").single();
  if (error?.code === "23505") {
    const previous = await client.from("saju_readings").select("id").eq("user_id", owner).eq("fingerprint", fingerprint).single();
    if (previous.error || !previous.data) throw databaseError(previous.error ?? {});
    return { id: previous.data.id, duplicate: true };
  }
  if (error || !data) throw databaseError(error ?? {});
  return { id: data.id, duplicate: false };
}

export async function loadReading(client: SupabaseClient, owner: string, id: string): Promise<CloudPayload> {
  await requireOwner(client, owner);
  const { data, error } = await client.from("saju_readings").select("payload").eq("user_id", owner).eq("id", id).maybeSingle();
  if (error) throw databaseError(error);
  if (!data) throw new Error("결과가 삭제되었거나 이 계정에서 열 수 없습니다.");
  return validateCloudPayload(data.payload);
}

export async function deleteReading(client: SupabaseClient, owner: string, id: string): Promise<void> {
  await requireOwner(client, owner);
  const { data, error } = await client.from("saju_readings").delete().eq("user_id", owner).eq("id", id).select("id");
  if (error) throw databaseError(error);
  if (!data?.length) throw new Error("이미 삭제되었거나 이 계정에서 삭제할 수 없는 결과입니다.");
}
