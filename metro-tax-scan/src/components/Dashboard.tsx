"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { OpportunityRow } from "@/server/types";

type StatusPayload = {
  lastScan: {
    id: number;
    finished_at: string;
    using_sample_data: boolean;
  } | null;
  needsScan: boolean;
  counties: {
    county: string;
    status: string;
    opportunity_count: number;
    message: string;
    source_url: string;
  }[];
  stats: { active: number; newly: number; watched: number };
  enabledCounties: string[];
  georgiaCountyCount: number;
  viewer: { name: string; email: string };
  georgiaNote: string;
};

type CountyRow = {
  id: string;
  name: string;
  label: string;
  seat: string;
  taxOfficeUrl: string;
  scanUrls: string[];
  collector: string;
  enabled: boolean;
  overrideUrls: string[];
};

type OppPayload = { total: number; rows: OpportunityRow[] };

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function when(iso?: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Dashboard() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [rows, setRows] = useState<OpportunityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [county, setCounty] = useState("all");
  const [q, setQ] = useState("");
  const [minAmount, setMinAmount] = useState("0");
  const [onlyNew, setOnlyNew] = useState(false);
  const [listType, setListType] = useState("");
  const [error, setError] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [booting, setBooting] = useState(true);

  const [countyCatalog, setCountyCatalog] = useState<CountyRow[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [countySearch, setCountySearch] = useState("");
  const [overrideCounty, setOverrideCounty] = useState("");
  const [overrideUrl, setOverrideUrl] = useState("");

  async function loadStatus() {
    const res = await fetch("/api/status", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load status");
    return (await res.json()) as StatusPayload;
  }

  async function loadCounties(search = "") {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    const res = await fetch(`/api/counties?${sp}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load Georgia counties");
    const json = (await res.json()) as {
      enabledCounties: string[];
      counties: CountyRow[];
    };
    setEnabled(json.enabledCounties);
    setCountyCatalog(json.counties);
    return json;
  }

  async function loadOpportunities(params?: {
    county?: string;
    q?: string;
    minAmount?: string;
    onlyNew?: boolean;
    listType?: string;
  }) {
    const sp = new URLSearchParams();
    sp.set("county", params?.county ?? county);
    sp.set("q", params?.q ?? q);
    sp.set("minAmount", params?.minAmount ?? minAmount);
    sp.set("listType", params?.listType ?? listType);
    if (params?.onlyNew ?? onlyNew) sp.set("new", "1");
    sp.set("limit", "200");
    const res = await fetch(`/api/opportunities?${sp}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load opportunities");
    return (await res.json()) as OppPayload;
  }

  async function refreshAll(opts?: { autoScan?: boolean }) {
    setError("");
    const [st] = await Promise.all([loadStatus(), loadCounties(countySearch)]);
    setStatus(st);
    setEnabled(st.enabledCounties);
    if (opts?.autoScan && st.needsScan) {
      setScanMessage("Daily window elapsed — running enabled county scan…");
      const scanRes = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger: "auto" }),
      });
      const scanJson = await scanRes.json();
      if (!scanRes.ok || !scanJson.ok) {
        throw new Error(scanJson.error || "Auto scan failed");
      }
      setScanMessage(
        scanJson.usingSampleData
          ? "Scan finished with sample data (live county fetch failed)."
          : `Scan finished — ${scanJson.inserted} new, ${scanJson.updated} updated across ${scanJson.counties?.length ?? 0} counties.`,
      );
      const st2 = await loadStatus();
      setStatus(st2);
    }
    const opp = await loadOpportunities();
    setRows(opp.rows);
    setTotal(opp.total);
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        await refreshAll({ autoScan: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setBooting(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterChips = useMemo(() => {
    const chips = [{ id: "all", label: "All results" }];
    for (const id of enabled.slice(0, 12)) {
      chips.push({ id, label: id });
    }
    return chips;
  }, [enabled]);

  function applyFilters() {
    startTransition(async () => {
      try {
        const opp = await loadOpportunities();
        setRows(opp.rows);
        setTotal(opp.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Filter failed");
      }
    });
  }

  function runManualScan() {
    startTransition(async () => {
      try {
        setScanMessage(
          `Scanning ${enabled.length || "selected"} Georgia count${enabled.length === 1 ? "y" : "ies"}…`,
        );
        const scanRes = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trigger: "manual" }),
        });
        const scanJson = await scanRes.json();
        if (!scanRes.ok || !scanJson.ok) {
          throw new Error(scanJson.error || "Scan failed");
        }
        setScanMessage(
          scanJson.usingSampleData
            ? "Finished with sample data fallback."
            : `Finished — ${scanJson.inserted} new, ${scanJson.updated} updated.`,
        );
        await refreshAll({ autoScan: false });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Scan failed");
      }
    });
  }

  function saveEnabled(next: string[]) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/counties", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabledCounties: next }),
        });
        if (!res.ok) throw new Error("Could not save county selection");
        setEnabled(next);
        await loadCounties(countySearch);
        const st = await loadStatus();
        setStatus(st);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function toggleCounty(id: string) {
    const next = enabled.includes(id)
      ? enabled.filter((x) => x !== id)
      : [...enabled, id];
    saveEnabled(next);
  }

  function applyPreset(preset: "metro" | "live" | "clear") {
    if (preset === "metro") saveEnabled(["fulton", "henry", "cobb", "dekalb"]);
    else if (preset === "live") {
      const live = countyCatalog
        .filter((c) => c.collector !== "directory")
        .map((c) => c.id);
      // catalog may be filtered by search — reload full then set
      startTransition(async () => {
        const all = await loadCounties("");
        const ids = all.counties
          .filter((c) => c.collector !== "directory")
          .map((c) => c.id);
        saveEnabled(ids.length ? ids : live);
      });
    } else saveEnabled([]);
  }

  function saveOverride() {
    if (!overrideCounty || !overrideUrl.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/counties", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            setOverride: {
              countyId: overrideCounty,
              scanUrls: [overrideUrl.trim()],
            },
            enabledCounties: enabled.includes(overrideCounty)
              ? enabled
              : [...enabled, overrideCounty],
          }),
        });
        if (!res.ok) throw new Error("Could not save listing URL");
        setOverrideUrl("");
        await loadCounties(countySearch);
        setScanMessage(`Saved listing URL for ${overrideCounty}.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Override failed");
      }
    });
  }

  async function toggleWatch(row: OpportunityRow) {
    if (row.watched) {
      await fetch(`/api/watchlist?opportunityId=${row.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunityId: row.id }),
      });
    }
    const opp = await loadOpportunities();
    setRows(opp.rows);
    setTotal(opp.total);
    const st = await loadStatus();
    setStatus(st);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <header className="fade-up mb-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--accent-deep)]">
            Georgia · all 159 counties
          </p>
          <h1 className="brand text-5xl leading-[0.95] text-[var(--ink)] sm:text-6xl">
            Metro Tax Scan
          </h1>
          <p className="mt-4 max-w-2xl text-base text-[var(--muted)] sm:text-lg">
            Search any Georgia county tax commissioner / sheriff tax-sale posting for
            unpaid-tax opportunities. Enable counties, run daily, and track what is new.
          </p>
        </div>
        <div className="panel fade-up-delay rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Signed in
              </p>
              <p className="mt-1 font-semibold">{status?.viewer.name || "Investor"}</p>
            </div>
            <button
              type="button"
              onClick={runManualScan}
              disabled={pending || enabled.length === 0}
              className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-deep)] disabled:opacity-60"
            >
              {pending ? "Working…" : "Run scan now"}
            </button>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Last scan:{" "}
            <span className="font-medium text-[var(--ink)]">
              {when(status?.lastScan?.finished_at)} ET
            </span>
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enabled:{" "}
            <span className="font-medium text-[var(--ink)]">{enabled.length}</span> /{" "}
            {status?.georgiaCountyCount ?? 159}
          </p>
          {status?.lastScan?.using_sample_data ? (
            <p className="mt-2 text-sm text-[var(--signal)]">Showing sample data fallback.</p>
          ) : null}
          {scanMessage ? (
            <p className="mt-2 text-sm text-[var(--new)]">{scanMessage}</p>
          ) : null}
        </div>
      </header>

      <section className="fade-up mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active opportunities", value: status?.stats.active ?? "—" },
          { label: "New since last scan", value: status?.stats.newly ?? "—" },
          { label: "Watchlist", value: status?.stats.watched ?? "—" },
        ].map((item) => (
          <div key={item.label} className="panel rounded-2xl px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              {item.label}
            </p>
            <p className="brand mt-2 text-3xl">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="panel fade-up mb-6 rounded-2xl p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="brand text-2xl">Georgia counties</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Select any local government. Specialized parsers cover Fulton, Henry, Cobb,
              and DeKalb; others use the generic tax-office / tax-sale page harvester.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--line)]"
              onClick={() => applyPreset("metro")}
            >
              Metro Atlanta
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--line)]"
              onClick={() => applyPreset("live")}
            >
              All with URLs
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--line)]"
              onClick={() => applyPreset("clear")}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mb-3 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
          <input
            value={countySearch}
            onChange={(e) => setCountySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                startTransition(async () => {
                  await loadCounties(countySearch);
                });
              }
            }}
            placeholder="Search county or seat (e.g. Chatham, Savannah)"
            className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
          />
          <div className="flex gap-2">
            <select
              value={overrideCounty}
              onChange={(e) => setOverrideCounty(e.target.value)}
              className="w-40 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5"
            >
              <option value="">Add listing URL…</option>
              {countyCatalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={overrideUrl}
              onChange={(e) => setOverrideUrl(e.target.value)}
              placeholder="https://…/tax-sale"
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={saveOverride}
            className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Save URL
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--line)] bg-white/50 p-2">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {countyCatalog.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white"
              >
                <input
                  type="checkbox"
                  checked={enabled.includes(c.id)}
                  onChange={() => toggleCounty(c.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {c.seat} · {c.collector}
                    {c.overrideUrls?.length ? " · custom URL" : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="panel fade-up mb-6 rounded-2xl p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setCounty(chip.id);
                startTransition(async () => {
                  const opp = await loadOpportunities({ county: chip.id });
                  setRows(opp.rows);
                  setTotal(opp.total);
                });
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize transition ${
                county === chip.id
                  ? "bg-[var(--ink)] text-white"
                  : "bg-white/70 text-[var(--ink)] hover:bg-white"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1.3fr_0.7fr_0.7fr_auto_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search parcel, owner, or address"
            className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
          />
          <input
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            type="number"
            min={0}
            step={100}
            placeholder="Min amount"
            className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
          />
          <select
            value={listType}
            onChange={(e) => setListType(e.target.value)}
            className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 outline-none"
          >
            <option value="">All list types</option>
            <option value="tax_sale">Tax sale</option>
            <option value="delinquent">Delinquent</option>
            <option value="sale_notice">Sale notice</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(e) => setOnlyNew(e.target.checked)}
            />
            New only
          </label>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </section>

      {status?.counties?.length ? (
        <section className="fade-up mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {status.counties.map((c) => (
            <a
              key={c.county}
              href={c.source_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="panel block rounded-2xl p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold capitalize">{c.county}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    c.status === "ok"
                      ? "bg-emerald-100 text-emerald-800"
                      : c.status === "empty" || c.status === "skipped"
                        ? "bg-slate-100 text-slate-700"
                        : c.status === "sample"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{c.opportunity_count}</p>
              <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">{c.message}</p>
            </a>
          ))}
        </section>
      ) : null}

      <section className="panel fade-up overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-center gap-2">
            {(pending || booting) && (
              <span className="pulse-dot inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            )}
            <h2 className="brand text-2xl">Opportunities</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">{total.toLocaleString()} matching</p>
        </div>

        {error ? (
          <p className="px-5 py-6 text-[var(--signal)]">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-[var(--muted)]">
            {booting
              ? "Loading Georgia county feeds…"
              : "No opportunities match these filters. Enable counties and run a scan."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/50 text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">County</th>
                  <th className="px-4 py-3 font-semibold">Parcel</th>
                  <th className="px-4 py-3 font-semibold">Owner / Address</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Sale / Years</th>
                  <th className="px-4 py-3 font-semibold">Watch</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--line)] align-top">
                    <td className="px-4 py-3 capitalize">
                      <div className="font-medium">{row.county}</div>
                      <div className="text-xs text-[var(--muted)]">{row.list_type}</div>
                      {row.is_new ? (
                        <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          new
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs sm:text-sm">
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-[var(--line)] underline-offset-2 hover:decoration-[var(--accent)]"
                      >
                        {row.parcel_id}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.owner_name || "—"}</div>
                      <div className="text-[var(--muted)]">{row.property_address || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{money(row.amount_due)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      <div>{row.sale_date || "—"}</div>
                      <div className="text-xs">{row.tax_years || row.source_label}</div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleWatch(row)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          row.watched
                            ? "bg-[var(--ink)] text-white"
                            : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
                        }`}
                      >
                        {row.watched ? "Watching" : "Watch"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="fade-up mt-8 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        <p>{status?.georgiaNote}</p>
        <p className="mt-3">
          Daily automation: enable the counties you care about, then hit{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5">GET /api/cron</code> with{" "}
          <code className="rounded bg-white/70 px-1.5 py-0.5">
            Authorization: Bearer $CRON_SECRET
          </code>
          . The dashboard also auto-scans when the last successful run is older than 20 hours.
        </p>
        <p className="mt-3">
          Always verify parcel status, opening bid, title issues, and sale terms on the official
          county source before paying or bidding. This is research software, not legal or investment
          advice.
        </p>
      </footer>
    </main>
  );
}
