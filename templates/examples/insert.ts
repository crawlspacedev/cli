const crawler: Crawler = {
  init() {
    return ["https://news.ycombinator.com/newest"];
  },

  schema({ z }) {
    return z.object({
      title: z.string(),
      description: z.string(),
    });
  },

  onResponse({ $, $$, enqueue }) {
    // get the absolute URL of every link on the page
    const links = $$("a[href^='http']")
      .filter(({ href }) => URL.canParse(href))
      .map(({ href }) => new URL(href).origin);
    enqueue(links);

    // get the title and description of the page
    const title = $("head > title")?.innerText;
    const description = $("meta[name='description']")?.getAttribute("content");
    const row = { title, description };

    return {
      insert: { row },
    };
  },
};

export default crawler;
