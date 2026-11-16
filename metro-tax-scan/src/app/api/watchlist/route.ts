import { requireIdentity } from "../../../../cursor/identity";
import { sql } from "@/server/db";

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const body = (await request.json()) as { opportunityId?: number; note?: string };
  const opportunityId = Number(body.opportunityId);
  if (!Number.isFinite(opportunityId) || opportunityId <= 0) {
    return Response.json({ ok: false, error: "invalid opportunityId" }, { status: 400 });
  }

  await sql(
    `insert into watchlist (opportunity_id, note)
     values ($1, $2)
     on conflict (opportunity_id) do update set note = excluded.note`,
    [opportunityId, body.note ?? ""],
  );

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function DELETE(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const opportunityId = Number(new URL(request.url).searchParams.get("opportunityId"));
  if (!Number.isFinite(opportunityId) || opportunityId <= 0) {
    return Response.json({ ok: false, error: "invalid opportunityId" }, { status: 400 });
  }

  await sql(`delete from watchlist where opportunity_id = $1`, [opportunityId]);
  return Response.json(
    { ok: true },
    { headers: { "cache-control": "private, no-store" } },
  );
}
