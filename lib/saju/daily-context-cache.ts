import { unstable_cache } from "next/cache";
import { buildDailyContext } from "./daily-fortune";

// The date is an argument and therefore part of the cache key. Missed or duplicate cron calls are safe.
export const getCachedDailyContext = unstable_cache(
  async (date: string) => buildDailyContext(date),
  ["daily-context-v1"],
  { revalidate: 172800 },
);
