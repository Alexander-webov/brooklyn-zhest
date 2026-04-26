-- ============================================================================
-- Brooklyn Watch — seed data
-- Run AFTER 001_initial_schema.sql
-- IMPORTANT: replace telegram_chat_id values with your real ones before running
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Channel: Brooklyn жесть
-- ----------------------------------------------------------------------------
insert into channels (slug, name, description, telegram_chat_id, telegram_test_chat_id, test_mode)
values (
  'brooklyn-watch',
  'Brooklyn жесть',
  'Новости и инциденты Бруклина в режиме реального времени, на русском языке',
  '@brooklyn_zhest_news',          -- public channel; works as long as bot is admin
  null,                             -- fill in later via admin UI: numeric id of your private test channel
  true                              -- start in test mode
)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Brooklyn neighborhoods with hashtags
-- ----------------------------------------------------------------------------
do $$
declare
  ch uuid;
begin
  select id into ch from channels where slug = 'brooklyn-watch';

  insert into neighborhoods (channel_id, name, hashtag, keywords, center_lat, center_lng, display_order)
  values
    (ch, 'Бруклин (общий)',  '#бруклин',         array['Brooklyn'],                                                          40.6782, -73.9442, 1),
    (ch, 'Брайтон-Бич',      '#брайтон',         array['Brighton','Brighton Beach','Brighton Beach Ave','Coney Island Ave near Brighton'], 40.5780, -73.9613, 10),
    (ch, 'Шипсхэд-Бэй',      '#шипсхэдбей',      array['Sheepshead','Sheepshead Bay','Avenue Z','Emmons Ave','Knapp St'],    40.5867, -73.9444, 11),
    (ch, 'Бенсонхёрст',      '#бенсонхёрст',     array['Bensonhurst','86th St','Bath Ave','New Utrecht','86 St'],            40.6027, -73.9925, 12),
    (ch, 'Кони-Айленд',      '#конийайленд',     array['Coney Island','Surf Ave','Mermaid Ave','Stillwell Ave','Neptune Ave'], 40.5755, -73.9707, 13),
    (ch, 'Бэй-Ридж',         '#бэйридж',         array['Bay Ridge','3rd Ave','5th Ave Bay Ridge','Shore Rd','Fort Hamilton'], 40.6262, -74.0299, 14),
    (ch, 'Дайкер-Хайтс',     '#дайкерхайтс',     array['Dyker Heights','11th Ave','13th Ave','Dyker'],                       40.6190, -74.0145, 15),
    (ch, 'Боро-Парк',        '#бороПарк',        array['Borough Park','Boro Park','13th Ave','New Utrecht Ave','Ocean Pkwy'], 40.6336, -73.9938, 16),
    (ch, 'Мидвуд',           '#мидвуд',          array['Midwood','Avenue J','Avenue M','Kings Hwy','Ocean Ave'],              40.6191, -73.9667, 17),
    (ch, 'Флэтбуш',          '#флэтбуш',         array['Flatbush','Flatbush Ave','Church Ave','Linden Blvd'],                40.6404, -73.9624, 18),
    (ch, 'Краун-Хайтс',      '#краунхайтс',      array['Crown Heights','Eastern Pkwy','Empire Blvd','Utica Ave','Nostrand Ave'], 40.6694, -73.9422, 19),
    (ch, 'Бедфорд-Стайвесант','#бедстай',        array['Bed-Stuy','Bedford-Stuyvesant','Fulton St','Nostrand','Marcy Ave','Tompkins Ave'], 40.6872, -73.9418, 20),
    (ch, 'Уильямсбург',      '#уильямсбург',     array['Williamsburg','Bedford Ave','Metropolitan Ave','Bushwick Ave','Marcy Ave'], 40.7081, -73.9571, 21),
    (ch, 'Гринпойнт',        '#гринпойнт',       array['Greenpoint','Manhattan Ave','McGuinness','Nassau Ave'],              40.7299, -73.9540, 22),
    (ch, 'Бушвик',           '#бушвик',          array['Bushwick','Knickerbocker','Wyckoff','Myrtle Ave','Broadway Brooklyn'], 40.6943, -73.9213, 23),
    (ch, 'Парк-Слоуп',       '#паркслоуп',       array['Park Slope','7th Ave Park Slope','5th Ave Park Slope','Prospect Park West'], 40.6710, -73.9814, 24),
    (ch, 'Сансет-Парк',      '#сансетпарк',      array['Sunset Park','4th Ave','5th Ave Sunset','8th Ave Sunset'],           40.6451, -74.0118, 25),
    (ch, 'Бруклин-Хайтс',    '#бруклинхайтс',    array['Brooklyn Heights','Court St','Montague St','Atlantic Ave Brooklyn Heights'], 40.6962, -73.9928, 26),
    (ch, 'Даунтаун Бруклин', '#даунтаун',        array['Downtown Brooklyn','Fulton Mall','Adams St','Jay St','Tillary'],     40.6929, -73.9856, 27),
    (ch, 'Ред-Хук',          '#редхук',          array['Red Hook','Van Brunt','Beard St'],                                   40.6738, -74.0094, 28),
    (ch, 'Кэрролл-Гарденс',  '#кэрроллгарденс',  array['Carroll Gardens','Smith St','Court St'],                             40.6802, -73.9990, 29),
    (ch, 'Гованус',          '#гованус',         array['Gowanus','Gowanus Canal','3rd Ave Gowanus','4th Ave Gowanus'],       40.6738, -73.9869, 30),
    (ch, 'Канарси',          '#канарси',         array['Canarsie','Rockaway Pkwy','Flatlands Ave'],                          40.6360, -73.9047, 31),
    (ch, 'Восточный Нью-Йорк','#истньюйорк',     array['East New York','Pennsylvania Ave','Linden Blvd','Atlantic Ave East'], 40.6713, -73.8830, 32);
