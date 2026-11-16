import type { CountyCollectResult, RawOpportunity } from "../types";
import {
  absoluteUrl,
  extractPdfText,
  fetchBuffer,
  fetchText,
  normalizeParcel,
  parseMoney,
} from "./shared";

const INDEX = "https://www.cobbtax.gov/property/delinquent_taxes/index.php";
const CMS_ROOT = "https://cms9files.revize.com/cobbcounty/";

type Agg = {
  parcelId: string;
  ownerName: string;
  propertyAddress: string;
  amountDue: number;
  years: Set<string>;
};

function resolveCobbPdfUrl(href: string): string {
  const abs = absoluteUrl(INDEX, href.split("?")[0]);
  // Revize often redirects relative PDFs to cms9files at the county root.
  const fileName = decodeURIComponent(abs.split("/").pop() || "");
  if (/delinquent tax list/i.test(fileName)) {
    return `${CMS_ROOT}${encodeURIComponent(fileName).replace(/%20/g, "%20")}`;
  }
  return abs;
}

function findPdfHref(html: string): string | null {
  const patterns = [
    /href=\s*"([^"]*Delinquent[^"]*Tax[^"]*List[^"]*\.pdf[^"]*)"/i,
    /href=\s*'([^']*Delinquent[^']*Tax[^']*List[^']*\.pdf[^']*)'/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

function parseDelinquentRows(text: string): Agg[] {
  const map = new Map<string, Agg>();
  const lineRe =
    /^(\d{11})\s+(.+?)\s{2,}(.+?)\s+\$?\s*([\d,]+\.\d{2})\s+(\d{4})\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text)) !== null) {
    const parcelId = normalizeParcel(match[1]);
    const ownerName = match[2].replace(/\s+/g, " ").trim();
    const propertyAddress = match[3].replace(/\s+/g, " ").trim();
    const amount = parseMoney(match[4]) ?? 0;
    const year = match[5];
    const existing = map.get(parcelId);
    if (existing) {
      existing.amountDue += amount;
      existing.years.add(year);
      if (!existing.ownerName && ownerName) existing.ownerName = ownerName;
      if (!existing.propertyAddress && propertyAddress) {
        existing.propertyAddress = propertyAddress;
      }
    } else {
      map.set(parcelId, {
        parcelId,
        ownerName,
        propertyAddress,
        amountDue: amount,
        years: new Set([year]),
      });
    }
  }

  // Fallback when layout spaces collapse (pdf-parse without pdftotext).
  if (map.size === 0) {
    const compactRe =
      /(\d{11})([A-Z0-9 &.,#'/-]+?)(\d{1,5}\s+[A-Z0-9 .#'/-]+?)\$([\d,]+\.\d{2})(20\d{2})/g;
    while ((match = compactRe.exec(text)) !== null) {
      const parcelId = normalizeParcel(match[1]);
      const ownerName = match[2].replace(/\s+/g, " ").trim();
      const propertyAddress = match[3].replace(/\s+/g, " ").trim();
      const amount = parseMoney(match[4]) ?? 0;
      const year = match[5];
      const existing = map.get(parcelId);
      if (existing) {
        existing.amountDue += amount;
        existing.years.add(year);
      } else {
        map.set(parcelId, {
          parcelId,
          ownerName,
          propertyAddress,
          amountDue: amount,
          years: new Set([year]),
        });
      }
    }
  }

  return [...map.values()];
}

export async function collectCobb(): Promise<CountyCollectResult> {
  try {
    const html = await fetchText(INDEX);
    const href = findPdfHref(html);
    if (!href) {
      return {
        county: "cobb",
        status: "error",
        sourceUrl: INDEX,
        message: "Could not locate the current Cobb delinquent tax list PDF.",
        opportunities: [],
      };
    }

    const pdfUrl = resolveCobbPdfUrl(href);
    let buffer: ArrayBuffer;
    try {
      buffer = await fetchBuffer(pdfUrl);
    } catch {
      // Fall back to the page-relative URL (may redirect correctly via fetch).
      buffer = await fetchBuffer(absoluteUrl(INDEX, href.split("?")[0]));
    }

    const text = await extractPdfText(buffer);
    const rows = parseDelinquentRows(text);
    const ranked = rows
      .map((row) => ({
        county: "cobb" as const,
        parcelId: row.parcelId,
        ownerName: row.ownerName,
        propertyAddress: row.propertyAddress,
        amountDue: Math.round(row.amountDue * 100) / 100,
        taxYears: [...row.years].sort().join(", "),
        saleDate: null,
        listType: "delinquent" as const,
        sourceUrl: pdfUrl,
        sourceLabel: "Cobb County delinquent tax list (monthly)",
        notes:
          "Cobb publishes a full delinquent list. Ranked by unpaid balance; verify on the official PDF before outreach.",
      }))
      .sort((a, b) => (b.amountDue ?? 0) - (a.amountDue ?? 0));

    const total = ranked.length;
    const opportunities: RawOpportunity[] = ranked.slice(0, 1000);

    if (opportunities.length === 0) {
      return {
        county: "cobb",
        status: "empty",
        sourceUrl: pdfUrl,
        message:
          "Cobb PDF downloaded but no parcel rows could be parsed. Open the source PDF.",
        opportunities: [],
      };
    }

    return {
      county: "cobb",
      status: "ok",
      sourceUrl: pdfUrl,
      message: `Parsed ${total} Cobb delinquent parcels; storing top ${opportunities.length} by amount due.`,
      opportunities,
    };
  } catch (error) {
    return {
      county: "cobb",
      status: "error",
      sourceUrl: INDEX,
      message: error instanceof Error ? error.message : "Cobb collect failed",
      opportunities: [],
    };
  }
}
