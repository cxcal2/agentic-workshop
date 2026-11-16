import { requireIdentity } from "../../../../cursor/identity";
import { sql } from "@/server/db";
import type { OpportunityRow } from "@/server/types";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const url = new URL(request.url);
  const county = url.searchParams.get("county")?.toLowerCase() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const minAmount = Number(url.searchParams.get("minAmount") || "0");
  const onlyNew = url.searchParams.get("new") === "1";
  const listType = url.searchParams.get("listType") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 500);
  const offset = Math.max(Number(url.searchParams.get("offset") || "0"), 0);

  const clauses = ["o.is_active = true"];
  const params: unknown[] = [];

  if (county && county !== "all") {
    params.push(county);
    clauses.push(`o.county = $${params.length}`);
  }
  if (onlyNew) clauses.push("o.is_new = true");
  if (listType) {
    params.push(listType);
    clauses.push(`o.list_type = $${params.length}`);
  }
  if (Number.isFinite(minAmount) && minAmount > 0) {
    params.push(minAmount);
    clauses.push(`o.amount_due >= $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    clauses.push(
      `(o.parcel_id ilike $${idx} or o.owner_name ilike $${idx} or o.property_address ilike $${idx})`,
    );
  }

  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const rows = await sql<OpportunityRow>(
    `select o.*,
            exists(select 1 from watchlist w where w.opportunity_id = o.id) as watched
     from opportunities o
     ${where}
     order by o.is_new desc, o.amount_due desc nulls last, o.last_seen_at desc
     limit $${limitIdx} offset $${offsetIdx}`,
    params,
  );

  const countParams = params.slice(0, params.length - 2);
  const countRows = await sql<{ count: string }>(
    `select count(*)::text as count from opportunities o ${where}`,
    countParams,
  );

  return Response.json(
    {
      total: Number(countRows[0]?.count ?? 0),
      rows,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
