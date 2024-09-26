import fs from "fs";
import { parse as parseToml } from "smol-toml";

import { getCrawlerToken, getEntryPath, readSourceFile } from "../utils/cwd";
import bundle from "../utils/bundle";

export default async function deploy(pathArg?: string) {
  try {
    var token = await getCrawlerToken();
  } catch (err) {
    console.error(err);
    return;
  }
  if (!token) {
    console.log("Please log in with `crsp login`");
    return;
  }

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

  console.log(`Deploying ${config.name} to crawlspace...`);
  try {
    const url = `https://api.crawlspace.workers.dev/v1/deploy`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bundle: bundleContent,
        config,
        readme,
        source,
      }),
    });
    if (!response.ok) {
      console.error(response.status, response.statusText);
      console.log(await response.text());
      return;
    }
    const json = await response.json();
    console.log(json);
  } catch (error) {
    console.error(error);
  }
}
