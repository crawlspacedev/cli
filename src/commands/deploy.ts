import dotenv from "dotenv";
import fs from "fs";
import { parse as parseToml } from "smol-toml";

import pkgJson from "../../package.json";
import { getEntryPath, readSourceFile } from "../utils/cwd";
import api from "../utils/api";
import bundle from "../utils/bundle";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function deploy(pathArg?: string) {
  const crawlerToml = await readSourceFile("crawler.toml", pathArg);
  try {
    var config = parseToml(crawlerToml);
  } catch (error) {
    console.error(`Could not parse crawler.toml`);
    return;
  }

  const entryPath = await getEntryPath(config, pathArg);
  const bundlePath = await bundle(config.name, entryPath);
  const bundleContent = fs.readFileSync(bundlePath, "utf-8");
  const source = fs.readFileSync(entryPath, "utf-8");
  const readme = await readSourceFile("README.md", pathArg);
  const env = await readSourceFile(".env", pathArg);
  // only pass secrets that begin with `CRAWLSPACE_`
  const secrets = Object.fromEntries(
    Object.entries(env ? dotenv.parse(env) : {}).filter(([key]) =>
      key.startsWith("CRAWLSPACE_"),
    ),
  );

  console.log(`Deploying ${config.name}...`);
  let crawlerUrl = "";
  try {
    const response = await api("/v1/crawler", {
      method: "PUT",
      body: JSON.stringify({
        bundle: bundleContent,
        config,
        secrets,
        readme,
        source,
        cli_version: pkgJson.version,
      }),
    });
    if (!response.ok) {
      throw { status: response.status, statusText: response.statusText };
    }
    const json = await response.json();
    crawlerUrl = json.crawler_url;
  } catch (error) {
    console.error(error);
    return;
  }

  console.log(`Initializing ${config.name}...`);
  await sleep(2500); // hacky workaround for race condition to user worker
  try {
    const response = await api(`/v1/crawler/${config.name}/dispatch/schedule`, {
      method: "POST",
    });
    if (!response.ok) {
      throw { status: response.status, statusText: response.statusText };
    }
  } catch (error) {
    console.error(error);
    return;
  }

  console.log(`✨ Successfully deployed ${crawlerUrl}`);
}
