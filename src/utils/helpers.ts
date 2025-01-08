const ALLOWED_PROTOCOLS = ["https:", "http:"];
const FORBIDDEN_HOSTS = ["example.com", "www.example.com"];
const FORBIDDEN_TLDS = ["gov", "onion"];
const FORBIDDEN_EXTS = [
  "avif",
  "bak",
  "dmg",
  "exe",
  "gz",
  "m4a",
  "mov",
  "mp3",
  "mp4",
  "ogg",
  "pdf",
  "psd",
  "rar",
  "rpm",
  "wasm",
  "wav",
  "webm",
  "xsd",
  "zip",
];
const FORBIDDEN_SUBSTRINGS = [];
const USELESS_QUERY_PARAMS = [];

export function normalizeRequests(
  currentUrl: string | null,
  requests: Array<{ url: string } & RequestInit> = [],
  config: Config,
): Array<{ url: string } & RequestInit> {
  if (requests.length === 0) {
    return [];
  }

  const normalizedRequests = requests
    .map((request) => {
      const hrefString = String(request.url).trim();
      const url = currentUrl
        ? new URL(hrefString, currentUrl).href
        : hrefString;
      if (!URL.canParse(url)) {
        return false;
      }

      const { protocol, host, hostname, pathname, searchParams } = new URL(url);
      // hostname needs to have at least one period
      if (!hostname.includes(".")) {
        return false;
      }

      const links = config.links || ({} as keyof typeof config.links);
      const tld = hostname.split(".").pop() || "";
      const ext = pathname.split(".").pop() || "";

      // check if user has supplied any allowlists
      const allowHosts = links.allowHosts || [];
      const allowTLDs = (links.allowTLDs || []).map((tld: string) =>
        tld.replaceAll(".", ""),
      );
      if (allowHosts.length > 0 && !allowHosts.includes(hostname)) {
        return false;
      }
      console.log("allowTLDs", allowTLDs, tld);
      if (allowTLDs.length > 0 && !allowTLDs.includes(tld)) {
        return false;
      }
      // check against platform + user denylists
      const disallowHosts = links.disallowHosts || [];
      const disallowTLDs = (links.disallowTLDs || []).map((tld: string) =>
        tld.replaceAll(".", ""),
      );
      const disallowExtensions = (links.disallowExtensions || []).map(
        (ext: string) => ext.replaceAll(".", ""),
      );
      if (
        !ALLOWED_PROTOCOLS.includes(protocol) ||
        FORBIDDEN_HOSTS.concat(disallowHosts).includes(hostname) ||
        FORBIDDEN_TLDS.concat(disallowTLDs).includes(tld) ||
        FORBIDDEN_EXTS.concat(disallowExtensions).includes(ext) ||
        FORBIDDEN_SUBSTRINGS.some((substr) => url.includes(substr))
      ) {
        return false;
      }

      // remove useless query parameters
      let queryParams = "";
      if (!links.ignoreQueryParams) {
        USELESS_QUERY_PARAMS.forEach((param) => {
          searchParams.delete(param);
        });
        // sort query parameters in place
        searchParams.sort();
        queryParams = searchParams.toString()
          ? `?${searchParams.toString()}`
          : "";
      }

      return {
        url: `https://${host}${pathname}${queryParams}`,
        method: request.method,
        headers: request.headers,
        body: request.body,
      };
    })
    .filter(Boolean) as Request[];

  // Using Map to remove duplicates based on url
  const uniqueRequests = Array.from(
    new Map(
      normalizedRequests.map((request) => [request.url, request]),
    ).values(),
  );

  return uniqueRequests;
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
