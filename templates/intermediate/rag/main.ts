export default {
  init() {
    return ["https://docs.example.com"];
  },
  schema({ z }) {
    return z.object({
      title: z.string(),
      description: z.string(),
      // describing a field as unique allows `onConflict` to upsert
      url: z.string().describe("unique"),
    });
  },
  async onResponse({ $, $$, enqueue, ai, getMarkdown }) {
    // scrape basic page details with query selectors
    const row = {
      title: $("head > title")?.innerText,
      description: $("meta[name='description']")?.getAttribute("content"),
    };

    // convert the page's html to markdown
    const markdown = getMarkdown();
    const { embeddings } = await ai.embed(markdown, { dimensions: 768 });

    // get the URL of every link on the page to continue traversal
    enqueue($$("a[href]"));

    // upsert into sqlite and vector db, and upload markdown to bucket
    return {
      upsert: { row, onConflict: "url", embeddings },
      attach: { content: markdown },
    };
  },
} as Crawler;
