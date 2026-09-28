import type { SajuInput } from "./chart";
import type { YunGender } from "./daewoon";

export const LIFE_NOTE_LIMIT = 120;

export type LifeNotes = Record<string, string>;

export function lifeNoteStorageKey(input: SajuInput, yunGender: YunGender): string {
  const identity = {
    date: input.date,
    time: input.time,
    calendar: input.calendar,
    leapMonth: input.leapMonth,
    unknownTime: input.unknownTime,
    birthplace: input.birthplace ? {
      countryCode: input.birthplace.countryCode,
      city: input.birthplace.city,
      province: input.birthplace.province,
      timezone: input.birthplace.timezone,
      longitude: input.birthplace.longitude,
    } : undefined,
    yunGender,
  };
  return `saju-life-notes:v1:${JSON.stringify(identity)}`;
}

export function lifeNotePeriodKey(period: { index: number; startYear: number; endYear: number }): string {
  return `${period.index}:${period.startYear}:${period.endYear}`;
}

export function readLifeNotes(key: string, storage?: Storage): { notes: LifeNotes; error: boolean } {
  try {
    const target = storage ?? window.localStorage;
    const raw = target.getItem(key);
    if (!raw) return { notes: {}, error: false };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { notes: {}, error: true };
    const notes: LifeNotes = {};
    for (const [period, note] of Object.entries(value)) {
      if (/^\d+:\d{4}:\d{4}$/.test(period) && typeof note === "string" && note.trim() && note.length <= LIFE_NOTE_LIMIT) {
        notes[period] = note;
      }
    }
    return { notes, error: false };
  } catch {
    return { notes: {}, error: true };
  }
}

export function writeLifeNotes(key: string, notes: LifeNotes, storage?: Storage): boolean {
  try {
    const target = storage ?? window.localStorage;
    if (Object.entries(notes).some(([period, note]) => !/^\d+:\d{4}:\d{4}$/.test(period) ||
      typeof note !== "string" || !note.trim() || note.length > LIFE_NOTE_LIMIT)) return false;
    if (Object.keys(notes).length === 0) target.removeItem(key);
    else target.setItem(key, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}
