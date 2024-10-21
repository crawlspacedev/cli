interface Crawler {
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
}
