import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculate, type SajuInput } from "../lib/saju/chart";
import { buildDoryeongOneLine } from "../lib/saju/doryeong-one-line";
import { publicShareUrl, renderDoryeongCard, shareCopy } from "../lib/share/doryeong-card";

const birth: SajuInput = { date: "2005-12-23", time: "08:37", calendar: "solar", topic: "general" };
const line = buildDoryeongOneLine(calculate(birth)).line;

test("공유 문구는 계산된 한줄평과 공개 서비스 주소만 담는다", () => {
  const url = publicShareUrl("http://localhost:3000");
  const copy = shareCopy(line, url);

  assert.equal(url, "https://saju-service-steel.vercel.app/");
  assert.equal(copy, `“${line}”\n\n나도 내 사주 한줄평 보기\n${url}`);
  assert.doesNotMatch(copy, /2005-12-23|08:37|서울|출생지|출생 시각|시간|월주|일주|시주/u);
  assert.doesNotMatch(copy, /localhost|127\.0\.0\.1|[?&#]chart=|[?&#]birth=/u);
});

test("공유 주소는 로컬 시험 주소를 운영 주소로 바꾸고 다른 주소의 개인 경로·쿼리를 버린다", () => {
  assert.equal(publicShareUrl("http://127.0.0.1:3000"), "https://saju-service-steel.vercel.app/");
  assert.equal(publicShareUrl("https://preview.example.test/private/result?date=2005-12-23#chart"), "https://preview.example.test/");
  assert.equal(publicShareUrl("https://saju-service-steel.vercel.app/result?id=secret"), "https://saju-service-steel.vercel.app/");
});

test("PNG 카드에는 한줄평과 공개 표제만 그려지고 출생 정보는 그려지지 않는다", async () => {
  const drawn: string[] = [];
  const context = {
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    fillRect: () => undefined,
    beginPath: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    strokeRect: () => undefined,
    measureText: (value: string) => ({ width: value.length * 20 }),
    fillText: (value: string) => drawn.push(value),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (done: (blob: Blob) => void) => done(new Blob(["png"], { type: "image/png" })),
  };
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { document: { fonts: { ready: Promise.resolve() }, createElement: () => canvas } });

  try {
    const blob = await renderDoryeongCard(line);
    const printed = drawn.join(" ");
    assert.equal(blob.type, "image/png");
    assert.equal(canvas.width, 1080);
    assert.equal(canvas.height, 1350);
    assert.match(printed, /내 길을 비추는 한마디/u);
    assert.match(printed, /나의 대운, 나의 시간/u);
    assert.ok(printed.replace(/\s/gu, "").includes(line.replace(/\s/gu, "")), "이미지에 실제 한줄평을 넣어야 합니다");
    assert.doesNotMatch(printed, /2005-12-23|08:37|서울|출생지|생년월일|월주|일주|시주/u);
  } finally {
    Object.assign(globalThis, { document: previousDocument });
  }
});

test("결과 화면은 계산된 한줄평을 카드에 전달하고 공유·저장은 사용자 버튼에서만 시작한다", () => {
  const resultSource = readFileSync(new URL("../app/saju-form.tsx", import.meta.url), "utf8");
  const cardSource = readFileSync(new URL("../app/doryeong-share-card.tsx", import.meta.url), "utf8");

  assert.match(resultSource, /<DoryeongShareCard line=\{doryeongOneLine\.line\} \/>/u);
  assert.match(cardSource, /onClick=\{share\}/u);
  assert.match(cardSource, /onClick=\{saveImage\}/u);
  assert.match(cardSource, /if \(navigator\.share && !localPreview\)/u, "로컬 시험에서는 실제 기기 공유창 대신 복사해야 합니다");
  assert.match(cardSource, /navigator\.share\(\{ title: .* text: `“\$\{line\}”\\n\\n나도 내 사주 한줄평 보기`, url,/u, "기기 공유 문구에는 주소를 중복으로 넣지 않아야 합니다");
  assert.match(cardSource, /navigator\.clipboard\.writeText\(text\)/u);
  assert.match(cardSource, /renderDoryeongCard\(line\)/u);
  assert.doesNotMatch(cardSource, /(?:birthDate|birthTime|birthPlace|chart|pillars|localStorage|supabase)/u);
});
