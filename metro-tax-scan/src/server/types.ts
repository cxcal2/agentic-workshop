export type CountyId = "fulton" | "henry" | "cobb" | "dekalb";

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
  status: "ok" | "empty" | "error" | "sample";
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

export const COUNTY_META: Record<
  CountyId,
  { label: string; short: string; officialHome: string }
> = {
  fulton: {
    label: "Fulton County",
    short: "Fulton",
    officialHome:
      "https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/tax-sales",
  },
  henry: {
    label: "Henry County",
    short: "Henry",
    officialHome: "https://www.henrycountytax.com/172/Property-for-Tax-Sale",
  },
  cobb: {
    label: "Cobb County",
    short: "Cobb",
    officialHome: "https://www.cobbtax.gov/property/delinquent_taxes/index.php",
  },
  dekalb: {
    label: "DeKalb County",
    short: "DeKalb",
    officialHome:
      "https://publicaccess.dekalbtaxga.gov/forms/htmlframe.aspx?mode=content/search/tax_sale_listing.html",
  },
};
