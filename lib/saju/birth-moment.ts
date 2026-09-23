import { Temporal } from "@js-temporal/polyfill";

export type Birthplace = {
  countryCode: string;
  countryName: string;
  city: string;
  province: string;
  timezone: string;
  longitude: number;
};

export type BirthMoment = {
  chinaTime: Date;
  localMeanSolarTime: Date;
  timezoneOffset: string;
};

export function resolveBirthMoment(date: string, time: string, birthplace?: Birthplace): BirthMoment {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!birthplace) {
    const chinaTime = new Date(Date.UTC(year, month - 1, day, hour - 1, minute));
    return { chinaTime, localMeanSolarTime: new Date(Date.UTC(year, month - 1, day, hour, minute)), timezoneOffset: "+09:00" };
  }

  let zoned: Temporal.ZonedDateTime;
  try {
    zoned = Temporal.ZonedDateTime.from(
      { year, month, day, hour, minute, timeZone: birthplace.timezone },
      { disambiguation: "reject" },
    );
  } catch {
    throw new Error("이 도시의 출생 시각이 일광절약시간 변경과 겹치거나 시간대가 올바르지 않습니다. 다른 정확한 시각을 확인해주세요.");
  }
  const instant = zoned.epochMilliseconds;
  return {
    chinaTime: new Date(instant + 8 * 60 * 60 * 1000),
    localMeanSolarTime: new Date(instant + Math.round(birthplace.longitude * 4 * 60 * 1000)),
    timezoneOffset: zoned.offset,
  };
}
