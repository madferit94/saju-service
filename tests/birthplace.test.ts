import test from "node:test";
import assert from "node:assert/strict";
import { resolveBirthMoment, type Birthplace } from "../lib/saju/birth-moment";
import { calculate, InputError, type SajuInput } from "../lib/saju/chart";
import { calculateDaewoon } from "../lib/saju/daewoon";
import { GET as getLocations } from "../app/api/locations/route";

const seoul: Birthplace = {
  countryCode: "KR", countryName: "Republic of Korea", city: "Seoul",
  province: "Seoul", timezone: "Asia/Seoul", longitude: 127,
};
const newYork: Birthplace = {
  countryCode: "US", countryName: "United States of America", city: "New York",
  province: "New York", timezone: "America/New_York", longitude: -73.98,
};
const input: SajuInput = {
  date: "2024-02-04", time: "17:26", calendar: "solar", topic: "general",
};

test("출생지 시간대와 경도를 각각 절기 시간과 지방평균시에 반영한다", () => {
  const korea = resolveBirthMoment("2000-01-01", "00:00", seoul);
  assert.equal(korea.timezoneOffset, "+09:00");
  assert.equal(korea.chinaTime.toISOString(), "1999-12-31T23:00:00.000Z");
  assert.equal(korea.localMeanSolarTime.toISOString(), "1999-12-31T23:28:00.000Z");

  const america = resolveBirthMoment("2000-01-01", "00:00", newYork);
  assert.equal(america.timezoneOffset, "-05:00");
  assert.equal(america.chinaTime.toISOString(), "2000-01-01T13:00:00.000Z");
  assert.equal(america.localMeanSolarTime.toISOString(), "2000-01-01T00:04:04.800Z");
});

test("같은 시계 시각도 한국과 뉴욕에서는 년·월주 및 대운 방향이 다르다", () => {
  const korea = { ...input, birthplace: seoul };
  const america = { ...input, birthplace: newYork };
  assert.deepEqual(calculate(korea).pillars.slice(0, 2).map((p) => p.text), ["癸卯", "乙丑"]);
  assert.deepEqual(calculate(america).pillars.slice(0, 2).map((p) => p.text), ["甲辰", "丙寅"]);
  assert.equal(calculateDaewoon(korea, 0, 2026).direction, "forward");
  assert.equal(calculateDaewoon(america, 0, 2026).direction, "backward");
  assert.equal(calculateDaewoon(korea, 0, 2026).periods.find((p) => p.index === 1)?.ganji, "丙寅");
  assert.equal(calculateDaewoon(america, 0, 2026).periods.find((p) => p.index === 1)?.ganji, "乙丑");
});

test("같은 시간대의 경도 차이로 23시 일주 경계가 달라진다", () => {
  const base = { ...input, date: "2000-06-15", time: "23:10" };
  const west = calculate({ ...base, birthplace: seoul });
  const east = calculate({ ...base, birthplace: { ...seoul, longitude: 135 } });
  assert.notEqual(west.pillars[2].text, east.pillars[2].text);
  assert.deepEqual(west.pillars.slice(2).map((p) => p.text), ["甲辰", "乙亥"]);
  assert.deepEqual(east.pillars.slice(2).map((p) => p.text), ["乙巳", "丙子"]);
});

test("뉴욕의 없는 시각과 중복 시각을 명확히 거부한다", () => {
  for (const [date, time] of [["2024-03-10", "02:30"], ["2024-11-03", "01:30"]]) {
    assert.throws(() => resolveBirthMoment(date, time, newYork), /일광절약시간/);
    assert.throws(
      () => calculate({ ...input, date, time, birthplace: newYork }),
      (error: unknown) => error instanceof InputError && error.field === "time" && /일광절약시간/.test(error.message),
    );
    assert.throws(() => calculateDaewoon({ ...input, date, time, birthplace: newYork }, 0, 2026), /일광절약시간/);
  }
  assert.equal(resolveBirthMoment("2024-03-10", "03:30", newYork).timezoneOffset, "-04:00");
});

test("국가 목록 및 국가별 도시 검색은 필요한 장소 정보를 반환한다", async () => {
  const countries = await (await getLocations(new Request("http://localhost/api/locations?countries=1"))).json();
  assert.ok(countries.countries.some((country: { code: string }) => country.code === "KR"));
  assert.ok(countries.countries.some((country: { code: string }) => country.code === "US"));

  const korean = await (await getLocations(new Request("http://localhost/api/locations?country=KR&q=서울"))).json();
  assert.ok(korean.cities.some((city: Birthplace) => city.city === "Seoul" && city.timezone === "Asia/Seoul"));

  const american = await (await getLocations(new Request("http://localhost/api/locations?country=US&q=New%20York"))).json();
  assert.ok(american.cities.some((city: Birthplace) => city.city === "New York" && city.timezone === "America/New_York"));

  const invalid = await (await getLocations(new Request("http://localhost/api/locations?country=U&q=N"))).json();
  assert.deepEqual(invalid.cities, []);
});
