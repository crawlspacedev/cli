import { parseHTML } from "linkedom";
import type { HTMLElement, NodeList } from "linkedom";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";

import bundle from "../utils/bundle";
import { getEntryPath, readSourceFile, traverseUp } from "../utils/cwd";
import { tableSafe, zodToSqlStatement } from "../utils/db";
import { permitUrls, randomHeaders } from "../utils/helpers";

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

  const urls = (await seed()) as string[];
  const permittedUrls = permitUrls(null, urls, config);
  const messages = permittedUrls.map((url) => ({ body: { url }, attempts: 0 }));

  const enqueued = new Set(urls);
  const visited = new Set();
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
    let response;
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
    let json;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.startsWith("text/html")) {
      const html = await response.text();
      const document = parseHTML(html).document;
      $ = (qs: string): HTMLElement => document.querySelector(qs);
      $$ = (qs: string): NodeList => document.querySelectorAll(qs);
    } else if (contentType.startsWith("application/json")) {
      json = await response.json();
    } else {
      // TODO: remove continue here?
      continue;
    }

    // run user code
    const handlerProps = { $, $$, json, request, response };
    const { data, enqueue: links } = await handler(handlerProps);

    // save data in R2 / D1
    if (data) {
      const now = new Date().toISOString();
      const columns = ["url_hostname", "url"].concat(Object.keys(data));
      const values = [hostname, url].concat(
        Object.values(data).map((v) => (v === undefined ? null : v)),
      );
      const sql = `INSERT INTO ${tableSafe(config.name)} (${columns.join(", ")})
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
    const permittedLinks = permitUrls(url, links, config);
    if (permittedLinks.length > 0) {
      for (const link of permittedLinks) {
        if (!enqueued.has(link) && !visited.has(link)) {
          enqueued.add(link);
          messages.push({ body: { url: link }, attempts: 0 });
        }
      }
    }
  }
}
