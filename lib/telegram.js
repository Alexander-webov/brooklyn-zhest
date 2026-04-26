import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

const TELEGRAM_API = 'https://api.telegram.org';

const TYPE_EMOJI = {
  shooting:   '🚨',
  robbery:    '🚨',
  fire:       '🔥',
  arrest:     '🚓',
  missing:    '🆘',
  assault:    '⚠️',
  theft:      '🕵️',
  crash:      '🚗',
  weapon:     '🔫',
  drugs:      '💊',
  suspicious: '👁️',
  emergency:  '🚑',
  other:      '📍'
};

// human-readable type label in Russian — for use as headline word
const TYPE_LABEL_RU = {
  shooting:   'СТРЕЛЬБА',
  robbery:    'ОГРАБЛЕНИЕ',
  fire:       'ПОЖАР',
  arrest:     'ЗАДЕРЖАНИЕ',
  missing:    'РОЗЫСК',
  assault:    'НАПАДЕНИЕ',
  theft:      'КРАЖА',
  crash:      'ДТП',
  weapon:     'ОРУЖИЕ',
  drugs:      'НАРКОТИКИ',
  suspicious: 'ПОДОЗРИТЕЛЬНО',
  emergency:  'ЧП',
  other:      'ИНЦИДЕНТ'
};

export function emojiFor(type) {
  return TYPE_EMOJI[type] || TYPE_EMOJI.other;
}

export function typeLabel(type) {
  return TYPE_LABEL_RU[type] || TYPE_LABEL_RU.other;
}

export function timeAgoRu(date) {
  if (!date) return 'только что';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'только что';
  return formatDistanceToNowStrict(d, { locale: ru, addSuffix: false }) + ' назад';
}

/**
 * Render a post body using the channel's template.
 *
 * Supported placeholders:
 *   {type_emoji}            — emoji like 🚨 / 🔥 / 🚓
 *   {type_label}            — Russian uppercase word: СТРЕЛЬБА / ОГРАБЛЕНИЕ / etc.
 *   {neighborhood_hashtag}  — #брайтон / #бенсонхёрст / etc.
 *   {neighborhood_name}     — human-readable neighborhood name
 *   {time_ago}              — "2 часа назад"
 *   {landmark}              — "у Key Food на 86-й" or address fallback
 *   {address}               — raw english address
 *   {title_ru}              — Russian title from LLM
 *   {description}           — Russian body from LLM
 *   {body}                  — alias for description
 *   {source}                — source name e.g. "Citizen — Brooklyn"
 *   {score}                 — numeric importance 0-100
 */
export function renderPost({ template, incident, neighborhood, sourceName }) {
  const data = {
    type_emoji:           emojiFor(incident.type),
    type_label:           typeLabel(incident.type),
    neighborhood_hashtag: neighborhood?.hashtag || '#бруклин',
    neighborhood_name:    neighborhood?.name || 'Бруклин',
    time_ago:             timeAgoRu(incident.occurred_at || incident.created_at),
    landmark:             incident.landmark || incident.address || neighborhood?.name || 'Бруклин',
    address:              incident.address || '',
    title_ru:             incident.title_ru || '',
    description:          incident.body_ru || '',
    body:                 incident.body_ru || '',
    source:               sourceName || 'NYPD/Reddit',
    score:                String(incident.score ?? '')
  };

  let out = (template || '').replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');

  // Clean up artefacts left by empty placeholders:
  // 1. Lines that became empty (only whitespace) — keep ONE blank line max in a row
  out = out.split('\n').reduce((acc, line) => {
    const trimmed = line.trim();
    if (trimmed === '') {
      // collapse multiple consecutive blank lines into one
      if (acc.length === 0 || acc[acc.length - 1] !== '') acc.push('');
    } else {
      acc.push(line);
    }
    return acc;
  }, []).join('\n');

  // 2. Trailing/leading blank lines
  out = out.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');

  return out;
}

export async function sendMessage({ chat_id, text, disable_web_page_preview = true }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id,
      text,
      disable_web_page_preview
    })
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(`Telegram API: ${json.description || res.statusText}`);
  }
  return json.result;
}

export async function getUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates`);
  return res.json();
}

export async function getChat(chat_id) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getChat?chat_id=${encodeURIComponent(chat_id)}`);
  return res.json();
}
