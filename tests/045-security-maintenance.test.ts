import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextConfig, { securityHeaders } from "../next.config";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

const expectedHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
];

test("보안 헤더 3개가 정확한 값으로 정의되어 있다", () => {
  assert.deepEqual(securityHeaders, expectedHeaders);
});

test("headers()가 모든 경로(/:path*)에 보안 헤더를 적용한다", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const rules = await nextConfig.headers!();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/:path*");
  assert.deepEqual(rules[0].headers, expectedHeaders);
});

test("package.json과 package-lock.json의 이름·버전이 saju-service 0.3.1로 일치한다", () => {
  const pkg = readJson("../package.json");
  const lock = readJson("../package-lock.json");
  assert.equal(pkg.name, "saju-service");
  assert.equal(pkg.version, "0.3.1");
  assert.equal(lock.name, "saju-service");
  assert.equal(lock.version, "0.3.1");
  assert.equal(lock.packages[""].name, "saju-service");
  assert.equal(lock.packages[""].version, "0.3.1");
});

test("next는 16.4.2로 고정되어 있고 lock 파일도 같은 버전이다", () => {
  const pkg = readJson("../package.json");
  const lock = readJson("../package-lock.json");
  assert.equal(pkg.dependencies.next, "16.4.2");
  assert.equal(lock.packages[""].dependencies.next, "16.4.2");
  assert.equal(lock.packages["node_modules/next"].version, "16.4.2");
});
