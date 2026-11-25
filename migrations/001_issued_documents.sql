create table if not exists issued_documents (
  sceau text primary key,
  number text not null unique,
  fingerprint text not null,
  payload text not null,
  created_at timestamptz not null default now()
);
