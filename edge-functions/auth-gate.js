export default async (req, context) => {
  const url  = new URL(req.url);
  const path = url.pathname;

  // Allow: login page, identity API, static assets
  if (
    path === '/login' ||
    path === '/login.html' ||
    path === '/favicon.ico' ||
    path.startsWith('/.netlify/')
  ) {
    return context.next();
  }

  // Check for our session cookie
  const cookie = req.headers.get('cookie') || '';
  const match  = cookie.match(/nf_jwt=([^;]+)/);

  if (match) {
    // Quick JWT expiry check (no signature verification — just payload)
    try {
      const payload = JSON.parse(atob(match[1].split('.')[1]));
      if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
        return context.next(); // valid, not expired
      }
    } catch {
      // Malformed token — fall through to redirect
    }
  }

  // No valid session — redirect to login
  const loginUrl = new URL('/login', url.origin);
  if (path !== '/') loginUrl.searchParams.set('redirect', path + url.search);
  return Response.redirect(loginUrl.toString(), 302);
};

export const config = {
  path: "/*",
  excludedPath: ["/.netlify/*", "/login", "/login.html", "/favicon.ico"],
};
