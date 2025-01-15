import outmatch from "outmatch";

const ALLOWED_PROTOCOLS = ["https:", "http:"];

const DOMAIN_GLOBS = [
  "!.",
  "!example.com",
  "!*.example.com",
  "!**.comhttps",
  "!**.gov",
  "!**.invalid",
  "!**.onion",
];

const PATH_GLOBS = [
  "!**/*.avif",
  "!**/*.bak",
  "!**/*.dmg",
  "!**/*.docx",
  "!**/*.exe",
  "!**/*.gz",
  "!**/*.m4a",
  "!**/*.mov",
  "!**/*.mp3",
  "!**/*.mp4",
  "!**/*.ogg",
  "!**/*.pdf",
  "!**/*.pptx",
  "!**/*.psd",
  "!**/*.rar",
  "!**/*.rpm",
  "!**/*.wasm",
  "!**/*.wav",
  "!**/*.webm",
  "!**/*.xsd",
  "!**/*.zip",
];

const FORBIDDEN_SUBSTRINGS = [
  "facebook.com/sharer/",
  "linkedin.com/shareArticle",
  "plus.google.com/share",
  "://reddit.com/submit",
  "://old.reddit.com/submit",
  "://www.reddit.com/submit",
  "://stumbleupon.com/submit",
  "://www.stumbleupon.com/submit",
  "share.flipboard.com/bookmarklet/popout",
  ".tumblr.com/ask",
  ".tumblr.com/submit",
  ".tumblr.com/widgets/share",
  "twitter.com/intent/tweet",
];

const USELESS_QUERY_PARAMS = [
  "aff_id",
  "affiliate_id",
  "cid",
  "dclid",
  "email_id",
  "fbclid",
  "ga_hid",
  "ga_sid",
  "gclid",
  "igshid",
  "iref",
  "n_cid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "msclkid",
  "partner_id",
  "PHPSESSID",
  "ref",
  "ref_",
  "ref_id",
  "referrer",
  "return_to",
  "redirect_to",
  "redirect_url",
  "s_kwcid",
  "session_id",
  "share",
  "sid",
  "trk",
  "uid",
  "userid",
  "utm",
  "utm_campaign",
  "utm_cmp",
  "utm_content",
  "utm_id",
  "utm_medium",
  "utm_name",
  "utm_social",
  "utm_source",
  "utm_term",
  "yclid",
  "_gl",
];

export function normalizeRequests(
  requests: Array<{ url: string } & RequestInit> = [],
  config: Config,
): Array<{ url: string } & RequestInit> {
  if (requests.length === 0) {
    return [];
  }

  const crawl = config.crawl || ({} as keyof typeof config.crawl);
  const domainGlobs = [
    ...new Set(DOMAIN_GLOBS.concat(crawl.matchDomains || [])),
  ];
  const pathGlobs = [...new Set(PATH_GLOBS.concat(crawl.matchPaths || []))];
  const domainMatcher = outmatch(domainGlobs, {
    separator: ".",
    excludeDot: false,
  });
  const pathMatcher = outmatch(pathGlobs, {
    separator: "/",
    excludeDot: false,
  });

  const normalizedRequests = requests
    .map((request) => {
      const url = String(request.url).trim();
      if (!URL.canParse(url)) {
        return false;
      }

      const { protocol, hostname, pathname, searchParams } = new URL(url);

      if (
        !hostname.includes(".") ||
        !ALLOWED_PROTOCOLS.includes(protocol) ||
        FORBIDDEN_SUBSTRINGS.some((substr) => url.includes(substr)) ||
        !domainMatcher(hostname) ||
        !pathMatcher(pathname)
      ) {
        return false;
      }

      // remove useless query parameters
      let queryParams = "";
      if (!crawl.ignoreQueryParams) {
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
        url: `https://${hostname}${pathname}${queryParams}`,
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
