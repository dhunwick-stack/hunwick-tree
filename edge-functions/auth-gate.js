const PUBLIC_PATHS = ['/login', '/login.html', '/favicon.ico'];

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return context.next();
  }

  const cookie = req.headers.get('cookie') || '';
  if (cookie.includes('nf_jwt=')) {
    return context.next();
  }

  const loginUrl = new URL('/login', url.origin);
  loginUrl.searchParams.set('redirect', url.pathname + url.search);
  return Response.redirect(loginUrl.toString(), 302);
};

export const config = {
  path: "/*",
  excludedPath: ["/.netlify/*", "/login", "/login.html", "/favicon.ico"],
};
