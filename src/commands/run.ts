import dotenv from "dotenv";
import { parseHTML } from "linkedom";
import type { HTMLElement, NodeList } from "linkedom";
import { NodeHtmlMarkdown } from "node-html-markdown-cloudflare";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";

import bundle from "../utils/bundle";
import { getEntryPath, readSourceFile, traverseUp } from "../utils/cwd";
import { zodToSqlStatement } from "../utils/db";
import { normalizeRequests, randomHeaders } from "../utils/helpers";

export default async function run(pathArg?: string) {
  const root = await traverseUp("crawlspace.toml");
  if (!root) {
    console.error("Could not find crawlspace.toml up file tree.");
    console.log("Please initialize with `crsp new`");
    return;
  }

  const crawlerToml = await readSourceFile("crawler.toml", pathArg);
  try {
    var config = parseToml(crawlerToml);
  } catch (error) {
    console.error(`Could not parse crawler.toml`, error);
    return;
  }

  const entryPath = await getEntryPath(config, pathArg);
  const bundlePath = await bundle(config.name, entryPath);

  const { seed, handler, schema } = (await import(bundlePath)).default;
  const db = await open({
    filename: path.join(root, ".crawlspace", "database.sqlite"),
    driver: sqlite3.Database,
  });

  const createTableSql = zodToSqlStatement(config.name, schema({ z }));
  try {
    const stmt = await db.prepare(createTableSql);
    await stmt.run();
  } catch (error) {
    console.error(error);
    return;
  }

  const logger = new Proxy(console, {
    get(target, method) {
      if (typeof (target as any)[method] === "function") {
        return (...args: any[]) => {
          (target as any)[method](...args);
        };
      }
      // Otherwise, return the original property (e.g., console.clear)
      return (target as any)[method];
    },
  }) as Console;
  const urls = (await seed()) as string[];
  const permittedUrls = normalizeRequests(
    null,
    urls.map((url) => ({ url })),
    config,
  );
  const messages = permittedUrls.map(({ url }) => ({
    body: { url },
    attempts: 0,
  }));

  const enqueued = new Set(urls);
  const visited = new Set();

  // TODO: ignore certain html tags
  const nhm = new NodeHtmlMarkdown();

  for (const message of messages) {
    if (message.attempts > 3) {
      continue;
    }
    const { url } = message.body as { url: string };
    enqueued.delete(url);
    visited.add(url);
    const { hostname } = new URL(url);
    console.log("[FETCH]", url);

    const headers = randomHeaders(hostname, config);

    // TODO: robots.txt check

    const request = new Request(url, { headers });
    const timeoutDuration = 8000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    let response: Response;
    try {
      response = await fetch(request, { signal: controller.signal });
    } catch (err) {
      console.error(err);
      message.attempts += 1;
      messages.push(message);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response?.ok) {
      console.error(response.headers.entries());
      // TODO: pass in a specific response header here
      // can we delay all messages for a given hostname?
      // if no response header, use exponential backoff
      message.attempts += 1;
      messages.push(message);
      continue;
    }

    let $ = (qs: string) => <HTMLElement | null>null;
    let $$ = (qs: string) => <NodeList | never[]>[];
    let getMarkdown = (qs?: string) => "";
    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("text/html")) {
      const html = await response.text();
      const document = parseHTML(html).document;
      $ = (qs: string): HTMLElement => document.querySelector(qs);
      $$ = (qs: string): NodeList => document.querySelectorAll(qs);
      getMarkdown = (qs?: string): string => {
        const $el = qs ? $(qs) : $("main") || $("body");
        return nhm.translate($el?.innerHTML || "");
      };
    } else if (contentType.startsWith("application/json")) {
      var json = await response.json();
    } else {
      // TODO: remove continue here?
      continue;
    }

    const env = await readSourceFile(".env", pathArg);
    // only pass secrets that begin with `CRAWLSPACE_`
    const secrets = Object.fromEntries(
      Object.entries(env ? dotenv.parse(env) : {}).filter(([key]) =>
        key.startsWith("CRAWLSPACE_"),
      ),
    );

    // run user code
    const handlerProps = {
      $,
      $$,
      env: secrets,
      getMarkdown,
      json,
      request,
      response,
      logger,
      z,
    };
    const { data, enqueue: links } = await handler(handlerProps);

    // save data in R2 / D1
    if (data) {
      const columns = ["url"].concat(Object.keys(data));
      const values = [url].concat(
        Object.values(data).map((v) => (v === undefined ? null : v)),
      );
      const sql = `INSERT INTO [${config.name}] (${columns.join(", ")})
          VALUES (${values.map((c) => "?").join(", ")})`;
      try {
        const stmt = await db.prepare(sql);
        await stmt.bind(...values);
        const { lastID } = await stmt.run();
        console.log(`[WRITE] Saved row ${lastID} to table ${config.name}`);
      } catch (e: any) {
        console.error("[ERROR]", e.message);
      }
    }

    // don't enqueue URLs with certain TLDs / extensions
    const requests = (links || []).map(
      (req: string | ({ url: string } & RequestInit)) => {
        return typeof req === "string" ? { url: req } : req;
      },
    );
    const permittedLinks = normalizeRequests(url, requests, config);
    if (permittedLinks.length > 0) {
      for (const link of permittedLinks) {
        if (!enqueued.has(link.url) && !visited.has(link)) {
          enqueued.add(link.url);
          messages.push({ body: { url: link.url }, attempts: 0 });
        }
      }
    }
  }
}
