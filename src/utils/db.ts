import { z, ZodObject } from "zod";

export function tableSafe(tableName: string): string {
  return `${tableName.replace(/-/g, "_")}_data`;
}

export function zodToSqlStatement(
  tableName: string,
  schema: z.ZodObject<any>,
): string {
  const sqlParts: string[] = [
    "id INTEGER PRIMARY KEY AUTOINCREMENT",
    "url TEXT NOT NULL",
    "created_at TEXT DEFAULT (datetime('now'))",
  ];

  for (const [key, value] of Object.entries(schema.shape)) {
    let sqlType: string;
    let constraints: string[] = [];

    if (value instanceof z.ZodString) {
      sqlType = "TEXT";
    } else if (value instanceof z.ZodNumber) {
      sqlType = "REAL";
    } else if (value instanceof z.ZodBoolean) {
      sqlType = "INTEGER"; // Boolean represented as INTEGER in SQLite
    } else if (value instanceof z.ZodDate) {
      sqlType = "TEXT";
    } else if (value instanceof z.ZodEnum) {
      sqlType = "TEXT";
    } else if (value instanceof z.ZodArray) {
      sqlType = "TEXT"; // Store as JSON string
    } else if (value instanceof z.ZodObject) {
      sqlType = "TEXT"; // Store as JSON string
    } else {
      sqlType = "TEXT"; // Default to TEXT for unknown types
    }

    if (value.isOptional() || value.isNullable()) {
      constraints.push("NULL");
    } else {
      constraints.push("NOT NULL");
    }

    if (value instanceof z.ZodBoolean) {
      constraints.push("CHECK (" + key + " IN (0, 1))"); // Ensure boolean values are 0 or 1
    }

    sqlParts.push(`${key} ${sqlType} ${constraints.join(" ")}`);
  }

  return `CREATE TABLE IF NOT EXISTS ${tableSafe(tableName)} (${sqlParts.join(", ")});`;
}
