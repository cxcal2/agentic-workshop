import type { CountyCollectResult, RawOpportunity } from "../types";
import {
  absoluteUrl,
  extractPdfText,
  fetchBuffer,
  fetchText,
  normalizeParcel,
  parseMoney,
} from "./shared";

const INDEX = "https://www.henrycountytax.com/172/Property-for-Tax-Sale";
const FALLBACK_PDF = "https://www.henrycountytax.com/DocumentCenter/View/553";

function findHenryPdf(html: string): string {
  const match =
    html.match(/href="(\/DocumentCenter\/View\/\d+\/[^"]*Tax[^"]*)"/i) ||
    html.match(/href="(\/DocumentCenter\/View\/\d+)"/i);
  if (match?.[1]) return absoluteUrl(INDEX, match[1]);
  return FALLBACK_PDF;
}

function parseHenryRows(text: string, sourceUrl: string): RawOpportunity[] {
  if (/NO PROPERTY TAX/i.test(text) || /CHECK BACK LATER/i.test(text)) {
    return [];
  }

  const opportunities: RawOpportunity[] = [];
  const lineRe =
    /([A0-9][0-9A-Z-]{5,})\s+([A-Z0-9 &.,#'/-]{3,}?)\s+(\d{1,5}\s+[A-Z0-9 .#'/-]+)\s+\$?\s*([\d,]+\.\d{2})/gi;
  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text)) !== null) {
    opportunities.push({
      county: "henry",
      parcelId: normalizeParcel(match[1]),
      ownerName: match[2].replace(/\s+/g, " ").trim(),
      propertyAddress: match[3].replace(/\s+/g, " ").trim(),
      amountDue: parseMoney(match[4]),
      listType: "tax_sale",
      sourceUrl,
      sourceLabel: "Henry County tax sale list",
    });
  }
  return opportunities;
}

export async function collectHenry(): Promise<CountyCollectResult> {
  try {
    const html = await fetchText(INDEX);
    const pdfUrl = findHenryPdf(html);
    const buffer = await fetchBuffer(pdfUrl);
    const text = await extractPdfText(buffer);

    if (/NO PROPERTY TAX/i.test(text) || /CHECK BACK LATER/i.test(text)) {
      return {
        county: "henry",
        status: "empty",
        sourceUrl: pdfUrl,
        message: text.replace(/\s+/g, " ").trim().slice(0, 240),
        opportunities: [],
      };
    }

    const opportunities = parseHenryRows(text, pdfUrl);
    if (opportunities.length === 0) {
      return {
        county: "henry",
        status: "empty",
        sourceUrl: pdfUrl,
        message:
          "Henry tax-sale PDF has no parseable parcels right now. Check the official list.",
        opportunities: [],
      };
    }

    return {
      county: "henry",
      status: "ok",
      sourceUrl: pdfUrl,
      message: `Loaded ${opportunities.length} Henry tax-sale parcels.`,
      opportunities,
    };
  } catch (error) {
    return {
      county: "henry",
      status: "error",
      sourceUrl: INDEX,
      message: error instanceof Error ? error.message : "Henry collect failed",
      opportunities: [],
    };
  }
}
