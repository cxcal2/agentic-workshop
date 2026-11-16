import * as cheerio from "cheerio";
import type { GeorgiaCounty } from "../georgia/counties";
import type { CountyCollectResult, RawOpportunity } from "../types";
import {
  absoluteUrl,
  extractPdfText,
  fetchBuffer,
  fetchText,
  normalizeParcel,
  parseMoney,
} from "./shared";

const GOOD_RE = /tax[\s_-]*sale|delinquent|levy\s+sale|sheriff.?s?\s+(tax|levy)|unpaid\s+tax|tax\s+deed|sale\s+list/i;
const BAD_RE =
  /homestead|brochure|kiosk|privacy|facebook|twitter|instagram|linkedin|youtube|excess.?funds.?request|pay\s+online|search.?pay|invoice|tag\s+office|motor\s+vehicle|sitemap|login|manifest\/client|wp-content\/plugins|jquery|gtag|analytics/i;

function scoreLink(href: string, label: string): number {
  const blob = `${href} ${label}`;
  if (BAD_RE.test(blob)) return -100;
  if (label.length > 180) return -50;
  let score = 0;
  if (GOOD_RE.test(blob)) score += 5;
  if (/\.pdf($|\?)/i.test(href) || /DocumentCenter\/View/i.test(href)) score += 3;
  if (/tax.?sale|delinquent/i.test(href)) score += 4;
  if (/tax.?sale|delinquent|levy/i.test(label)) score += 4;
  return score;
}

function discoverLinks(html: string, baseUrl: string): { href: string; label: string; score: number }[] {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const found: { href: string; label: string; score: number }[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, el) => {
    const rawHref = ($(el).attr("href") || "").replace(/&amp;/g, "&").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) return;
    const label = $(el).text().replace(/\s+/g, " ").trim() || rawHref.split("/").pop() || "Listing";
    const href = absoluteUrl(baseUrl, rawHref.split("#")[0]);
    if (seen.has(href)) return;
    const score = scoreLink(href, label);
    if (score < 3) return;
    seen.add(href);
    found.push({ href, label: label.slice(0, 120), score });
  });

  return found.sort((a, b) => b.score - a.score).slice(0, 10);
}

