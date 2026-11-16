import {
  GEORGIA_COUNTY_BY_ID,
  METRO_ATLANTA_IDS,
  resolveCountyIds,
  type GeorgiaCounty,
} from "./georgia/counties";
import { sql } from "./db";

export type AppSettings = {
  enabledCounties: string[];
  countyOverrides: Record<string, { scanUrls?: string[] }>;
};

const DEFAULTS: AppSettings = {
  enabledCounties: [...METRO_ATLANTA_IDS],
  countyOverrides: {},
};

async function ensureSettingsTable() {
  await sql(`
    create table if not exists app_settings (
      key text primary key,
      value jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

function asSettings(raw: unknown): AppSettings {
  const value =
    typeof raw === "string"
      ? (JSON.parse(raw) as Partial<AppSettings>)
      : ((raw ?? {}) as Partial<AppSettings>);
  return {
    enabledCounties: resolveCountyIds(value.enabledCounties ?? DEFAULTS.enabledCounties),
    countyOverrides: value.countyOverrides ?? {},
  };
}

export async function getSettings(): Promise<AppSettings> {
  await ensureSettingsTable();
  const rows = await sql<{ value: unknown }>(
    `select value from app_settings where key = 'main' limit 1`,
  );
  if (!rows[0]?.value) return { ...DEFAULTS, countyOverrides: {} };
  return asSettings(rows[0].value);
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = {
    enabledCounties: patch.enabledCounties
      ? resolveCountyIds(patch.enabledCounties)
      : current.enabledCounties,
    countyOverrides: patch.countyOverrides ?? current.countyOverrides,
  };
  await sql(
    `insert into app_settings (key, value, updated_at)
     values ('main', $1::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [next],
  );
  return next;
}

export function countyWithOverrides(
  county: GeorgiaCounty,
  overrides: AppSettings["countyOverrides"],
): GeorgiaCounty {
  const over = overrides[county.id];
  if (!over?.scanUrls?.length) return county;
  return {
    ...county,
    scanUrls: over.scanUrls,
    collector: county.collector === "directory" ? "generic" : county.collector,
  };
}

export function getEnabledCountyConfigs(settings: AppSettings): GeorgiaCounty[] {
  return settings.enabledCounties
    .map((id) => GEORGIA_COUNTY_BY_ID[id])
    .filter(Boolean)
    .map((c) => countyWithOverrides(c, settings.countyOverrides));
}
