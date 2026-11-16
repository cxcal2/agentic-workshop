const UA =
  "Mozilla/5.0 (compatible; MetroTaxScan/1.0; +https://cursor.com; research bot for public tax-sale notices)";

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/pdf,*/*",
      ...(init.headers ?? {}),
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

export async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "application/pdf,*/*",
    },
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.arrayBuffer();
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  // Import the implementation file directly — the package root runs a debug
  // harness when module.parent is unset under some ESM loaders.
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (mod.default ?? mod) as (
    data: Buffer,
  ) => Promise<{ text: string; numpages: number }>;
  const data = await pdfParse(Buffer.from(buffer));
  return data.text ?? "";
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function normalizeParcel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function absoluteUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}