function parseParcelRows(
  text: string,
  countyId: string,
  sourceUrl: string,
  sourceLabel: string,
): RawOpportunity[] {
  const opportunities: RawOpportunity[] = [];
  const seen = new Set<string>();

  const lineRe =
    /([A-Z0-9][A-Z0-9\s-]{4,24})\s+([A-Z][A-Z0-9 &.,#'/-]{2,}?)\s+(\d{1,5}\s+[A-Z0-9 .#'/-]{3,})\s+\$?\s*([\d,]+\.\d{2})/gim;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text)) !== null) {
    const parcelId = normalizeParcel(match[1]);
    if (parcelId.length < 5 || seen.has(parcelId)) continue;
    if (/NOTICE-|SALE-/i.test(parcelId)) continue;
    seen.add(parcelId);
    opportunities.push({
      county: countyId,
      parcelId,
      ownerName: match[2].replace(/\s+/g, " ").trim(),
      propertyAddress: match[3].replace(/\s+/g, " ").trim(),
      amountDue: parseMoney(match[4]),
      listType: /delinquent/i.test(sourceLabel) ? "delinquent" : "tax_sale",
      sourceUrl,
      sourceLabel,
    });
    if (opportunities.length >= 500) break;
  }

  if (opportunities.length === 0) {
    const moneyRe =
      /([0-9]{2,}[\s-][0-9A-Z\s-]{4,}|[0-9]{8,14})[^$\n]{0,80}\$([\d,]+\.\d{2})/gi;
    while ((match = moneyRe.exec(text)) !== null) {
      const parcelId = normalizeParcel(match[1]);
      if (parcelId.length < 5 || seen.has(parcelId)) continue;
      seen.add(parcelId);
      opportunities.push({
        county: countyId,
        parcelId,
        amountDue: parseMoney(match[2]),
        listType: "tax_sale",
        sourceUrl,
        sourceLabel,
      });
      if (opportunities.length >= 500) break;
    }
  }

  return opportunities;
}

async function harvestUrl(
  county: GeorgiaCounty,
  url: string,
  depth = 0,
): Promise<{ opportunities: RawOpportunity[]; notes: string[] }> {
  const notes: string[] = [];
  const opportunities: RawOpportunity[] = [];

  const lower = url.toLowerCase();
  if (lower.endsWith(".pdf") || lower.includes(".pdf?") || /DocumentCenter\/View/i.test(url)) {
    try {
      const buffer = await fetchBuffer(url);
      // HTML error pages sometimes returned for DocumentCenter
      const head = Buffer.from(buffer.slice(0, 20)).toString("utf8");
      if (head.includes("<!DOCTYPE") || head.includes("<html")) {
        notes.push(`Expected PDF but got HTML for ${url}`);
        return { opportunities, notes };
      }
      const text = await extractPdfText(buffer);
      if (/no property tax|no tax sale|cancelled|check back later|there are no/i.test(text)) {
        notes.push(`PDF reports no current sale: ${url}`);
        return { opportunities, notes };
      }
      const rows = parseParcelRows(text, county.id, url, `${county.name} tax list PDF`);
      if (rows.length) {
        opportunities.push(...rows);
      } else if (text.trim().length < 40) {
        opportunities.push({
          county: county.id,
          parcelId: `SALE-${county.id.toUpperCase()}`,
          ownerName: "See official PDF",
          propertyAddress: `${county.label} tax sale / delinquent list`,
          amountDue: null,
          listType: "sale_notice",
          sourceUrl: url,
          sourceLabel: `${county.name} listing PDF`,
          notes: "Scanned or unstructured PDF — open source for parcel detail.",
        });
        notes.push("PDF had little extractable text; stored sale notice.");
      } else {
        notes.push(`PDF downloaded but no parcel rows parsed: ${url}`);
      }
    } catch (error) {
      notes.push(
        `PDF fetch failed (${error instanceof Error ? error.message : "error"}): ${url}`,
      );
    }
    return { opportunities, notes };
  }

  const html = await fetchText(url);
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const pageText = $("body").text().replace(/\s+/g, " ");
  const pageRows = parseParcelRows(pageText, county.id, url, `${county.name} tax page`);
  opportunities.push(...pageRows);

  const links = discoverLinks(html, url);
  notes.push(`Discovered ${links.length} candidate listing links on ${url}`);

  if (depth < 1) {
    for (const link of links.slice(0, 4)) {
      if (link.href === url) continue;
      if (/\.pdf($|\?)/i.test(link.href) || /DocumentCenter\/View/i.test(link.href)) {
        const nested = await harvestUrl(county, link.href, depth + 1);
        opportunities.push(...nested.opportunities);
        notes.push(...nested.notes);
      }
    }
  }

  if (opportunities.length === 0) {
    const best = links[0];
    const sourceUrl = best?.href || url;
    const sourceLabel =
      best && best.label.length < 80 && GOOD_RE.test(`${best.href} ${best.label}`)
        ? best.label
        : `${county.name} tax sale / delinquent page`;
    opportunities.push({
      county: county.id,
      parcelId: `NOTICE-${county.id.toUpperCase()}`,
      ownerName: "See county listing",
      propertyAddress: `${county.label} official tax listing`,
      amountDue: null,
      listType: "sale_notice",
      sourceUrl,
      sourceLabel,
      notes:
        "No parcel rows parsed automatically. Open the linked county page/PDF and verify before acting.",
    });
  }

  return { opportunities, notes };
}

export async function collectGenericCounty(
  county: GeorgiaCounty,
  scanUrls?: string[],
): Promise<CountyCollectResult> {
  const urls = (scanUrls && scanUrls.length ? scanUrls : county.scanUrls).filter(Boolean);
  if (urls.length === 0) {
    return {
      county: county.id,
      status: "skipped",
      sourceUrl: county.taxOfficeUrl || "",
      message:
        "No tax-office or tax-sale URL on file yet. Add a listing URL in County settings, then rescan.",
      opportunities: [],
    };
  }

  try {
    const all: RawOpportunity[] = [];
    const notes: string[] = [];
    for (const url of urls.slice(0, 3)) {
      const part = await harvestUrl(county, url);
      all.push(...part.opportunities);
      notes.push(...part.notes);
    }

    const dedup = new Map<string, RawOpportunity>();
    for (const opp of all) {
      dedup.set(`${opp.listType}:${opp.parcelId}`, opp);
    }
    const opportunities = [...dedup.values()];

    if (opportunities.length === 0) {
      return {
        county: county.id,
        status: "empty",
        sourceUrl: urls[0],
        message:
          notes.join(" ") ||
          `No parseable unpaid-tax opportunities found for ${county.label}.`,
        opportunities: [],
      };
    }

    return {
      county: county.id,
      status: "ok",
      sourceUrl: urls[0],
      message: `Loaded ${opportunities.length} items for ${county.label}. ${notes[0] || ""}`.trim(),
      opportunities,
    };
  } catch (error) {
    return {
      county: county.id,
      status: "error",
      sourceUrl: urls[0] || county.taxOfficeUrl,
      message: error instanceof Error ? error.message : "Generic collect failed",
      opportunities: [],
    };
  }
}
