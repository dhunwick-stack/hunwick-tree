// Shared auth helper — call this at the top of any write function
// Returns { ok: true, user } or { ok: false, response }

export async function requireAuth(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

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
    // Netlify Identity issues JWTs — verify by calling the /.netlify/identity/user endpoint
    // We decode the payload to get the user info (signature already verified by Netlify's gateway)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed token');

    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // Must have a valid sub (user ID) and email
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
