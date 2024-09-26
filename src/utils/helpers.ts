const FORBIDDEN_HOST_REGEX = /^(localhost|[\d\.]+)$/;
const FORBIDDEN_TLDS_REGEX = /\.(cn|gov|onion)$/;
const FORBIDDEN_EXTS_REGEX = /\.(gif|jpg|pdf)$/;

export function permitUrls(
  currentUrl: string | null,
  hrefs: string[] = [],
  config,
): string[] {
  return hrefs
    .map((href) => {
      const url = currentUrl
        ? new URL(href.trim(), currentUrl).href
        : href.trim();
      if (!URL.canParse(url)) {
        console.error("Bad URL", url);
        return false;
      }

      const { hostname, pathname } = new URL(url);
      // defaults
      if (
        FORBIDDEN_HOST_REGEX.test(hostname) ||
        FORBIDDEN_TLDS_REGEX.test(hostname) ||
        FORBIDDEN_EXTS_REGEX.test(pathname)
      ) {
        return false;
      }
      // user config
      if (
        config.avoidHosts?.includes(hostname) ||
        config.avoidTLDs?.includes(hostname) ||
        config.avoidExtensions?.includes(pathname)
      ) {
        return false;
      }

      return url.replace(/^http:/, "https:");
    })
    .filter(Boolean) as string[];
}

export function randomHeaders(hostname: string, config) {
  return {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Host: hostname,
    "User-Agent": `Mozilla/5.0 (crawlspace/${config.name}) https://crawlspace.dev/ua`,
  };
}
