import chalk from "chalk";
import dotenv from "dotenv";
import ora from "ora";
import path from "path";
import { parse as parseToml } from "smol-toml";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { z } from "zod";

import api from "../utils/api";
import bundle from "../utils/bundle";
import { getEntryPath, readSourceFile, traverseUp } from "../utils/cwd";
import { zodToSqlStatement } from "../utils/db";

// async function sleep(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

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

  // only pass secrets that begin with `CRAWLSPACE_`
  const env = await readSourceFile(".env");
  const secrets = Object.fromEntries(
    Object.entries(env ? dotenv.parse(env) : {}).filter(([key]) =>
      key.startsWith("CRAWLSPACE_"),
    ),
  );

  console.log();
  console.log(`ℹ️  Starting local crawl using crawler ${config.name}...`);
  const sqliteDatabasePath = path.join(root, ".crawlspace", "database.sqlite");
  console.log(`🥞 SQLite location: ${path.relative(".", sqliteDatabasePath)}`);
  const bucketPath = path.join(root, ".crawlspace", "bucket", config.name);
  console.log(`🪣 Bucket directory: ${path.relative(".", bucketPath)}`);
  console.log(`🐢 Local crawls are slow - deploy to speed up!`);
  console.log();

  // create new database if not exists
  const db = await open({
    filename: sqliteDatabasePath,
    driver: sqlite3.Database,
  });
  const createTableSql = zodToSqlStatement(config.name, userland.schema({ z }));
  try {
    const stmt = await db.prepare(createTableSql);
    await stmt.run();
  } catch (error) {
    console.error(error);
    return;
  }

  const queueItems = await userland.seed();
  for (const item of queueItems) {
    const request = typeof item === "string" ? { url: item } : item;
    try {
      const spinner = ora({
        spinner: "dots12",
        text: request.url,
      }).start();
      const start = Date.now();
      const response = await api("/v1/cli/dev", {
        method: "POST",
        body: JSON.stringify({ attempt: 1, config, request }),
      });
      const end = Date.now();
      spinner.stop();

      const { status, statusText, headers } = response;
      const contentType = headers.get("content-type")?.split(";")[0];

      console.log(statusEmoji(status), chalk.cyan.underline(request.url));
      console.log(
        `   < ${status} ${statusText}, ${contentType}, ${end - start}ms`,
      );

      // const handlerProps = {
      //   $,
      //   $$,
      //   ai: {},
      //   env: secrets,
      //   getMarkdown,
      //   html,
      //   json,
      //   request,
      //   response,
      //   logger: console,
      //   z,
      // };

      // const handler = await userland.handler(handlerProps);

      console.log(`   > Inserted row 123 into local sqlite db`);
      console.log(`   > Wrote 8KB to file ./example.com/index.html`);
      console.log(`   + Enqueued 12 requests to temporary queue`);
      // console.log(`   = Visited 3 pages total, 39 pages remain`);
      console.log();
    } catch (error) {
      console.error(error);
    }
  }

  // console.log(`   Requests enqueued: +12`);
}
