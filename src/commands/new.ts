import { confirm, input, select } from "@inquirer/prompts";
import fs from "fs";
import { mkdirp } from "mkdirp";
import path, { dirname } from "path";
import { parse as parseToml } from "smol-toml";
import { fileURLToPath } from "url";

import { traverseUp } from "../utils/cwd";
import { validate } from "../utils/validate";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

  const template = await select({
    message: "Template:",
    choices: [
      {
        name: "Basics > Inserting data",
        value: "insert",
      },
      {
        name: "Basics > Upserting data",
        value: "upsert",
      },
    ],
  });

  const lang = await select({
    message: "Language:",
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
    const tsdefTemplate = fs.readFileSync(
      path.resolve(__dirname, "..", "templates", "crawlspace.d.ts"),
      "utf-8",
    );
    const tsdefFilePath = path.join(crawlerDir, "crawlspace.d.ts");
    fs.writeFileSync(tsdefFilePath, tsdefTemplate, "utf-8");

    // warn if different tsconfig.json file found
    const tsconfigFilePath = path.join(crawlerDir, "tsconfig.json");
    if (fs.existsSync(tsconfigFilePath)) {
      // const tsconfig = fs.readFileSync(tsconfigFilePath, "utf-8");
      // if (templates.tsconfig !== tsconfig) {
      //   console.warn("Warning: pre-existing tsconfig.json found. Overwrite?");
      // }
    } else {
      // happy path
      const tsconfigTemplate = fs.readFileSync(
        path.resolve(__dirname, "..", "templates", "tsconfig.json"),
        "utf-8",
      );
      fs.writeFileSync(tsconfigFilePath, tsconfigTemplate, "utf-8");
    }
  }

  mkdirp.sync(path.join(crawlerDir, name));

  const configTomlTemplate = fs
    .readFileSync(
      path.resolve(__dirname, "..", "templates", "crawler.toml"),
      "utf-8",
    )
    .replace("my-first-crawler", name);
  const configFilePath = path.join(crawlerDir, name, "crawler.toml");
  fs.writeFileSync(configFilePath, configTomlTemplate, "utf-8");

  const ext = lang === "typescript" ? "ts" : "js";
  let mainTemplate = fs.readFileSync(
    path.resolve(__dirname, "..", "templates", "examples", `${template}.ts`),
    "utf-8",
  );
  if (lang === "javascript") {
    mainTemplate = mainTemplate.replace(": Crawler", "");
  }
  const mainFilePath = path.join(crawlerDir, name, `main.${ext}`);
  fs.writeFileSync(mainFilePath, mainTemplate, "utf-8");

  const readmeTemplate = fs
    .readFileSync(
      path.resolve(__dirname, "..", "templates", "README.md"),
      "utf-8",
    )
    .replace("$description", description);
  const readmeFilePath = path.join(crawlerDir, name, "README.md");
  fs.writeFileSync(readmeFilePath, readmeTemplate, "utf-8");

  const dotenvTemplate = fs.readFileSync(
    path.resolve(__dirname, "..", "templates", "env.env"),
    "utf-8",
  );
  const dotenvFilePath = path.join(crawlerDir, name, ".env");
  fs.writeFileSync(dotenvFilePath, dotenvTemplate, "utf-8");

  // TODO: if $EDITOR is defined, open main.ts in $EDITOR

  const relativePath = path.relative(".", path.join(crawlerDir, name));
  console.log();
  console.log(`Created crawler "${name}" at ${relativePath}`);
  console.log();
  console.log("Next:");
  console.log(`      cd ${relativePath}`);
  console.log(`      crsp dev`);
  console.log(`      crsp deploy`);
  console.log();
}
