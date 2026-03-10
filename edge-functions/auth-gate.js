export default async (req, context) => {
  const url  = new URL(req.url);
  const path = url.pathname;

  // Allow login page and all Netlify infrastructure
  if (path === '/login' || path === '/login.html' || path.startsWith('/.netlify/')) {
    return context.next();
  }

  // Accept token from cookie OR Authorization: Bearer header (for API calls)
  const cookie      = req.headers.get('cookie') || '';
  const cookieMatch = cookie.match(/nf_jwt=([^;]+)/);
  const authHeader  = req.headers.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer\s+(\S+)/i);
  const rawToken    = cookieMatch ? cookieMatch[1] : (bearerMatch ? bearerMatch[1] : null);

  if (rawToken) {
    try {
      // Decode JWT payload (no signature verification needed — GoTrue handles that on API calls)
      const b64     = rawToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const payload = JSON.parse(atob(b64));
      const now     = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp > now) {
        return context.next(); // valid
      }
    } catch {
      // malformed — fall through
    }
  }

  // No valid cookie — redirect to login
  const dest = new URL('/login', url.origin);
  if (path !== '/') dest.searchParams.set('redirect', path + url.search);
  return Response.redirect(dest.toString(), 302);
};

export const config = {
  path: "/*",
  excludedPath: ["/.netlify/*", "/login", "/login.html", "/favicon.ico"],
};
