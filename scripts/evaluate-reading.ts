import { GoogleGenAI } from "@google/genai";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { calculateBenefactors } from "../lib/saju/benefactors";
import {
  createGeminiReadingContext,
  createGeminiReadingPrompt,
  createGeminiResponseSchema,
  validateGeminiSajuReading,
  validateReadingGrounding,
} from "../lib/saju/gemini-reading";

const samples = {
  adult: { date: "1994-12-01", time: "08:37", gender: 1 as const },
  minor: { date: "2011-07-12", time: "16:40", gender: 0 as const },
};
async function main() {
const name = process.argv[2] as keyof typeof samples;
const sample = samples[name];
const apiKey = process.env.GEMINI_API_KEY;
if (!sample || !apiKey) {
  throw new Error("가상 사례 adult 또는 minor와 GEMINI_API_KEY 설정이 필요합니다.");
}

const input: SajuInput = {
  date: sample.date, time: sample.time, calendar: "solar", topic: "general", question: "",
  birthplace: { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 },
};
const chart = calculate(input);
const timeline = calculateDaewoon(input, sample.gender);
const context = createGeminiReadingContext(chart, timeline, calculateBenefactors(chart), 2026);
const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000 } });
const started = Date.now();
const response = await ai.models.generateContent({
  model: "gemini-3.5-flash-lite", contents: createGeminiReadingPrompt(context),
  config: { responseMimeType: "application/json", responseJsonSchema: createGeminiResponseSchema(timeline.periods.map((p) => p.index)), maxOutputTokens: 16384 },
});
const reading = validateGeminiSajuReading(JSON.parse(response.text || "{}"), timeline.periods.map((p) => p.index), 2026);
let grounding = "통과";
try { validateReadingGrounding(reading, context); } catch (error) { grounding = error instanceof Error ? error.message : "검증 실패"; }
const first = (value: string | undefined) => value?.split(/[.!?。]/, 1)[0] ?? "";
process.stdout.write(JSON.stringify({
  sample: name, seconds: Math.round((Date.now() - started) / 100) / 10, grounding,
  monthly: reading.monthly?.length, periods: reading.periodReadings.length,
  synthesis: first(reading.synthesis), annual: first(reading.annual),
  overview: first(reading.overview), career: first(reading.career),
  relationships: first(reading.relationships), money: first(reading.money),
}, null, 2) + "\n");
}

main().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : "평가 실패") + "\n");
  process.exitCode = 1;
});
