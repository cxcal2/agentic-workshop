import { requireIdentity } from "../../../../cursor/identity";
import { sql } from "@/lib/db";
import { getLastSuccessfulScan, shouldAutoScan } from "@/lib/scan";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const last = await getLastSuccessfulScan();
  const countyRows = await sql<{
    county: string;
    status: string;
    opportunity_count: number;
    message: string;
    source_url: string;
  }>(
    last
      ? `select county, status, opportunity_count, message, source_url
         from county_scan_results
         where scan_run_id = $1
         order by county`
      : `select null::text as county, null::text as status, 0 as opportunity_count,
                ''::text as message, ''::text as source_url
         where false`,
    last ? [last.id] : [],
  );

  const stats = await sql<{
    active: string;
    newly: string;
    watched: string;
  }>(
    `select
       (select count(*)::text from opportunities where is_active) as active,
       (select count(*)::text from opportunities where is_active and is_new) as newly,
       (select count(*)::text from watchlist) as watched`,
  );

  return Response.json(
    {
      lastScan: last,
      needsScan: await shouldAutoScan(),
      counties: countyRows,
      stats: {
        active: Number(stats[0]?.active ?? 0),
        newly: Number(stats[0]?.newly ?? 0),
        watched: Number(stats[0]?.watched ?? 0),
      },
      viewer: {
        name: identity.name,
        email: identity.email,
      },
      georgiaNote:
        "Georgia runs redeemable tax-deed sales (not classic tax-lien certificates). Profit comes from auction purchases and/or the statutory redemption premium if the owner redeems.",
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}