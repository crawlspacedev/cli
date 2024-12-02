type Handler = {
  insert?: Record<string, string | number | boolean | null>;
  upsert?: Record<string, string | number | boolean | null>;
  onConflict?: string;
  enqueue?: Array<string | Request>;
};

type Tool = {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
};

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
  }) => Array<string | Request> | Promise<Array<string | Request>>;
  handler: (handlerProps: {
    $: <T>(querySelector: string) => HTMLElement | null;
    $$: <T>(querySelector: string) => Array<T>;
    ai: {
      extract: <T>(
        $el: HTMLElement | string,
        options: {
          prompt?: string;
          tools?: Array<Tool>;
          temperature?: number;
          max_tokens?: number;
          top_p?: number;
          top_k?: number;
          seed?: number;
          repetition_penalty?: number;
          frequency_penalty?: number;
          presence_penalty?: number;
        },
      ) => Promise<T>;
      sentiment: (
        $el: HTMLElement | string,
      ) => Promise<{ score?: number; label?: string }[]>;
      summarize: (
        $el: HTMLElement | string,
        options?: { max_length: number },
      ) => Promise<{ summary: string }>;
      tool: ({
        name,
        description,
        schema,
      }: {
        name: string;
        description: string;
        schema: any;
      }) => Tool;
    };
    env: Record<string, string>;
    getMarkdown: (querySelector?: string) => string;
    json?: any;
    request: Request;
    response: Response;
    logger: Console;
    z: any;
  }) => Handler | Promise<Handler>;
}
