/**
 * An absolute URL on the host the browser actually used. In development Next.js builds request.url from its own
 * hostname ("localhost"), so a redirect built from it can move the browser from 127.0.0.1 to localhost, and the
 * session cookie, which belongs to the first host, is lost. The Host header is what the browser sent.
 */
export function redirectUrl(request: Request, path: string): URL {
  const fallback = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? fallback.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? fallback.protocol.replace(":", "");
  return new URL(path, `${protocol}://${host}`);
}
