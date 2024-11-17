import { build } from "esbuild";
import path from "path";

import { traverseUp } from "../utils/cwd";

export default async function bundle(
  name: string,
  entryPath: string,
): Promise<string> {
  const root = await traverseUp("crawlspace.toml");
  if (!root) {
    console.error("Could not find crawlspace.toml up file tree.");
    console.log("Please initialize with `crsp new`");
    return;
  }

  const outfile = path.join(root, ".crawlspace", "bundle", `${name}.mjs`);
  try {
    await build({
      entryPoints: [entryPath],
      bundle: true,
      outfile,
      platform: "node",
      target: "esnext",
      format: "esm",
      external: ["@crawlspace/cli"],
      drop: ["console", "debugger"],
      minify: true,
      sourcemap: false,
    });
    return outfile;
  } catch (error) {
    console.error(error);
    throw new Error(error);
  }
}
