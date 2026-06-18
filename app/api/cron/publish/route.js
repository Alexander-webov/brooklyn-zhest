// ============================================================================
// ПАТЧ для app/api/cron/publish/route.js
// Цель: не публиковать протухшие новости и не разгребать бэклог годами.
// Найди блок "// pick the next approved incident..." и замени его.
// ============================================================================

// --- БЫЛО ---------------------------------------------------------------
//
//     // pick the next approved incident, prioritized by score then age
//     const { data: candidates } = await sb.from('incidents')
//       .select('*, neighborhoods(name, hashtag), raw_incident_ids')
//       .eq('channel_id', ch.id)
//       .eq('status', 'approved')
//       .order('score', { ascending: false })
//       .order('created_at', { ascending: true })   // <-- старые первыми = постит протухшее
//       .limit(1);

// --- СТАЛО --------------------------------------------------------------

    // freshness gate: ничего старше 48ч не публикуем (created_at, а не occurred_at —
    // occurred_at nullable, .gte по нему молча выкинет записи с null)
    const freshCutoff = new Date(Date.now() - 48 * 3600_000).toISOString();

    // самая важная СВЕЖАЯ новость первой: score по убыванию, затем новые вперёд
    const { data: candidates } = await sb.from('incidents')
      .select('*, neighborhoods(name, hashtag), raw_incident_ids')
      .eq('channel_id', ch.id)
      .eq('status', 'approved')
      .gte('created_at', freshCutoff)
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

// ============================================================================
// Почему 48ч в публикации, а 72ч в cleanup:
// публикация постит только реально свежее (48ч), а cleanup даёт запас (72ч),
// чтобы не удалить запись прямо в момент, когда она ещё могла бы выйти.
// ============================================================================
