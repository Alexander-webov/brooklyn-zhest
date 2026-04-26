-- ============================================================================
-- Brooklyn Watch — fix #4: cleanup dupes, tighten RSS filters
-- ============================================================================

-- 1. Remove duplicate sources (keep the oldest of each URL)
delete from sources s
using sources s2
where s.channel_id = s2.channel_id
  and s.url = s2.url
  and s.created_at > s2.created_at;

-- 2. Tighten Gothamist filter — was way too broad, dragging in politics
update sources
set config = jsonb_build_object(
  'borough_filter', 'brooklyn',
  'keyword_filter', array[
    'shooting','stabbing','robbery','arrest','assault','murder','attack','crime',
    'crash','fire','missing','suspect','police','nypd','shot','stabbed','robbed',
    'mugged','dead','killed','victim','wounded','injured','fatal','homicide',
    'shooting','burglary','theft','carjacking','officer','collision','crashed',
    'overdose','arrested','charged','accused','sentenced','convicted','indicted'
  ],
  'exclude_keywords', array[
    'concert','festival','exhibition','art show','gallery','restaurant opens',
    'opening of','politician','campaign','election','endorses','approval rating',
    'speech','debate','town hall','community meeting','recipe','review of'
  ]
)
where name = 'Gothamist — Brooklyn';

-- 3. Same for NY Post Metro
update sources
set config = jsonb_build_object(
  'borough_filter', 'brooklyn',
  'keyword_filter', array[
    'shooting','stabbing','robbery','arrest','assault','murder','attack','crime',
    'crash','fire','missing','suspect','police','nypd','shot','stabbed','robbed',
    'mugged','dead','killed','victim','wounded','injured','fatal','homicide',
    'burglary','theft','carjacking','officer','collision','crashed','overdose',
    'arrested','charged','accused','sentenced','convicted','indicted'
  ],
  'exclude_keywords', array[
    'concert','festival','exhibition','art show','gallery','politician',
    'campaign','election','endorses','approval rating','speech','debate',
    'town hall','community meeting','recipe','restaurant opens'
  ]
)
where name in ('NY Post — Metro', 'NY Post Metro');

-- 4. Brooklyn Paper and Bklyner are already Brooklyn-specific, just exclude obvious noise
update sources
set config = jsonb_build_object(
  'exclude_keywords', array[
    'concert','festival','exhibition','art show','gallery','restaurant opens',
    'opening of','recipe','review of','best of','top 10','guide to','where to eat',
    'where to drink','event listing','events this week','calendar'
  ]
)
where name in ('Brooklyn Paper', 'Bklyner', 'amNewYork — Brooklyn');

-- 5. Quick sanity check — show what's left
-- (Run this separately if you want to inspect)
-- select name, type, is_enabled, frequency_minutes, config from sources order by name;
