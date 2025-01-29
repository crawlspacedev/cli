import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import dotenv from "dotenv";
import { XMLParser } from "fast-xml-parser";
import { HTMLElement, parseHTML } from "linkedom";
import { NodeHtmlMarkdown } from "node-html-markdown-cloudflare";
import ora from "ora";
import path from "path";
import { parse as parseToml } from "smol-toml";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { z } from "zod";

import genAi from "../utils/ai";
import api from "../utils/api";
import bundle from "../utils/bundle";
import { getEntryPath, readSourceFile, traverseUp } from "../utils/cwd";
import { alterTableStatement, createTableStatement } from "../utils/db";
import { normalizeRequests } from "../utils/helpers";
import { htmlToMarkdown } from "../utils/markdown";
import { searchFactory } from "../utils/serps";

function statusEmoji(code: number): string {
  if (code >= 200 && code <= 299) {
    return "🟢";
  } else if (code === 480) {
    return "⚪";
  } else if (code === 481) {
    return "🟣";
  } else if (code >= 400 && code <= 499) {
    return "🟠";
  } else {
    return "🔴";
  }
}

type TableInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
};

export default async function dev() {
  const root = await traverseUp("crawlspace.toml");
  if (!root) {
    console.error("Could not find crawlspace.toml up file tree.");
    console.log("Please initialize with `crsp new`");
    return;
  }
  const crawlerToml = await readSourceFile("crawler.toml");
  try {
    var config = parseToml(crawlerToml);
  } catch (error) {
    console.error(`Could not parse crawler.toml`, error);
    return;
  }
  const entryPath = await getEntryPath(config);
  const bundlePath = await bundle(config.name, entryPath);
  const userland = (await import(bundlePath)).default;
  const schema = userland.schema({ z });

  // only pass secrets that begin with `SECRET_`
  const env = await readSourceFile(".env");
  const secrets = Object.fromEntries(
    Object.entries(env ? dotenv.parse(env) : {}).filter(([key]) =>
      key.startsWith("SECRET_"),
    ),
  );

  console.log();
  console.log(`ℹ️  Crawler name: ${config.name}`);
  const sqliteDatabasePath = path.join(root, ".crawlspace", "database.sqlite");
  console.log(
    `🥞 Database location: ${path.relative(".", sqliteDatabasePath)}`,
  );
  // const bucketPath = path.join(root, ".crawlspace", "bucket", config.name);
  // console.log(`🪣 Bucket directory: ${path.relative(".", bucketPath)}`);
  console.log(`🌐 JavaScript rendering not available locally`);
  console.log(`🐢 Local crawls are slow - deploy to speed up!`);
  console.log();

  const isConfirmed = await confirm({ message: "Ready?" });
  if (!isConfirmed) {
    return;
  }

  // create new database if not exists
  const db = await open({
    filename: sqliteDatabasePath,
    driver: sqlite3.Database,
  });
  const createTableSql = createTableStatement(config.name, schema);
  try {
    const stmt = await db.prepare(createTableSql);
    await stmt.run();
  } catch (error) {
    console.error(error);
    return;
  }

  // check that the table pragma matches the schema
  // if it doesn't, run some ALTER statements to add/drop columns
  const tableInfo: TableInfo[] = await db.all(
    `PRAGMA table_info("${config.name}")`,
  );
  const indexList = await db.all(`PRAGMA index_list("${config.name}")`);
  const constraints = { unique: {} as Record<string, string> };
  const uniqueIndexes = indexList.filter((row) => !!row.unique);
  for (const index of uniqueIndexes) {
    const indexInfo = await db.all(`PRAGMA index_info("${index.name}")`);
    constraints.unique[indexInfo[0].name as string] = index.name as string;
  }
  // ready to execute migrations
  try {
    const migration = alterTableStatement(
      config.name,
      schema,
      tableInfo,
      constraints,
    );
    if (migration) {
      console.log(migration);
      await db.run(migration);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }

  const nhm = new NodeHtmlMarkdown();
  console.log(`Initializing crawler...`);
  let localQueue = (
    await userland.init({ env: secrets, search: searchFactory() })
  ).map((item) => (typeof item === "string" ? { url: item } : item));

  let i = 0;
  for (const request of localQueue) {
    i += 1;
    try {
      const spinner = ora({
        spinner: "dots12",
        text: `${chalk.cyan.underline(request.url)}`, // \n   Visited ${i} pages total, ${localQueue.length - i} pages remain\n
      }).start();
      const start = Date.now();
      const response = await api("/v1/cli/dev", {
        method: "POST",
        body: JSON.stringify({ attempt: 1, config, request }),
      });
      const end = Date.now();
      spinner.stop();

      let html = "";
      let $ = (qs: string) => <HTMLElement | null>null;
      let $$ = (qs: string) => <NodeList | never[]>[];
      let getMarkdown = (text: string) => htmlToMarkdown(text, nhm);
      const contentType = response.headers.get("content-type")?.split(";")[0];
      if (contentType.startsWith("text/html")) {
        html = await response.text();
        let document = parseHTML(html).document;
        $ = (qs: string): HTMLElement => document.querySelector(qs);
        $$ = (qs: string): NodeList => document.querySelectorAll(qs);
        getMarkdown = (node?: HTMLElement | string): string => {
          const value = node || $("main") || $("body") || $("html");
          return htmlToMarkdown(value!, nhm);
        };
      } else if (contentType.startsWith("application/json")) {
        var json = await response.json();
      } else if (contentType.startsWith("text/xml")) {
        const parser = new XMLParser();
        var xml = parser.parse(await response.text());
      } else {
        // TODO: should we do something here?
      }

      const { status, statusText, headers } = response;
      const cache = (headers.get("cf-cache-status") || "dynamic").toLowerCase();

      console.log(statusEmoji(status), chalk.cyan.underline(request.url));
      console.log(
        `   > ${status} ${statusText}, cache ${cache}, ${contentType}, ${end - start}ms`,
      );

      // turn any relative hrefs into absolute urls
      const getHref = (href: string): string => new URL(href, request.url).href;
      const newRequests = [];
      const enqueue = (
        queueItems:
          | string // url
          | ({ url: string } & RequestInit)
          | HTMLElement
          | Array<string | ({ url: string } & RequestInit) | HTMLElement>,
      ) => {
        const items = Array.isArray(queueItems) ? queueItems : [queueItems];
        items.forEach((item) => {
          if (typeof item === "string") {
            newRequests.push({ url: getHref(item) });
          } else if (item instanceof HTMLElement) {
            newRequests.push({ url: getHref(item.getAttribute("href")) });
          } else if (typeof item === "object" && item?.url) {
            newRequests.push({ ...item, url: getHref(item.url) });
          }
        });
      };

      const onResponseProps = {
        $,
        $$,
        ai: genAi({ nhm }),
        enqueue,
        env: secrets,
        getMarkdown,
        html,
        json,
        request,
        response,
        xml,
        z,
      };

      // TODO: wrap in try/catch
      const onResponse = await userland.onResponse(onResponseProps);

      // save data in sqlite
      const isSqlInsert = Object.keys(onResponse?.insert?.row || {}).length > 0;
      const isSqlUpsert = Object.keys(onResponse?.upsert?.row || {}).length > 0;
      if (isSqlInsert || isSqlUpsert) {
        const data = isSqlInsert
          ? onResponse?.insert?.row
          : onResponse?.upsert?.row;
        const row = {
          ...data,
          trace_id: [...Array(32)]
            .map(() => Math.floor(Math.random() * 16).toString(16))
            .join(""),
          url: request.url,
        };
        if (isSqlUpsert) {
          const date = new Date();
          const sqliteDate = date.toISOString().slice(0, 19).replace("T", " ");
          row.updated_at = sqliteDate;
        }
        // if (attachmentKey) {
        //   row.atch_key = attachmentKey;
        // }
        const columns = Object.keys(row);
        const values = Object.values(row).map((val) => {
          if (val === undefined) {
            return null;
          }
          if (val instanceof Date) {
            return val.toISOString().slice(0, 19).replace("T", " ");
          }
          return val;
        });
        let sql = `
          INSERT INTO [${config.name}] (${columns.join(", ")})
            VALUES (${values.map((c) => "?").join(", ")})`;
        if (onResponse?.upsert?.onConflict) {
          sql += `
            ON CONFLICT (${onResponse?.upsert.onConflict})
            DO UPDATE SET
              ${columns.map((key) => `${key} = EXCLUDED.${key}`).join(", ")}`;
        }
        try {
          const stmt = await db.prepare(sql, values);
          var { lastID } = await stmt.run();
          console.log(
            `   # ${lastID} row ${isSqlInsert ? "inserted" : "upserted"} into local sqlite db`,
          );
        } catch (error: any) {
          console.error({ error: error.message });
        }
      }

      // console.log(`   > Wrote 8KB to file ./example.com/index.html`);

      const normalizedRequests = normalizeRequests(newRequests, config);
      let j = 0;
      normalizedRequests.forEach((newRequest) => {
        if (!localQueue.find((req) => req.url === newRequest.url)) {
          localQueue.push(newRequest);
          j += 1;
        }
      });
      console.log(`   + ${j} new requests added to local queue`);
      console.log();
    } catch (error) {
      console.error(error);
    }
  }
}
