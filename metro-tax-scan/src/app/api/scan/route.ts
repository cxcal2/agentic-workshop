import { requireIdentity } from "../../../../cursor/identity";
import { runScan } from "@/server/scan";

export const maxDuration = 300;

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      trigger?: string;
    };
    const result = await runScan(body.trigger || "manual");
    return Response.json(
      {
        ok: true,
        scanRunId: result.scanRunId,
        usingSampleData: result.usingSampleData,
        inserted: result.inserted,
        updated: result.updated,
        counties: result.results.map((r) => ({
          county: r.county,
          status: r.status,
          count: r.opportunities.length,
          message: r.message,
          sourceUrl: r.sourceUrl,
        })),
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Scan failed",
      },
      { status: 500, headers: { "cache-control": "private, no-store" } },
    );
  }
}
