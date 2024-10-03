import { findUp, pathExists } from "find-up";
import fs from "fs";
import path from "path";

export async function traverseUp(fileName: string): Promise<string | null> {
  let root = await findUp(
    async (dir) => {
      const hasTomlFile = await pathExists(path.join(dir, fileName));
      return hasTomlFile && dir;
    },
    { type: "directory" },
  );
  return root;
}

export async function getEntryPath(config, pathArg?: string): Promise<string> {
  if (pathArg) {
    return path.join(pathArg, config.entry);
  } else {
    const cwd = await traverseUp("crawler.toml");
    if (!cwd) {
      console.error("Could not find crawler.toml up file tree.");
      return;
    }
    return path.join(cwd, config.entry);
  }
}

export async function readSourceFile(
  fileName: string,
  pathArg?: string,
): Promise<string | undefined> {
  let filePath = "";
  if (pathArg) {
    filePath = path.join(process.cwd(), pathArg, fileName);
  } else {
    const cwd = await traverseUp("crawler.toml");
    if (cwd) {
      filePath = path.join(cwd, fileName);
    }
  }
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf-8");
  } else {
    console.warn(`Could not find ${fileName} up file tree.`);
  }
}

// export async function setHomeConfig(config: Record<string, string>) {
//   try {
//     const homePath = path.join(os.homedir(), ".crawlspace", "config.json");
//     const homeConfig = JSON.parse(fs.readFileSync(homePath, "utf-8"));
//     const newConfig = { ...homeConfig, ...config };
//     fs.writeFileSync(homePath, JSON.stringify(newConfig, null, 2), "utf-8");
//   } catch (error) {
//     throw error;
//   }
// }
