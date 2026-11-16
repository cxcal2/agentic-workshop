create table if not exists scan_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  trigger_source text not null default 'manual',
  notes text not null default '',
  using_sample_data boolean not null default false
);

create table if not exists county_scan_results (
  id bigserial primary key,
  scan_run_id bigint not null references scan_runs(id) on delete cascade,
  county text not null,
  status text not null,
  opportunity_count integer not null default 0,
  source_url text not null default '',
  message text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id bigserial primary key,
  county text not null,
  parcel_id text not null,
  owner_name text not null default '',
  property_address text not null default '',
  amount_due numeric(14, 2),
  tax_years text not null default '',
  sale_date date,
  list_type text not null default 'delinquent',
  source_url text not null default '',
  source_label text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_scan_run_id bigint references scan_runs(id) on delete set null,
  is_new boolean not null default true,
  is_active boolean not null default true,
  notes text not null default '',
  unique (county, parcel_id, list_type)
);

create index if not exists opportunities_county_idx on opportunities (county);
create index if not exists opportunities_amount_idx on opportunities (amount_due desc nulls last);
create index if not exists opportunities_active_idx on opportunities (is_active, last_seen_at desc);
create index if not exists opportunities_new_idx on opportunities (is_new, last_seen_at desc);

create table if not exists watchlist (
  id bigserial primary key,
  opportunity_id bigint not null unique references opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text not null default ''
);
