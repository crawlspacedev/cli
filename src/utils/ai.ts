import { HTMLElement } from "linkedom";
import type { NodeHtmlMarkdown } from "node-html-markdown-cloudflare";
import type { ZodObject } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import api from "./api";
import { htmlToMarkdown } from "./markdown";

type ExtractionOptions = {
  model: "meta/llama-3.1-8b" | "meta/llama-3.3-70b";
  instruction: string;
  schema: ZodObject<any>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  seed?: number;
  repetition_penalty?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
};

export default function genAi({ nhm }: { nhm: NodeHtmlMarkdown }) {
  return {
    async extract($el: HTMLElement | string, opts: ExtractionOptions) {
      const text = $el instanceof HTMLElement ? htmlToMarkdown($el, nhm) : $el;
      const schema = zodToJsonSchema(opts.schema, "json_schema").definitions;
      const options = { ...opts, schema };
      const response = await api("/v1/cli/ai/extract", {
        method: "POST",
        body: JSON.stringify({ corpus: text, options }),
      });
      return await response.json();
    },
    async sentiment($el: HTMLElement | string) {
      const text = $el instanceof HTMLElement ? htmlToMarkdown($el, nhm) : $el;
      const response = await api("/v1/cli/ai/sentiment", {
        method: "POST",
        body: JSON.stringify({ corpus: text }),
      });
      return await response.json();
    },
    async summarize($el: HTMLElement | string, opts: ExtractionOptions) {
      const text = $el instanceof HTMLElement ? htmlToMarkdown($el, nhm) : $el;
      const response = await api("/v1/cli/ai/summarize", {
        method: "POST",
        body: JSON.stringify({ corpus: text, options: opts }),
      });
      return await response.json();
    },
    async embed(
      $el: HTMLElement | string | Array<HTMLElement | string>,
      opts: ExtractionOptions,
    ) {
      const text = $el instanceof HTMLElement ? htmlToMarkdown($el, nhm) : $el;
      const response = await api("/v1/cli/ai/embed", {
        method: "POST",
        body: JSON.stringify({ corpus: text, options: opts }),
      });
      return await response.json();
    },
  };
}
