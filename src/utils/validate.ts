import fs from "fs";

export function validate(input: string, crawlerDir?: string): string | boolean {
  if (!/^[a-z]/.test(input)) {
    return "Must start with a lowercase letter.";
  }
  if (!/[a-z]$/.test(input)) {
    return "Must end with a lowercase letter.";
  }
  if (/--/.test(input)) {
    return "Must not contain two consecutive hyphens.";
  }
  if (!/^[a-z0-9\-]+$/.test(input)) {
    return "Must contain lowercase letters, numbers, and hyphens only.";
  }
  if (input.length < 3 || input.length > 32) {
    return "Must be between 3 - 32 characters long.";
  }
  if (crawlerDir) {
    // get all the names of directories within `dir`
    const existingCrawlerNames = fs
      .readdirSync(crawlerDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    if (existingCrawlerNames.includes(input)) {
      return `"${input}" already exists in ${crawlerDir}`;
    }
  }
  return true;
}
