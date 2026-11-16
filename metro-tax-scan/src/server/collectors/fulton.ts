import type { CountyCollectResult, RawOpportunity } from "../types";
import {
  absoluteUrl,
  extractPdfText,
  fetchBuffer,
  fetchText,
  normalizeParcel,
} from "./shared";

const INDEX =
  "https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/tax-sales";

function findSalePdfs(html: string): { href: string; label: string }[] {
  const results: { href: string; label: string }[] = [];
  const re =
    /href="([^"]*\/-\/media\/Departments\/Sheriff\/Tax-Sales\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = absoluteUrl(INDEX, match[1]);
    const label = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&rsquo;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (/excess funds/i.test(label) || /excess funds/i.test(href)) continue;
    results.push({ href, label: label || href.split("/").pop() || "Sale list" });
  }
  // Prefer newest first: URLs containing 2026 then by appearance.
  return results;
}

function parseFultonText(text: string, sourceUrl: string, label: string): RawOpportunity[] {
  const opportunities: RawOpportunity[] = [];
  // OCR/text patterns vary; catch parcel-like tokens + trailing address fragments.
  const re =
    /(\d{4}-\d{5})\s+([0-9A-Z]{2,3}[-\s][0-9A-Z]{4,}[-\s0-9A-Z]*)\s+([0-9A-Z].{5,80}?)(?=\s+\d{4}-\d{5}|\s*$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    opportunities.push({
      county: "fulton",
      parcelId: normalizeParcel(match[2]),
      ownerName: "",
      propertyAddress: match[3].replace(/\s+/g, " ").trim(),
      amountDue: null,
      saleDate: null,
      listType: "tax_sale",
      sourceUrl,
      sourceLabel: label,
      notes: `Sale id ${match[1]}. Fulton lists are often scanned PDFs; verify on the official posting.`,
    });
  }
  return opportunities;
}

function inferSaleDate(label: string, href: string): string | null {
  const blob = `${label} ${href}`;
  const m = blob.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(20\d{2})/i,
  );
  if (!m) return null;
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const month = months[m[1].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

export async function collectFulton(): Promise<CountyCollectResult> {
  try {
    const html = await fetchText(INDEX);
    const pdfs = findSalePdfs(html);
    if (pdfs.length === 0) {
      return {
        county: "fulton",
        status: "empty",
        sourceUrl: INDEX,
        message: "No Fulton Sheriff tax-sale PDFs found on the county page.",
        opportunities: [],
      };
    }

    // Use the first (usually current) sale list.
    const primary = pdfs[0];
    const buffer = await fetchBuffer(primary.href);
    const text = await extractPdfText(buffer);
    let opportunities = parseFultonText(text, primary.href, primary.label);
    const saleDate = inferSaleDate(primary.label, primary.href);

    if (opportunities.length === 0) {
      // Scanned PDF with no text layer: still surface a actionable notice row.
      opportunities = [
        {
          county: "fulton",
          parcelId: `SALE-${saleDate || "CURRENT"}`,
          ownerName: "See official sale list PDF",
          propertyAddress: "Fulton County Sheriff tax / levy sale",
          amountDue: null,
          saleDate,
          listType: "sale_notice",
          sourceUrl: primary.href,
          sourceLabel: primary.label,
          notes:
            "Fulton posts scanned PDFs. Open the source URL for parcel-level detail, then verify before bidding.",
        },
      ];
      return {
        county: "fulton",
        status: "ok",
        sourceUrl: primary.href,
        message: `Found sale list “${primary.label}” (scanned PDF — open source for parcels).`,
        opportunities,
      };
    }

    if (saleDate) {
      opportunities = opportunities.map((o) => ({ ...o, saleDate }));
    }

    return {
      county: "fulton",
      status: "ok",
      sourceUrl: primary.href,
      message: `Loaded ${opportunities.length} Fulton parcels from “${primary.label}”.`,
      opportunities,
    };
  } catch (error) {
    return {
      county: "fulton",
      status: "error",
      sourceUrl: INDEX,
      message: error instanceof Error ? error.message : "Fulton collect failed",
      opportunities: [],
    };
  }
}