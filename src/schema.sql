create table public.manga_chapters (
  id serial not null,
  chapter_number integer not null,
  total_pages integer not null,
  processed_at timestamp with time zone null default CURRENT_TIMESTAMP,
  status text null default 'pending'::text,
  errormessage text null,
  constraint manga_chapters_pkey primary key (id),
  constraint manga_chapters_chapter_number_key unique (chapter_number),
  constraint chapter_number_positive check ((chapter_number > 0))
) TABLESPACE pg_default;

create index IF not exists idx_manga_chapters_status on public.manga_chapters using btree (status) TABLESPACE pg_default;


create table public.manga_page_classifications (
  id serial not null,
  chapter_id integer not null,
  page_number integer not null,
  filename text not null,
  category public.manga_page_category not null,
  confidence numeric(3, 2) null,
  explanation text null,
  constraint manga_page_classifications_pkey primary key (id),
  constraint manga_page_classifications_chapter_id_page_number_key unique (chapter_id, page_number),
  constraint manga_page_classifications_chapter_id_fkey foreign KEY (chapter_id) references manga_chapters (id) on delete CASCADE,
  constraint confidence_range check (
    (
      (confidence is null)
      or (
        (confidence >= (0)::numeric)
        and (confidence <= (1)::numeric)
      )
    )
  ),
  constraint page_number_positive check ((page_number > 0))
) TABLESPACE pg_default;

create index IF not exists idx_page_classifications_chapter_id on public.manga_page_classifications using btree (chapter_id) TABLESPACE pg_default;

create index IF not exists idx_page_classifications_category on public.manga_page_classifications using btree (category) TABLESPACE pg_default;

create view public.manga_chapter_summary as
select
  c.id,
  c.chapter_number,
  c.total_pages,
  c.processed_at,
  count(p.id) filter (
    where
      p.category = 'intro'::manga_page_category
  ) as intro_count,
  count(p.id) filter (
    where
      p.category = 'love'::manga_page_category
  ) as love_count,
  count(p.id) filter (
    where
      p.category = 'love_ran'::manga_page_category
  ) as love_ran_count,
  count(p.id) filter (
    where
      p.category = 'casual'::manga_page_category
  ) as casual_count,
  count(p.id) filter (
    where
      p.category = 'adventure'::manga_page_category
  ) as adventure_count,
  count(p.id) filter (
    where
      p.category = 'comedy'::manga_page_category
  ) as comedy_count,
  count(p.id) filter (
    where
      p.category = 'action_casual'::manga_page_category
  ) as action_casual_count,
  count(p.id) filter (
    where
      p.category = 'action_serious'::manga_page_category
  ) as action_serious_count,
  count(p.id) filter (
    where
      p.category = 'tragic'::manga_page_category
  ) as tragic_count,
  count(p.id) filter (
    where
      p.category = 'tension'::manga_page_category
  ) as tension_count,
  count(p.id) filter (
    where
      p.category = 'confrontation'::manga_page_category
  ) as confrontation_count,
  count(p.id) filter (
    where
      p.category = 'investigation'::manga_page_category
  ) as investigation_count,
  count(p.id) filter (
    where
      p.category = 'revelation'::manga_page_category
  ) as revelation_count,
  count(p.id) filter (
    where
      p.category = 'conclusion'::manga_page_category
  ) as conclusion_count,
  array_agg(
    distinct p.category
    order by
      p.category
  ) as categories
from
  manga_chapters c
  left join manga_page_classifications p on c.id = p.chapter_id
group by
  c.id,
  c.chapter_number,
  c.total_pages,
  c.processed_at;