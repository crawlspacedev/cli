export const readme = (name: string) => `# ${name}`;

export const configToml = (
  name: string,
) => `# Name of your crawler. Keep as unique for your user.
name = "${name}"

# Path to the entrypoint of your crawler.
entry = "./main.ts"

# How often your crawler runs.
# Set to \`@manual\` to only trigger manually.
# Accepts valid crontab syntax and shorthand expressions.
# Crawlers can run at most once per minute.
# Go to https://cron-ai.vercel.app for help generating a cron expression.
# Crontab syntax examples:
#         *               *                *                   *              *
#   [minute (0-59)] [hour (0-23)] [day of month (1-31)] [month (1-12)] [weekday (0-7)]
#         *               *                *                   *              *
#   schedule = "*/10 * * * *"  # every 10 minutes
#   schedule = "45 23 * * *"   # every day at 11:45pm UTC
#   schedule = "30 12 * * 2"   # every Tuesday at 12:30pm UTC
#   schedule = "59 1 14 3 *"   # every March 14 at 1:59am UTC
# Valid shorthand examples:
#   schedule = "@hourly"       # -> 0 * * * * (every hour at the beginning of the hour)
#   schedule = "@daily"        # -> 0 0 * * * (every day at midnight)
#   schedule = "@weekly"       # -> 0 0 * * 0 (every week at midnight on Sunday)
#   schedule = "@monthly"      # -> 0 0 1 * * (every month at midnight on the first of the month)
schedule = "@manual"

# Maximum number of pages to request per crawler run.
# Does not include retries.
maxPagesPerCrawl = 10000
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
  seed: (seedProps: {
    select: ({
      from,
      fields,
      where,
      orderBy,
      limit,
    }: {
      from: string;
      fields: string[];
      where?: Array<{ field: string; operator: "="; value: string }>;
      orderBy?: Record<string, "ASC" | "DESC">;
      limit?: number;
    }) => Promise<Record<string, any>[]>;
  }) => string[] | Promise<string[]>;
  handler: (handlerProps: {
    $: <T>(querySelector: string) => HTMLElement | null;
    $$: <T>(querySelector: string) => Array<T>;
    toMarkdown: (querySelector?: string) => string;
    json?: any;
    request: Request;
    response: Response;
    logger: Console;
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
