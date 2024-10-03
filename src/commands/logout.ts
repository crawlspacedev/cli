import fs from "fs";
import os from "os";
import path from "path";

export default async function logout() {
  const filePath = path.join(os.homedir(), ".crawlspace", "config.json");
  if (!fs.existsSync(filePath)) {
    console.log("Logged out");
    return;
  }

  // TODO: actually log out of session on server

  try {
    fs.unlinkSync(filePath);
    console.log("Logged out");
  } catch (error) {
    console.error("Error logging out:", error);
  }
}
