const crawler: Crawler = {
  init() {
    return ["https://news.ycombinator.com/newest"];
  },

  schema({ z }) {
    // no sqlite schema needed if only uploading to a bucket
    return z.object({});
  },

  onResponse({ $$, enqueue, getMarkdown }) {
    // get the absolute URL of every link on the page
    const links = $$("a[href^='http']")
      .filter(({ href }) => URL.canParse(href))
      .map(({ href }) => new URL(href).origin);
    enqueue(links);

    // convert the page's HTML to markdown
    const markdown = getMarkdown();
    return {
      attach: { content: markdown },
    };
  },
};

export default crawler;
