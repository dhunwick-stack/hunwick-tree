// Shared auth helper — call this at the top of any write function
// Returns { ok: true, user } or { ok: false, response }

export async function requireAuth(req) {
  // Accept token from Authorization header OR nf_jwt cookie (browser direct visits)
  const authHeader = req.headers.get('authorization') || '';
  let token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(/nf_jwt=([^;]+)/);
    token = match ? match[1] : '';
  }

  if (!token) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorised — please log in' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    if (!payload.sub || !payload.email) throw new Error('Invalid token payload');

    return { ok: true, user: { id: payload.sub, email: payload.email } };
  } catch (err) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: `Unauthorised — ${err.message}` }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}
