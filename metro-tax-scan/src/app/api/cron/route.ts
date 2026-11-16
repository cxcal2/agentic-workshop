import { runScan, shouldAutoScan } from "@/server/scan";

export const maxDuration = 300;

/**
 * Daily runner. Call with Authorization: Bearer $CRON_SECRET
 * from an external scheduler (e.g. cron-job.org) once per day.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!secret || token !== secret) {
    return Response.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    );
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && !(await shouldAutoScan())) {
    return Response.json(
      { ok: true, skipped: true, reason: "already scanned within 20 hours" },
      { headers: { "cache-control": "private, no-store" } },
    );
  }

  const result = await runScan("cron");
  return Response.json(
    {
      ok: true,
      skipped: false,
      scanRunId: result.scanRunId,
      usingSampleData: result.usingSampleData,
      inserted: result.inserted,
      updated: result.updated,
      counties: result.results.map((r) => ({
        county: r.county,
        status: r.status,
        count: r.opportunities.length,
        message: r.message,
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
