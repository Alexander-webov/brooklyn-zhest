/** Verify a cron request: Authorization: Bearer <CRON_SECRET> */
export function verifyCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 8) return false;
  const auth = req.headers.get('authorization') || '';
  // also accept ?secret=... for cron-job.org convenience
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('secret');
  const expected = `Bearer ${secret}`;
  return auth === expected || querySecret === secret;
}
