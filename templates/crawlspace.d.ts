type Row = Record<string, string | number | boolean | Date | null | undefined>;

type URLRequest = string | ({ url: string } & RequestInit);

type Handler = {
  insert?: {
    row: Row;
    embeddings?: number[][];
  };
  upsert?: {
    row: Row;
    onConflict: string;
    embeddings?: number[][];
  };
  attach?: {
    content: ArrayBuffer | Blob | string;
    key?: string;
    metadata?: Record<string, string>;
  };
};

interface Crawler {
  schema: ({ z }) => any;
  init: (seedProps: {
    env: Record<string, string>;
    search: (query: string) => Promise<string[]>;
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
  }) => URLRequest[] | Promise<URLRequest[]>;
  onResponse: (handlerProps: {
    $: <T>(querySelector: string) => HTMLElement | null;
    $$: <T>(querySelector: string) => Array<T>;
    ai: {
      embed: (
        $el: HTMLElement | string | Array<HTMLElement | string>,
        opts: { dimensions: number },
      ) => Promise<{ embeddings: number[][] }>;
      extract: <T>(
        $el: HTMLElement | string,
        options: {
          model: "meta/llama-3.1-8b" | "meta/llama-3.3-70b";
          instruction: string;
          schema: any;
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
    };
    enqueue: (
      reqs: URLRequest | HTMLElement | Array<URLRequest | HTMLElement>,
    ) => void;
    env: Record<string, string>;
    getMarkdown: (querySelector?: string) => string;
    json?: any;
    request: Request;
    response: Response;
    logger: Console;
    xml?: any;
    z: any;
  }) => Handler | Promise<Handler>;
}
