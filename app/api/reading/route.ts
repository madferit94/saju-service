import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { calculate, InputError, validateInput, type SajuInput } from "../../../lib/saju/chart";
import { calculateDaewoon, type YunGender } from "../../../lib/saju/daewoon";
import { calculateBenefactors } from "../../../lib/saju/benefactors";
import {
  createGeminiReadingContext,
  createGeminiReadingPrompt,
  createGeminiResponseSchema,
  validateGeminiSajuReading,
  validateReadingGrounding,
} from "../../../lib/saju/gemini-reading";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function apiErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  const status = error.status ?? error.statusCode;
  return typeof status === "number" ? status : undefined;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 24_000) return failure(413, "request_too_large", "요청 내용을 확인해 주세요.");
    body = JSON.parse(raw);
  } catch {
    return failure(400, "invalid_json", "요청 내용을 읽지 못했습니다. 다시 시도해 주세요.");
  }

  if (!isRecord(body) || body.consent !== true) {
    return failure(400, "consent_required", "Gemini 전송에 동의한 뒤 해석을 요청해 주세요.");
  }
  if (body.yunGender !== 0 && body.yunGender !== 1) {
    return failure(400, "invalid_input", "대운 계산 기준을 다시 선택해 주세요.");
  }
  if (!isRecord(body.input)) {
    return failure(400, "invalid_input", "출생 정보를 다시 입력해 주세요.");
  }
  const fortuneYear = body.fortuneYear ?? new Date().getFullYear();
  if (typeof fortuneYear !== "number" || !Number.isInteger(fortuneYear) || fortuneYear < 1990 || fortuneYear > 2100) {
    return failure(400, "invalid_input", "살펴볼 연도는 1990~2100년을 선택해주세요.");
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return failure(503, "missing_api_key", "Gemini API 키가 설정되지 않았습니다. 서버 설정을 확인해 주세요.");
  }

  try {
    const input = validateInput(body.input as unknown as SajuInput);
    if (!input.birthplace) return failure(400, "invalid_input", "태어난 국가와 도시를 선택해 주세요.");
    const gender = body.yunGender as YunGender;
    const chart = calculate(input);
    const timeline = calculateDaewoon(input, gender);
    const benefactors = calculateBenefactors(chart);
    const context = createGeminiReadingContext(chart, timeline, benefactors, fortuneYear);
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000 } });
    let reading;
    let correction = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: createGeminiReadingPrompt(context) + correction,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: createGeminiResponseSchema(timeline.periods.map((p) => p.index)),
          maxOutputTokens: 16384,
          temperature: 0.45,
        },
      });
      try {
        const parsed: unknown = JSON.parse(response.text || "{}");
        const candidate = validateGeminiSajuReading(parsed, timeline.periods.map((period) => period.index), fortuneYear);
        validateReadingGrounding(candidate, context);
        reading = { ...candidate, analysisVersion: 1 as const };
        break;
      } catch (error) {
        if (attempt === 1) {
          return failure(502, "invalid_response", "해석에서 누락되거나 계산과 맞지 않는 항목이 있어 표시하지 않았습니다. 다시 요청해 주세요.");
        }
        correction = "\n\n직전 답변의 검증 오류: " + (error instanceof Error ? error.message : "필수 항목 누락") +
          "\n이 오류를 수정한 완전한 JSON을 처음부터 다시 작성하세요. 월운을 대운으로 부르지 말고, 평생운 네 시기와 모든 대운 index를 빠짐없이 포함하세요.";
      }
    }

    return NextResponse.json({ chart, timeline, benefactors, reading }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return failure(504, "timeout", "Gemini 응답 시간이 초과됐습니다. 잠시 뒤 다시 시도해 주세요.");
    }
    if (error instanceof InputError) return failure(400, "invalid_input", error.message);
    const status = apiErrorStatus(error);
    if (status === 429) return failure(429, "rate_limited", "Gemini 요청이 잠시 몰렸습니다. 조금 뒤 다시 시도해 주세요.");
    if (status === 402) return failure(402, "credits_depleted", "Gemini 사용 크레딧이 부족합니다. Google AI Studio에서 프로젝트의 사용 가능 크레딧과 결제 설정을 확인한 뒤 다시 요청해 주세요.");
    if (status === 401 || status === 403) return failure(503, "invalid_api_key", "Gemini API 키를 확인해 주세요.");
    if (status === 400) return failure(502, "request_rejected", "Gemini가 요청을 처리하지 못했습니다. 잠시 뒤 다시 요청해 주세요.");
    if (error instanceof TypeError) return failure(502, "network_error", "Gemini 서비스에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
    return failure(502, "gemini_error", "Gemini 해석을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }
}
