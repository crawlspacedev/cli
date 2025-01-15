import sade from "sade";
import { version } from "../package.json";

import deploy from "./commands/deploy";
import dev from "./commands/dev";
import login from "./commands/login";
import logout from "./commands/logout";
import create from "./commands/new";
import whoami from "./commands/whoami";

const cli = sade("crsp");

cli.version(version);
// .option("--global, -g", "An example global flag")
// .option("-c, --config", "Provide path to custom config", "foo.config.js");

cli
  .command("login")
  .alias("signin", "signup")
  .describe("Log in to the CLI")
  .action(login);

cli
  .command("whoami")
  .describe("Display the email address of the current user")
  .action(whoami);

cli.command("logout").describe("Log out of the CLI").action(logout);

cli.command("--------");

cli
  .command("new")
  .alias("create")
  .describe("Create a crawler and its supporting files")
  .action(async () => {
    try {
      await create();
    } catch (error) {
      console.error(error.message);
    }
  });

cli
  .command("dev")
  // .alias("start", "dev")
  .describe("Run a crawler locally")
  // .example("dev ./src/my-crawler")
  .action(dev);

cli
  .command("deploy [path]")
  .describe("Deploy a crawler to crawlspace.dev")
  // .example("deploy ./src/my-crawler")
  .action(deploy);

export default cli;
