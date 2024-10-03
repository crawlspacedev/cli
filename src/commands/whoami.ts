import fs from "fs";
import { decodeJwt } from "jose";
import { mkdirp } from "mkdirp";
import os from "os";
import path from "path";

export default async function whoami() {
  const filePath = path.join(os.homedir(), ".crawlspace", "config.json");
  if (!fs.existsSync(filePath)) {
    console.log("Not logged in");
    return;
  }

  const configText = fs.readFileSync(filePath, "utf8");
  const configJson = JSON.parse(configText);
  const { email } = decodeJwt(configJson.access_token);
  if (email) {
    console.log(email);
  } else {
    console.log("Not logged in");
  }
}
