import { createHmac } from 'node:crypto';

// La clave publicable solo puede invocar los dos RPC restringidos del contador.
const STORE_URL = 'https://oqknlofxgbczavuuocqp.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_eVxOjgNRG0o6v4S2FkmRtQ_KVioeG1z';
const PRODUCTION_HOSTS = new Set(['pablovillagran.cl', 'www.pablovillagran.cl']);
const BOTS = /bot|crawler|spider|preview|headless|lighthouse|facebookexternalhit|curl|wget|python|monitor/i;
const dayInMelinka = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Coyhaique', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

async function rpc(name, body = {}) {
  const response = await fetch(STORE_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) throw new Error('stats_' + response.status);
  return response.json();
}

function reply(data, status = 200, cache = false) {
  return Response.json(data, { status, headers: {
    'Cache-Control': cache ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' : 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }});
}

export default {
  async fetch(request) {
    const method = request.method;
    if (method !== 'GET' && method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
    }
    try {
      if (method === 'GET') return reply(await rpc('myhome_visits_summary'), 200, true);
      const url = new URL(request.url);
      if (!PRODUCTION_HOSTS.has(url.hostname) ||
          request.headers.get('origin') !== url.origin ||
          request.headers.get('sec-fetch-site') !== 'same-origin') {
        return reply({ error: 'Solicitud no permitida.' }, 403);
      }
      const ua = request.headers.get('user-agent') || '';
      if (!ua || BOTS.test(ua)) return reply({ ...await rpc('myhome_visits_summary'), counted: false });
      const ip = (request.headers.get('x-vercel-forwarded-for') ||
                  request.headers.get('x-forwarded-for') ||
                  request.headers.get('x-real-ip') || '').split(',')[0].trim();
      const secret = process.env.MYHOME_VISITS_SECRET;
      if (!secret || !ip) throw new Error('stats_configuration');
      // Se calcula en memoria y cambia diariamente. La IP nunca se envía a la base.
      const day = dayInMelinka();
      const fingerprint = createHmac('sha256', secret).update(day + '|' + ip + '|' + ua.slice(0, 300)).digest('hex');
      const geo = (request.headers.get('x-vercel-ip-country') || 'ZZ').toUpperCase();
      const country = /^[A-Z]{2}$/.test(geo) ? geo : 'ZZ';
      const clock = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', secret).update([day, country, fingerprint, clock].join('|')).digest('hex');
      return reply(await rpc('myhome_visits_record', {
        p_day: day, p_country: country, p_fingerprint: fingerprint, p_clock: clock, p_signature: signature
      }));
    } catch (error) {
      console.error('Contador de visitas:', /^stats_/.test(error.message) ? error.message : 'upstream_unavailable');
      return reply({ error: 'Las estadísticas no están disponibles por ahora.' }, 503);
    }
  }
};
