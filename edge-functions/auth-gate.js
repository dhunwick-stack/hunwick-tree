// Edge Function: auth-gate
// Runs on every request — redirects to /login if no valid session token

const PUBLIC_PATHS = [
  '/login',
  '/login.html',
  '/.netlify/identity',  // Identity API must be accessible
  '/favicon',
];

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Always allow public paths and static assets
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return context.next();
  }

  // Check for identity token in cookie
  const cookie = req.headers.get('cookie') || '';
  const hasToken = cookie.includes('nf_jwt=') || cookie.includes('gotrue-session=');

  if (hasToken) {
    return context.next();
  }

  // No token — redirect to login, preserving the intended destination
  const loginUrl = new URL('/login', url.origin);
  loginUrl.searchParams.set('redirect', url.pathname + url.search + url.hash);
  return Response.redirect(loginUrl.toString(), 302);
};

export const config = {
  path: "/*",
  excludedPath: ["/.netlify/*", "/favicon.ico"],
};
