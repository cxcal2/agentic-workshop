import type { CountyCollectResult } from "./types";

/** Used only when live county fetches fail, so the dashboard still demos. */
export const SAMPLE_RESULTS: CountyCollectResult[] = [
  {
    county: "dekalb",
    status: "sample",
    sourceUrl:
      "https://publicaccess.dekalbtaxga.gov/forms/htmlframe.aspx?mode=content/search/tax_sale_listing.html",
    message: "Sample DeKalb rows (live fetch unavailable).",
    opportunities: [
      {
        county: "dekalb",
        parcelId: "15 055 01 006",
        ownerName: "NEW BEGINNING INVESTMENT PC",
        propertyAddress: "2640 RIVER RD",
        amountDue: 4783.53,
        taxYears: "2025",
        saleDate: "2026-12-01",
        listType: "tax_sale",
        sourceUrl:
          "https://publicaccess.dekalbtaxga.gov/forms/htmlframe.aspx?mode=content/search/tax_sale_listing.html",
        sourceLabel: "Sample — DeKalb tax sale listing",
      },
      {
        county: "dekalb",
        parcelId: "15 151 02 002",
        ownerName: "RINGFIELD ZARANESHA",
        propertyAddress: "2202 GREYSTONE WAY",
        amountDue: 11076.32,
        taxYears: "2024-2025",
        saleDate: "2026-12-01",
        listType: "tax_sale",
        sourceUrl:
          "https://publicaccess.dekalbtaxga.gov/forms/htmlframe.aspx?mode=content/search/tax_sale_listing.html",
        sourceLabel: "Sample — DeKalb tax sale listing",
      },
    ],
  },
  {
    county: "cobb",
    status: "sample",
    sourceUrl: "https://www.cobbtax.gov/property/delinquent_taxes/index.php",
    message: "Sample Cobb rows (live fetch unavailable).",
    opportunities: [
      {
        county: "cobb",
        parcelId: "01000200250",
        ownerName: "STEINBRINK DAVID & MARIA NOVOA",
        propertyAddress: "549 RIVERCLIFF TRCE",
        amountDue: 28022.95,
        taxYears: "2026",
        listType: "delinquent",
        sourceUrl: "https://www.cobbtax.gov/property/delinquent_taxes/index.php",
        sourceLabel: "Sample — Cobb delinquent list",
      },
      {
        county: "cobb",
        parcelId: "01000200030",
        ownerName: "PATEL NITIN & PATEL PUJA",
        propertyAddress: "720 CLUB LN",
        amountDue: 18614.36,
        taxYears: "2026",
        listType: "delinquent",
        sourceUrl: "https://www.cobbtax.gov/property/delinquent_taxes/index.php",
        sourceLabel: "Sample — Cobb delinquent list",
      },
    ],
  },
  {
    county: "fulton",
    status: "sample",
    sourceUrl:
      "https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/tax-sales",
    message: "Sample Fulton sale notice (live fetch unavailable).",
    opportunities: [
      {
        county: "fulton",
        parcelId: "14-0008-LL-023-6",
        ownerName: "See official sale list",
        propertyAddress: "1600 THOMASVILLE BLVD SE",
        amountDue: null,
        saleDate: "2026-12-01",
        listType: "tax_sale",
        sourceUrl:
          "https://www.fultoncountyga.gov/-/media/Departments/Sheriff/Tax-Sales/2026/Sheriffs-December-1-2026-Tax--Levy-Sale-List--1st-Posting-1162026.pdf",
        sourceLabel: "Sample — Fulton Sheriff sale list",
      },
    ],
  },
  {
    county: "henry",
    status: "sample",
    sourceUrl: "https://www.henrycountytax.com/172/Property-for-Tax-Sale",
    message: "Sample Henry empty state (no November sale).",
    opportunities: [],
  },
];
