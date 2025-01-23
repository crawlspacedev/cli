function schema({ z }) {
  return z.object({
    model: z.string(),
    cpu: z.string(),
    ram: z.string(),
    hard_drive: z.string(),
    year: z.number().int(),
    screen_size: z.string(),
    dollars: z.number().int(),
    location: z.string(),
    condition: z.enum([
      "new",
      "like new",
      "excellent",
      "good",
      "fair",
      "salvage",
    ]),
  });
}

export default {
  schema,
  init() {
    // Example: start searching on craigslist for iMacs
    return ["https://sfbay.craigslist.org/search/sya?query=imac"];
  },
  async onResponse({ $, $$, ai, enqueue, z }) {
    // enqueue all links on the page
    enqueue($$("a[href]"));
    // only run inference on individual posts
    const isDetailPage = !!$("#postingbody");
    if (isDetailPage) {
      const row = await ai.extract($("body"), {
        model: "meta/llama-3.1-8b",
        instruction: "Find the computer specs",
        schema: schema({ z }),
      });
      return {
        insert: { row },
      };
    }
  },
} as Crawler;
