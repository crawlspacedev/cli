import { confirm, input, select } from "@inquirer/prompts";
import fs from "fs";
import { mkdirp } from "mkdirp";
import path from "path";
import { parse as parseToml } from "smol-toml";

import * as templates from "../templates/strings";
import { traverseUp } from "../utils/cwd";
import { validate } from "../utils/validate";

export default async function create() {
  let root = await traverseUp("crawlspace.toml");

  let crawlerDir: string;
  if (!root) {
    root = process.cwd();
    console.log("Welcome to Crawlspace!");
    console.log("First, let's choose a directory to put your crawlers in.");
    console.log("If it doesn't exist yet, it will be created for you.");
    // console.log('Enter "." to select the current directory.');
    const dir = await input({
      message: "Source directory:",
      required: true,
    });
    crawlerDir = dir.trim();

    // TODO: check if dir already exists, and warn if so
    if (fs.existsSync(crawlerDir) && fs.readdirSync(crawlerDir).length > 0) {
      console.log("It's recommended to choose a new / empty directory.");
      console.log("Otherwise, some existing files may get overwritten.");
      console.log(`Are you sure you want to continue with ${crawlerDir} ?`);
      const isConfirmed = await confirm({ message: "Continue?" });
      if (!isConfirmed) {
        console.log("Exited with no changes to disk.");
        return;
      }
    }

    try {
      mkdirp.sync(crawlerDir);
    } catch (error) {
      throw error;
    }
    fs.writeFileSync("crawlspace.toml", `dir = "${crawlerDir}"`, "utf-8");
  } else {
    const toml = fs.readFileSync(path.join(root, "crawlspace.toml"), "utf-8");
    const { dir } = parseToml(toml);
    crawlerDir = path.join(root, dir as string);
  }

  const name = await input({
    message: "Crawler name:",
    required: true,
    validate: (input: string) => validate(input, crawlerDir),
  });

  const description = await input({
    message: "Brief description:",
    required: true,
  });

  const lang = await select({
    message: "Crawler language:",
    choices: [
      {
        name: "TypeScript (recommended)",
        value: "typescript",
      },
      {
        name: "JavaScript",
        value: "javascript",
      },
    ],
  });

  const gitignorePath = path.join(root, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes(".crawlspace")) {
      fs.appendFileSync(gitignorePath, "\n.crawlspace/", "utf-8");
    }
  } else {
    const gitignoreContent = ".crawlspace/\n.DS_Store\n.env\nnode_modules/\n";
    fs.writeFileSync(gitignorePath, gitignoreContent, "utf-8");
  }

  // TODO: be more careful here
  // const dotenvFilePath = path.join(crawlerDir, ".env");
  // fs.writeFileSync(dotenvFilePath, "CRAWLSPACE_API_TOKEN=", "utf-8");

  if (lang === "typescript") {
    // overwrite if already exists
    const tsdefFilePath = path.join(crawlerDir, "crawlspace.d.ts");
    fs.writeFileSync(tsdefFilePath, templates.tsdef, "utf-8");

    // warn if different tsconfig.json file found
    const tsconfigFilePath = path.join(crawlerDir, "tsconfig.json");
    if (fs.existsSync(tsconfigFilePath)) {
      const tsconfig = fs.readFileSync(tsconfigFilePath, "utf-8");
      if (templates.tsconfig !== tsconfig) {
        console.warn("Warning: pre-existing tsconfig.json found. Overwrite?");
      }
    } else {
      // happy path
      fs.writeFileSync(tsconfigFilePath, templates.tsconfig, "utf-8");
    }
  }

  mkdirp.sync(path.join(crawlerDir, name));

  const configFilePath = path.join(crawlerDir, name, "crawler.toml");
  fs.writeFileSync(configFilePath, templates.configToml(name), "utf-8");

  const ext = lang === "typescript" ? "ts" : "js";
  const mainFilePath = path.join(crawlerDir, name, `main.${ext}`);
  fs.writeFileSync(mainFilePath, templates.crawlerTemplate, "utf-8");

  const readmeFilePath = path.join(crawlerDir, name, "README.md");
  fs.writeFileSync(readmeFilePath, templates.readme(description), "utf-8");

  // TODO: open main.ts in $EDITOR ?

  const relativePath = path.relative(".", path.join(crawlerDir, name));
  console.log();
  console.log(`Created crawler "${name}" at ${relativePath}`);
  console.log();
  console.log("Next:");
  console.log(`      cd ${relativePath}`);
  console.log(`      crsp run`);
  console.log(`      crsp deploy`);
  console.log();
}
