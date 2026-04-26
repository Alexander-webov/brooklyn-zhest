import { admin } from './supabase-admin.js';

export async function log({ level = 'info', scope, message, channel_id = null, source_id = null, data = null }) {
  try {
    // also mirror to console for runtime visibility
    const tag = `[${scope || '-'}]`;
    if (level === 'error') console.error(tag, message, data || '');
    else if (level === 'warn') console.warn(tag, message, data || '');
    else console.log(tag, message, data ? JSON.stringify(data).slice(0, 300) : '');

    await admin().from('logs').insert({
      level, scope, message, channel_id, source_id, data
    });
  } catch (e) {
    console.error('[logger] failed to write log', e?.message);
  }
}

export const logInfo  = (args) => log({ ...args, level: 'info' });
export const logWarn  = (args) => log({ ...args, level: 'warn' });
export const logError = (args) => log({ ...args, level: 'error' });
