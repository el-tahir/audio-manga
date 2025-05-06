create table public.manga_chapters (
  chapter_number integer not null,
  status text not null default 'pending'::text,
  total_pages integer not null default 0,
  processed_at timestamp with time zone null,
  error_message text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint manga_chapters_pkey primary key (chapter_number)
) TABLESPACE pg_default;

create index IF not exists idx_manga_chapters_status on public.manga_chapters using btree (status) TABLESPACE pg_default;

create table public.manga_page_classifications (
  chapter_number integer not null,
  page_number integer not null,
  filename text not null,
  category public.mood_category_enum not null,
  explanation text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint manga_page_classifications_pkey primary key (chapter_number, page_number),
  constraint manga_page_classifications_chapter_number_fkey foreign KEY (chapter_number) references manga_chapters (chapter_number) on delete CASCADE
) TABLESPACE pg_default;