import fs from "fs";
import { parse as parseToml } from "smol-toml";

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

  // TODO: compare schema against crawler's d1 table_info to add/remove columns
  // console.log(`Validating schema...`);
  // try {
  //   const { result } = await api(`/v1/pragma/${config.name}`);
  //   console.log(result[0].results);
  // } catch (error) {
  //   console.error(error);
  // }

  const entryPath = await getEntryPath(config, pathArg);
  const bundlePath = await bundle(config.name, entryPath);
  const bundleContent = fs.readFileSync(bundlePath, "utf-8");
  const source = fs.readFileSync(entryPath, "utf-8");
  const readme = await readSourceFile("README.md", pathArg);

  console.log(`Deploying ${config.name}...`);
  let crawlerUrl = "";
  try {
    const json = await api("/v1/crawler", {
      method: "PUT",
      body: JSON.stringify({
        bundle: bundleContent,
        config,
        readme,
        source,
      }),
    });
    crawlerUrl = json.crawler_url;
  } catch (error) {
    console.error(error);
    throw error;
  }

  console.log(`Initializing ${config.name}...`);
  await sleep(2500); // hacky workaround for race condition to user worker
  try {
    await api(`/v1/crawler/${config.name}/dispatch/schedule`, {
      method: "POST",
    });
  } catch (error) {
    console.error(error);
    throw error;
  }

  console.log(`✨ Successfully deployed ${crawlerUrl}`);
}
