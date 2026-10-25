export async function api(request, env, buildingIds) {
  const url = new URL(request.url);
  const json = (body, status = 200, headers = {}) => Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  });
  if (!env.DB) return json({ error: 'Shared database unavailable' }, 503);
  const now = Date.now();

  if (request.method === 'GET' && url.pathname === '/api/state') {
    const [presence, reports] = await Promise.all([
      env.DB.prepare("SELECT building,area,mode,COUNT(*) AS count FROM presence WHERE (mode = 'automatic' AND updated > ?) OR (mode != 'automatic' AND updated > ?) GROUP BY building,area,mode")
        .bind(now - 1800000, now - 180000).all(),
      env.DB.prepare('SELECT building,area,status,noise,updated FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY building,area ORDER BY updated DESC) AS rank FROM reports WHERE updated > ?) WHERE rank=1').bind(now - 1800000).all()
    ]);
    return json({ presence: presence.results, reports: reports.results, serverTime: now });
  }

  if (request.method === 'GET' && url.pathname === '/api/study-groups') {
    const location = (url.searchParams.get('location') || '').trim().slice(0, 120);
    const today = new Date(now).toISOString().slice(0, 10);
    const result = await env.DB.prepare("SELECT id,location,topic,course,test,size,date,time,host,joined,created FROM study_groups WHERE date >= ? AND (? = '' OR lower(location) = lower(?)) ORDER BY date,time,created LIMIT 250")
      .bind(today, location, location).all();
    return json({ groups: result.results });
  }

  if (!['POST', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'Origin rejected' }, 403);
  const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)ss_session=([a-f0-9]{64})(?:;|$)/);
  let session = cookie?.[1];
  if (!session) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    session = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  const headers = { 'Set-Cookie': `ss_session=${session}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=86400` };

  if (url.pathname === '/api/presence' && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM presence WHERE session=?').bind(session).run();
    return json({ ok: true }, 200, headers);
  }

  let body;
  try {
    if (Number(request.headers.get('Content-Length')) > 2048) return json({ error: 'Too large' }, 413);
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'Too large' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  if (url.pathname === '/api/study-groups' && request.method === 'POST') {
    const text = (value, max) => typeof value === 'string' && value.trim().length <= max;
    let date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date);
    if (date) {
      const parsedDate = new Date(`${body.date}T00:00:00Z`);
      date = Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === body.date;
    }
    const today = new Date(now).toISOString().slice(0, 10);
    if (!text(body.location, 120) || !body.location.trim() || !text(body.topic, 70) || !body.topic.trim()
      || !text(body.course, 50) || !body.course.trim() || !text(body.test || '', 60)
      || !Number.isInteger(body.size) || body.size < 2 || body.size > 50
      || !date || body.date < today || typeof body.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.time)
      || !text(body.host || 'Student', 30) || !text(body.contact || '', 120)) return json({ error: 'Invalid study group' }, 400);
    const group = {
      id: crypto.randomUUID(), location: body.location.trim(), topic: body.topic.trim(), course: body.course.trim(),
      test: (body.test || '').trim(), size: body.size, date: body.date, time: body.time,
      host: (body.host || 'Student').trim() || 'Student', contact: (body.contact || '').trim(), joined: 0, created: now
    };
    await env.DB.prepare('INSERT INTO study_groups(id,location,topic,course,test,size,date,time,host,contact,joined,created,session) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(group.id, group.location, group.topic, group.course, group.test, group.size, group.date, group.time, group.host, group.contact, 0, now, session).run();
    return json({ group }, 201, headers);
  }

  if (!buildingIds.has(body.building) || typeof body.area !== 'string' || !/^[a-zA-Z0-9_-]{0,80}$/.test(body.area)) return json({ error: 'Invalid building or area' }, 400);
  if (url.pathname === '/api/presence') {
    if (!['manual', 'location', 'automatic'].includes(body.mode)) return json({ error: 'Invalid mode' }, 400);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM presence WHERE (mode = 'automatic' AND updated < ?) OR (mode != 'automatic' AND updated < ?)")
        .bind(now - 1800000, now - 180000),
      env.DB.prepare('INSERT INTO presence(session,building,area,mode,updated) VALUES(?,?,?,?,?) ON CONFLICT(session) DO UPDATE SET building=excluded.building,area=excluded.area,mode=excluded.mode,updated=excluded.updated').bind(session, body.building, body.area, body.mode, now)
    ]);
    return json({ ok: true, expiresIn: body.mode === 'automatic' ? 1800 : 180 }, 200, headers);
  }
  if (url.pathname === '/api/report') {
    if (!['open', 'filling', 'full'].includes(body.status) || !['', 'Quiet', 'Some conversation', 'Loud'].includes(body.noise || '')) return json({ error: 'Invalid conditions' }, 400);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM reports WHERE updated < ?').bind(now - 1800000),
      env.DB.prepare('INSERT INTO reports(session,building,area,status,noise,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(session,building,area) DO UPDATE SET status=excluded.status,noise=excluded.noise,updated=excluded.updated').bind(session, body.building, body.area, body.status, body.noise || '', now)
    ]);
    return json({ ok: true }, 200, headers);
  }
  return json({ error: 'Not found' }, 404);
}
