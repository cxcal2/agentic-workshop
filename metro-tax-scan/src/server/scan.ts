import { collectAllCounties } from "./collectors";
import { sql } from "./db";
import { SAMPLE_RESULTS } from "./sample-data";
import type { CountyCollectResult, RawOpportunity } from "./types";

const STALE_HOURS = 20;
const BATCH = 80;

export async function getLastSuccessfulScan(): Promise<{
  id: number;
  finished_at: string;
  using_sample_data: boolean;
} | null> {
  const rows = await sql<{
    id: number;
    finished_at: string;
    using_sample_data: boolean;
  }>(
    `select id, finished_at, using_sample_data
     from scan_runs
     where status = 'ok' and finished_at is not null
     order by finished_at desc
     limit 1`,
  );
  return rows[0] ?? null;
}

export async function shouldAutoScan(): Promise<boolean> {
  const last = await getLastSuccessfulScan();
  if (!last?.finished_at) return true;
  const finished = new Date(last.finished_at).getTime();
  return Date.now() - finished > STALE_HOURS * 60 * 60 * 1000;
}

async function upsertBatch(
  opportunities: RawOpportunity[],
  scanRunId: number,
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < opportunities.length; i += BATCH) {
    const slice = opportunities.slice(i, i + BATCH);
    for (const opp of slice) {
      const existing = await sql<{ id: number }>(
        `select id from opportunities
         where county = $1 and parcel_id = $2 and list_type = $3
         limit 1`,
        [opp.county, opp.parcelId, opp.listType],
      );

      if (existing[0]) {
        await sql(
          `update opportunities set
             owner_name = $1,
             property_address = $2,
             amount_due = $3,
             tax_years = $4,
             sale_date = $5,
             source_url = $6,
             source_label = $7,
             last_seen_at = now(),
             last_scan_run_id = $8,
             is_new = false,
             is_active = true,
             notes = $9
           where id = $10`,
          [
            opp.ownerName ?? "",
            opp.propertyAddress ?? "",
            opp.amountDue ?? null,
            opp.taxYears ?? "",
            opp.saleDate ?? null,
            opp.sourceUrl,
            opp.sourceLabel,
            scanRunId,
            opp.notes ?? "",
            existing[0].id,
          ],
        );
        updated += 1;
      } else {
        await sql(
          `insert into opportunities (
             county, parcel_id, owner_name, property_address, amount_due, tax_years,
             sale_date, list_type, source_url, source_label, last_scan_run_id,
             is_new, is_active, notes
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,true,$12)`,
          [
            opp.county,
            opp.parcelId,
            opp.ownerName ?? "",
            opp.propertyAddress ?? "",
            opp.amountDue ?? null,
            opp.taxYears ?? "",
            opp.saleDate ?? null,
            opp.listType,
            opp.sourceUrl,
            opp.sourceLabel,
            scanRunId,
            opp.notes ?? "",
          ],
        );
        inserted += 1;
      }
    }
  }

  return { inserted, updated };
}

export async function runScan(triggerSource: string): Promise<{
  scanRunId: number;
  usingSampleData: boolean;
  results: CountyCollectResult[];
  inserted: number;
  updated: number;
}> {
  const runRows = await sql<{ id: number }>(
    `insert into scan_runs (status, trigger_source) values ('running', $1) returning id`,
    [triggerSource],
  );
  const scanRunId = runRows[0].id;

  let results: CountyCollectResult[] = [];
  let usingSampleData = false;

  try {
    results = await collectAllCounties();
    const liveHits = results.filter((r) => r.status === "ok" || r.status === "empty").length;
    if (liveHits === 0) {
      usingSampleData = true;
      results = SAMPLE_RESULTS;
    }

    for (const result of results) {
      if (result.status === "ok" || result.status === "sample" || result.status === "empty") {
        await sql(
          `update opportunities set is_active = false
           where county = $1 and is_active = true`,
          [result.county],
        );
      }
    }

    let inserted = 0;
    let updated = 0;
    for (const result of results) {
      const counts = await upsertBatch(result.opportunities, scanRunId);
      inserted += counts.inserted;
      updated += counts.updated;
      await sql(
        `insert into county_scan_results
           (scan_run_id, county, status, opportunity_count, source_url, message)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          scanRunId,
          result.county,
          result.status,
          result.opportunities.length,
          result.sourceUrl,
          result.message,
        ],
      );
    }

    await sql(
      `update scan_runs
       set status = 'ok', finished_at = now(), using_sample_data = $1,
           notes = $2
       where id = $3`,
      [
        usingSampleData,
        usingSampleData
          ? "Live county fetches failed; loaded sample opportunities."
          : `Inserted ${inserted}, updated ${updated}.`,
        scanRunId,
      ],
    );

    return { scanRunId, usingSampleData, results, inserted, updated };
  } catch (error) {
    await sql(
      `update scan_runs
       set status = 'error', finished_at = now(), notes = $1
       where id = $2`,
      [error instanceof Error ? error.message : "Scan failed", scanRunId],
    );
    throw error;
  }
}
