interface Crawler {
  config: {
    maxPagesPerCrawl: number;
    schedule: string;
    avoidHosts?: string[];
    avoidTLDs?: string[];
    avoidExtensions?: string[];
  };
  seed: () => string[] | Promise<string[]>;
  handler: (handlerProps: {
    $: <T>(querySelector: string) => HTMLElement | null;
    $$: <T>(querySelector: string) => Array<T>;
    toMarkdown: (querySelector?: string) => string;
    json?: any;
    request: Request;
    response: Response;
  }) => {
    data?: Record<string, string | number | boolean | null>;
    enqueue?: string[];
  };
  schema: ({ z }) => any;
}
