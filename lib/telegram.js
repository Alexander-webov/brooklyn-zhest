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

export function emojiFor(type) {
  return TYPE_EMOJI[type] || TYPE_EMOJI.other;
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
 * Placeholders: {type_emoji} {neighborhood_hashtag} {time_ago} {landmark} {description} {source}
 */
export function renderPost({ template, incident, neighborhood, sourceName }) {
  const data = {
    type_emoji: emojiFor(incident.type),
    neighborhood_hashtag: neighborhood?.hashtag || '#бруклин',
    time_ago: timeAgoRu(incident.occurred_at || incident.created_at),
    landmark: incident.landmark || incident.address || 'Бруклин',
    description: incident.body_ru || '',
    source: sourceName || 'NYPD/Reddit'
  };
  return (template || '').replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
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
      disable_web_page_preview,
      parse_mode: undefined  // plain text — emoji + hashtags work fine
    })
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(`Telegram API: ${json.description || res.statusText}`);
  }
  return json.result; // contains message_id, chat, etc.
}

/** For testing / chat_id discovery: list recent updates the bot has received */
export async function getUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates`);
  return res.json();
}

/** Verify bot can post to a chat (used in admin UI 'test' buttons) */
export async function getChat(chat_id) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getChat?chat_id=${encodeURIComponent(chat_id)}`);
  return res.json();
}
