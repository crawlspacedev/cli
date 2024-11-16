const crawler: Crawler = {
  schema({ z }) {
    return z.object({
      url: z.string().describe("unique"),
      title: z.string(),
      description: z.string(),
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
      upsert: { title, description },
      onConflict: "url", // make sure this column is described as unique in your schema!
      enqueue: links,
    };
  },
};

export default crawler;
