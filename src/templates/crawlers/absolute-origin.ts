const crawler: Crawler = {
  config: {
    maxPagesPerCrawl: 10_000,
    schedule: "@daily",
  },

  schema({ z }) {
    return z.object({
      title: z.string().optional(),
      description: z.string().optional(),
    });
  },

  seed() {
    return ["https://news.ycombinator.com/newest"];
  },

  handler({ $, $$ }) {
    // get the title and description of the page
    const title = $("head > title")?.innerText;
    const description = $("meta[name='description']")?.getAttribute("content");

    // get the absolute URL of every link on the page
    const links = $$("a[href^='http']")
      .filter(({ href }) => URL.canParse(href))
      .map(({ href }) => new URL(href).origin);

    return {
      data: { title, description },
      enqueue: links,
    };
  },
};

export default crawler;
