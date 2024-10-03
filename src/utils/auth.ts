import fs from "fs";
import { decodeJwt } from "jose";
import os from "os";
import { mkdirp } from "mkdirp";
import path from "path";

type Session = {
  access_token: string;
  refresh_token: string;
};

type JWT = {
  sub: string;
  email: string;
};

export function getAuthTokens(): Session {
  try {
    const homePath = path.join(os.homedir(), ".crawlspace", "config.json");
    const homeConfig = fs.readFileSync(homePath, "utf-8");
    const { access_token, refresh_token } = JSON.parse(homeConfig);
    if (!access_token || !refresh_token) {
      throw "Please log in with `crsp login`";
    }
    return { access_token, refresh_token };
  } catch (err) {
    throw "Please log in with `crsp login`";
  }
}

export function setAuthTokens(session: Session): JWT {
  if (!session) {
    throw "No session provided";
  }
  try {
    const configDir = path.join(os.homedir(), ".crawlspace");
    mkdirp.sync(configDir);
    const filePath = path.join(configDir, "config.json");
    const sessionContent = JSON.stringify(session, null, 2);
    fs.writeFileSync(filePath, sessionContent, "utf8");
    return decodeJwt(session.access_token);
  } catch (error) {
    throw error;
  }
}
