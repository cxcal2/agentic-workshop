import { requireIdentity } from "../../../../cursor/identity";
import { GEORGIA_COUNTIES } from "@/server/georgia/counties";
import { getSettings, saveSettings } from "@/server/settings";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const settings = await getSettings();
  const q = new URL(request.url).searchParams.get("q")?.toLowerCase().trim() ?? "";

  const counties = GEORGIA_COUNTIES.filter((c) => {
    if (!q) return true;
    return (
      c.id.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.seat.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q)
    );
  }).map((c) => ({
    ...c,
    enabled: settings.enabledCounties.includes(c.id),
    overrideUrls: settings.countyOverrides[c.id]?.scanUrls ?? [],
  }));

  return Response.json(
    {
      total: GEORGIA_COUNTIES.length,
      enabledCounties: settings.enabledCounties,
      counties,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function PUT(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const body = (await request.json()) as {
    enabledCounties?: string[];
    countyOverrides?: Record<string, { scanUrls?: string[] }>;
    setOverride?: { countyId: string; scanUrls: string[] };
  };

  const current = await getSettings();
  let overrides = { ...current.countyOverrides };
  if (body.countyOverrides) overrides = body.countyOverrides;
  if (body.setOverride?.countyId) {
    const urls = (body.setOverride.scanUrls || []).map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) delete overrides[body.setOverride.countyId];
    else overrides[body.setOverride.countyId] = { scanUrls: urls };
  }

  const saved = await saveSettings({
    enabledCounties: body.enabledCounties ?? current.enabledCounties,
    countyOverrides: overrides,
  });

  return Response.json(
    { ok: true, settings: saved },
    { headers: { "cache-control": "private, no-store" } },
  );
}
