import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import { createGeminiReadingContext, createGeminiReadingPrompt, createGeminiResponseSchema, validateGeminiSajuReading, validateReadingGrounding } from "../lib/saju/gemini-reading";

async function main() {
  const input: SajuInput = { date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general" };
  const chart = calculate(input), timeline = calculateDaewoon(input, 0);
  const context = createGeminiReadingContext(chart, timeline, calculateBenefactors(chart), 2026);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 90000 } });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite", contents: createGeminiReadingPrompt(context),
    config: { responseMimeType: "application/json", responseJsonSchema: createGeminiResponseSchema(timeline.periods.map((p) => p.index)), maxOutputTokens: 16384, temperature: 0.45 },
  });
  const body = JSON.parse(response.text || "{}");
  const target = join(tmpdir(), "saju-integrated-raw-synthetic.json");
  writeFileSync(target, JSON.stringify(body, null, 2));
  console.log(JSON.stringify({
    path: target, finish: response.candidates?.[0]?.finishReason, version: body.readingVersion, year: body.fortuneYear,
    fields: Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === "string" ? v.length : Array.isArray(v) ? v.length : v])),
    indexes: body.periodReadings?.map((p: { index: number }) => p.index),
    months: body.monthly?.map((m: { month: number; reading: string }) => [m.month, m.reading?.length]),
    periodLengths: body.periodReadings?.map((p: object) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, typeof v === "string" ? v.length : v]))),
  }));
  try {
    const reading = validateGeminiSajuReading(body, timeline.periods.map((p) => p.index), 2026);
    validateReadingGrounding(reading, context);
    console.log("VALID");
    console.log(JSON.stringify({ synthesis: body.synthesis, lifetime: body.lifetime, month: body.monthly?.[0] }));
  } catch (error) {
    console.log(error instanceof Error ? error.message : "Validation failed");
    process.exitCode = 1;
  }
}
main().catch(() => { console.error("Synthetic reading request failed; inspect account or network settings."); process.exitCode = 1; });
