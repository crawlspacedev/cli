export function getUserAgent(hostname: string, config) {
  return {
    Accept: "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    Host: hostname,
    "User-Agent": `Mozilla/5.0 (crawlspace/${config.name}) https://crawlspace.dev/ua`,
  };
}
