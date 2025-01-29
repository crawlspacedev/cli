const crawler: Crawler = {
  async init({ search }) {
    // return an array of URLs,
    // or use the `search()` function to search the web
    return await search("example search query");
  },

  schema({ z }) {
    return z.object({
      // describing a field as unique allows `onConflict` to upsert
      url: z.string().describe("unique"),
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
      upsert: { row, onConflict: "url" },
    };
  },
};

export default crawler;
