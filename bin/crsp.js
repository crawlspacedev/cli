#!/usr/bin/env node

import { createRequire } from "module";
import updateNotifier from "update-notifier";

import cli from "../dist/index.js";

// https://github.com/nodejs/node/issues/51347#issuecomment-2111337854
const pkg = createRequire(import.meta.url)("../package.json");

updateNotifier({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 8, // at most once every 8 hours
}).notify();

cli.parse(process.argv);
