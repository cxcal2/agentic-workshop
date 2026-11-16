import {
  GEORGIA_COUNTY_BY_ID,
  type GeorgiaCounty,
} from "../georgia/counties";
import { getEnabledCountyConfigs, getSettings } from "../settings";
import type { CountyCollectResult } from "../types";
import { collectCobb } from "./cobb";
import { collectDekalb } from "./dekalb";
import { collectFulton } from "./fulton";
import { collectGenericCounty } from "./generic";
import { collectHenry } from "./henry";

const SPECIALIZED: Record<string, () => Promise<CountyCollectResult>> = {
  cobb: collectCobb,
  dekalb: collectDekalb,
  fulton: collectFulton,
  henry: collectHenry,
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function collectCounty(county: GeorgiaCounty): Promise<CountyCollectResult> {
  const specialized = SPECIALIZED[county.id];
  if (specialized) return specialized();
  return collectGenericCounty(county);
}

export async function collectCounties(
  countyIds?: string[],
): Promise<CountyCollectResult[]> {
  const settings = await getSettings();
  let configs: GeorgiaCounty[];
  if (countyIds?.length) {
    configs = countyIds
      .map((id) => GEORGIA_COUNTY_BY_ID[id.toLowerCase()])
      .filter(Boolean)
      .map((c) => {
        const over = settings.countyOverrides[c.id];
        return over?.scanUrls?.length
          ? { ...c, scanUrls: over.scanUrls, collector: "generic" as const }
          : c;
      });
  } else {
    configs = getEnabledCountyConfigs(settings);
  }

  if (configs.length === 0) {
    return [
      {
        county: "none",
        status: "skipped",
        sourceUrl: "",
        message: "No counties selected. Choose counties in settings, then run a scan.",
        opportunities: [],
      },
    ];
  }

  return mapPool(configs, 4, collectCounty);
}

/** @deprecated use collectCounties */
export async function collectAllCounties(): Promise<CountyCollectResult[]> {
  return collectCounties();
}
