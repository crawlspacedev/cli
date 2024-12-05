const crawler: Crawler = {
  schema({ z }) {
    return z.object({
      title: z.string(),
      description: z.string(),
    });
  },

  seed() {
    return ["https://news.ycombinator.com/newest"];
  },

  handler({ $, $$ }) {
    // get the absolute URL of every link on the page
    const links = $$("a[href^='http']")
      .filter(({ href }) => URL.canParse(href))
      .map(({ href }) => new URL(href).origin);

    // get the title and description of the page
    const title = $("head > title")?.innerText;
    const description = $("meta[name='description']")?.getAttribute("content");
    const row = { title, description };

    return {
      enqueue: links,
      insert: { row },
    };
  },
};

export default crawler;
