import fs from "fs";
import { parse as parseToml } from "smol-toml";

import { getEntryPath, readSourceFile } from "../utils/cwd";
import api from "../utils/api";
import bundle from "../utils/bundle";

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

  console.log(`Deploying ${config.name} to crawlspace...`);
  try {
    const json = await api("/v1/deploy", {
      method: "POST",
      body: JSON.stringify({
        bundle: bundleContent,
        config,
        readme,
        source,
      }),
    });
    console.log(json);
  } catch (error) {
    console.error(error);
  }
}
