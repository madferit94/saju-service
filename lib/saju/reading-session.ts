import type { SajuInput } from "./chart";
import type { GeminiSajuReading } from "./gemini-reading";
import type { ReadingSummary } from "./reading-summary";

export const READING_PROMPT_VERSION = "combined-flow-2-summary-1";
export function readingSessionKey(input: SajuInput, gender: 0 | 1, year: number) {
  return JSON.stringify([READING_PROMPT_VERSION, input, gender, year]);
}
type Entry = { summary?: ReadingSummary; reading?: GeminiSajuReading };
// Component-owned memory only. Never share birth information across users or persist it here.
export class ReadingSession {
  private entries = new Map<string, Entry>();
  get(key: string) { return this.entries.get(key); }
  set(key: string, value: Entry) {
    this.entries.set(key, { ...this.entries.get(key), ...value });
    if (this.entries.size > 8) this.entries.delete(this.entries.keys().next().value!);
  }
  clear() { this.entries.clear(); }
}