end $$;

-- ----------------------------------------------------------------------------
-- 3. Sources — start with the most reliable free ones
-- ----------------------------------------------------------------------------
do $$
declare
  ch uuid;
begin
  select id into ch from channels where slug = 'brooklyn-watch';

  insert into sources (channel_id, type, name, url, frequency_minutes, is_enabled, config) values
    (ch, 'rss',    'NYPD News',           'https://nypdnews.com/feed/',                      30, true,  '{"borough_filter":"Brooklyn"}'::jsonb),
    (ch, 'reddit', 'r/Brooklyn',          'https://www.reddit.com/r/Brooklyn/new/.json',     20, true,  '{"min_score":5,"flairs":["Crime","News"]}'::jsonb),
    (ch, 'reddit', 'r/nyc — Brooklyn',    'https://www.reddit.com/r/nyc/new/.json',          20, true,  '{"keyword_filter":["brooklyn","brighton","bensonhurst","bay ridge","bed-stuy","williamsburg","park slope","sunset park","crown heights","flatbush","bushwick","midwood","sheepshead"]}'::jsonb),
    (ch, 'rss',    'Patch — Brighton',    'https://patch.com/feeds/new-york/brooklyn',       60, false, '{}'::jsonb),
    (ch, 'rss',    'NotifyNYC',           'https://a858-nycnotify.nyc.gov/notifynyc/rss',    30, true,  '{"borough_filter":"Brooklyn"}'::jsonb);
end $$;

-- ----------------------------------------------------------------------------
-- 4. Default filters (stopwords for noise)
-- ----------------------------------------------------------------------------
do $$
declare
  ch uuid;
begin
  select id into ch from channels where slug = 'brooklyn-watch';

  insert into filters (channel_id, type, value) values
    (ch, 'stopword', 'press release archive'),
    (ch, 'stopword', 'recruitment'),
    (ch, 'stopword', 'job fair'),
    (ch, 'stopword', 'precinct community council');
end $$;
