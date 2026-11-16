import {
  GEORGIA_COUNTY_BY_ID,
  METRO_ATLANTA_IDS,
  type GeorgiaCounty,
} from "./georgia/counties";

export type CountyId = string;

export type ListType = "tax_sale" | "delinquent" | "sale_notice";

export type RawOpportunity = {
  county: CountyId;
  parcelId: string;
  ownerName?: string;
  propertyAddress?: string;
  amountDue?: number | null;
  taxYears?: string;
  saleDate?: string | null;
  listType: ListType;
  sourceUrl: string;
  sourceLabel: string;
  notes?: string;
};

export type CountyCollectResult = {
  county: CountyId;
  status: "ok" | "empty" | "error" | "sample" | "skipped";
  sourceUrl: string;
  message: string;
  opportunities: RawOpportunity[];
};

export type OpportunityRow = {
  id: number;
  county: string;
  parcel_id: string;
  owner_name: string;
  property_address: string;
  amount_due: string | number | null;
  tax_years: string;
  sale_date: string | null;
  list_type: string;
  source_url: string;
  source_label: string;
  first_seen_at: string;
  last_seen_at: string;
  is_new: boolean;
  is_active: boolean;
  notes: string;
  watched?: boolean;
};

/** @deprecated Prefer GEORGIA_COUNTY_BY_ID — kept for Metro Atlanta chip labels. */
export const COUNTY_META: Record<
  string,
  { label: string; short: string; officialHome: string }
> = Object.fromEntries(
  METRO_ATLANTA_IDS.map((id) => {
    const c = GEORGIA_COUNTY_BY_ID[id] as GeorgiaCounty;
    return [
      id,
      {
        label: c.label,
        short: c.name,
        officialHome: c.scanUrls[0] || c.taxOfficeUrl,
      },
    ];
  }),
);
