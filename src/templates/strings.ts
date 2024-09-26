export const readme = (name: string) => `# ${name}`;

export const configToml = (name: string) => `name = "${name}"
entry = "./main.ts"

maxPagesPerCrawl = 10000
public = true
schedule = "@daily"
`;

export const crawlerTemplate = `const crawler: Crawler = {
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
`;

export const tsdef = `interface Crawler {
  schema: ({ z }) => any;
  seed: () => string[] | Promise<string[]>;
  handler: (handlerProps: {
    $: <T>(querySelector: string) => HTMLElement | null;
    $$: <T>(querySelector: string) => Array<T>;
    json?: any;
    request: Request;
    response: Response;
  }) => {
    data?: Record<string, string | number | boolean | null>;
    enqueue?: string[];
  };
}`;

export const tsconfig = `{
  "compilerOptions": {
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "lib": ["DOM", "ESNext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "skipLibCheck": true,
    "target": "ESNext",
    "types": ["./crawlspace.d.ts"]
  }
}`;
