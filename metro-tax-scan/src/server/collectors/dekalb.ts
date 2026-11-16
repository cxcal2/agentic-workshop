import * as cheerio from "cheerio";
import type { CountyCollectResult, RawOpportunity } from "../types";
import { fetchText, normalizeParcel, parseMoney } from "./shared";

const SOURCE =
  "https://publicaccess.dekalbtaxga.gov/forms/htmlframe.aspx?mode=content/search/tax_sale_listing.html";

function parseSaleDate(raw: string): string | null {
  // e.g. 01-DEC-2026
  const m = raw.trim().match(/^(\d{2})-([A-Z]{3})-(\d{4})$/i);
  if (!m) return null;
  const months: Record<string, string> = {
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  };
  const month = months[m[2].toUpperCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1]}`;
}

export async function collectDekalb(): Promise<CountyCollectResult> {
  try {
    const html = await fetchText(SOURCE);
    const $ = cheerio.load(html);
    const opportunities: RawOpportunity[] = [];

    $("table tr").each((_, row) => {
      const cells = $(row)
        .find("td")
        .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get();
      if (cells.length < 15) return;
      if (!/^\d{2}-[A-Z]{3}-\d{4}$/i.test(cells[0])) return;

      const parcelId = normalizeParcel(cells[1]);
      if (!parcelId) return;

      opportunities.push({
        county: "dekalb",
        parcelId,
        ownerName: cells[4] || "",
        propertyAddress: cells[5] || "",
        amountDue: parseMoney(cells[14] || ""),
        taxYears:
          cells[12] && cells[13] && cells[12] !== cells[13]
            ? `${cells[12]}-${cells[13]}`
            : cells[12] || cells[13] || "",
        saleDate: parseSaleDate(cells[0]),
        listType: "tax_sale",
        sourceUrl: SOURCE,
        sourceLabel: "DeKalb Tax Commissioner tax sale listing",
      });
    });

    if (opportunities.length === 0) {
      return {
        county: "dekalb",
        status: "empty",
        sourceUrl: SOURCE,
        message: "No tax-sale parcels found on the DeKalb listing page.",
        opportunities: [],
      };
    }

    return {
      county: "dekalb",
      status: "ok",
      sourceUrl: SOURCE,
      message: `Loaded ${opportunities.length} DeKalb tax-sale parcels.`,
      opportunities,
    };
  } catch (error) {
    return {
      county: "dekalb",
      status: "error",
      sourceUrl: SOURCE,
      message: error instanceof Error ? error.message : "DeKalb collect failed",
      opportunities: [],
    };
  }
}
