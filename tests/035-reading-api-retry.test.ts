import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { calculateDaewoon } from "../lib/saju/daewoon";
import type { SajuInput } from "../lib/saju/chart";

const input: SajuInput = {
  date: "1994-12-01", time: "08:37", calendar: "solar", topic: "general",
  birthplace: { countryCode: "KR", countryName: "대한민국", city: "서울", province: "서울특별시", timezone: "Asia/Seoul", longitude: 126.978 },
};
const body = { consent: true, input, yunGender: 0, fortuneYear: 2026 };
const plain = "맡은 일을 정리할 때 방향을 잡기 쉬울 수 있습니다. 준비가 길어지면 결과를 살필 기회를 놓칠 수 있습니다. 계산된 관계를 근거로 살펴본 풀이입니다.";

function validReading() {
  const indexes = calculateDaewoon(input, 0).periods.map((period) => period.index);
  return {
    readingVersion: 2, fortuneYear: 2026,
    synthesis: plain,
    lifetime: "삶의 앞부분에는 배우는 환경을 살펴보세요. 이후에는 경험을 어디에 쓸지 생각해 볼 수 있습니다. 초년, 청년, 중년, 후반의 계산된 흐름을 각각 비교합니다.",
    annual: plain,
    monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, reading: plain })),
    overview: plain, elements: plain, benefactors: plain, career: plain, relationships: plain, money: plain, caution: plain,
    periodReadings: indexes.map((index) => ({ index, theme: plain, strengths: plain, cautions: plain, advice: plain, reflection: plain })),
  };
}

function apiHarness(replies: unknown[]) {
  const filename = fileURLToPath(new URL("../app/api/reading/route.ts", import.meta.url));
  const requireActual = createRequire(filename);
  const calls: Record<string, any>[] = [];
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name: string) {
      if (name === "@google/genai") return { GoogleGenAI: class {
        models = { generateContent: async (options: Record<string, unknown>) => {
          calls.push(options);
          assert.ok(replies.length, "unexpected external request");
          return { text: JSON.stringify(replies.shift()) };
        } };
      } };
      return requireActual(name);
    },
    process: { env: { GEMINI_API_KEY: "synthetic-unit-test-key" } },
    console, Request, Response, AbortController, Error, TypeError, Date,
  }, { filename });
  return { calls, request: () => module.exports.POST(new Request("http://localhost/api/reading", { method: "POST", body: JSON.stringify(body) })) };
}

test("첫 문장에 명리 용어가 있으면 Gemini 종합 해석을 한 번 다시 생성한다", async () => {
  const good = validReading();
  const bad = { ...good, synthesis: "타고난 월지 未의 주된 지장간은 이렇게 나타납니다. 일을 익힐 때 방향을 잡을 수 있습니다." };
  const recovered = apiHarness([bad, good]);
  const response = await recovered.request();
  assert.equal(response.status, 200);
  assert.equal(recovered.calls.length, 2);
  assert.match(recovered.calls[1].contents, /첫 두 문장/);
  assert.match(recovered.calls[1].contents, /synthesis/);
  assert.equal((await response.json()).reading.synthesis, plain);

  const rejected = apiHarness([bad, bad]);
  const failed = await rejected.request();
  assert.equal(failed.status, 502);
  assert.equal(rejected.calls.length, 2);
  assert.equal((await failed.json()).error.code, "invalid_response");
});
