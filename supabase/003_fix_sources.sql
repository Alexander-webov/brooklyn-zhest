-- ============================================================================
-- Brooklyn Watch — fix sources (003)
-- Run this in Supabase SQL Editor.
-- ============================================================================

-- 1. Allow new source types in the check constraint
alter table sources drop constraint if exists sources_type_check;
alter table sources add  constraint sources_type_check
  check (type in ('rss','reddit','nitter','scraper','custom','nypd_html','citizen'));

-- 2. Clean out the broken/weak sources we created earlier
delete from sources
where name in (
  'NYPD News',
  'NotifyNYC',
  'r/Brooklyn',
  'r/nyc — Brooklyn',
  'Patch — Brighton'
);

-- 3. Add the proper sources
do $$
declare ch uuid;
begin
  select id into ch from channels where slug = 'brooklyn-watch';
  if ch is null then
    raise exception 'Channel "brooklyn-watch" not found — run 001/002 migrations first';
  end if;

  insert into sources (channel_id, type, name, url, frequency_minutes, is_enabled, config) values

    -- ============ TIER 1: real-time-ish, high signal ============
    -- Citizen public endpoint — same data as the app, in JSON. Best signal we can get without scanners.
    (ch, 'citizen',  'Citizen — Brooklyn',
        'https://citizen.com/api/incident/trending?lowerLatitude=40.5520&upperLatitude=40.7395&lowerLongitude=-74.0560&upperLongitude=-73.8330&fullResponse=true&limit=80',
        15, true, '{}'::jsonb),

    -- r/NYCScanner — reddit equivalent of police scanner notes
    (ch, 'reddit', 'r/NYCScanner',
        'https://www.reddit.com/r/NYCScanner/new/.json',
        15, true,
        '{"keyword_filter":["brooklyn","brighton","bensonhurst","bay ridge","bed-stuy","bedford","williamsburg","park slope","sunset park","crown heights","flatbush","bushwick","midwood","sheepshead","greenpoint","gowanus","red hook","canarsie","east new york","coney island","dyker","borough park","carroll gardens","prospect heights","clinton hill","fort greene","downtown brooklyn"]}'::jsonb),

    -- ============ TIER 2: official, slower ============
    (ch, 'nypd_html', 'NYPD News (HTML)',
        'https://www.nyc.gov/site/nypd/news/news.page',
        45, true, '{"borough_filter":"Brooklyn"}'::jsonb),

    -- ============ TIER 3: news outlets, hours-old but real ============
    (ch, 'rss', 'Brooklyn Paper',
        'https://www.brooklynpaper.com/feed/',
        60, true, '{}'::jsonb),

    (ch, 'rss', 'amNewYork — Brooklyn',
        'https://www.amny.com/category/brooklyn/feed/',
        60, true, '{}'::jsonb),

    -- NY1 doesn't expose RSS reliably; skipping. Add manually if needed.
    (ch, 'rss', 'NY Post — Metro',
        'https://nypost.com/metro/feed/',
        90, true, '{"borough_filter":"brooklyn"}'::jsonb),

    -- ============ TIER 4: local subreddits as backup ============
    (ch, 'reddit', 'r/Brooklyn (filtered)',
        'https://www.reddit.com/r/Brooklyn/new/.json',
        30, true,
        '{"min_score":15,"keyword_filter":["shooting","stabbing","robbery","assault","arrest","fire","crash","police","nypd","murder","attack","missing","shot","shooter","robbed","mugged","stabbed","officer"]}'::jsonb)

  on conflict do nothing;
end $$;

-- 4. Trim the LLM stop-list so we don't accidentally throw out real news
delete from filters
where channel_id = (select id from channels where slug = 'brooklyn-watch')
  and value in ('press release archive','recruitment','job fair','precinct community council');
