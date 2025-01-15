import { z, ZodObject } from "zod";

const RESERVED_COLUMN_NAMES = [
  "id",
  "trace_id",
  "atch_key",
  "url",
  "created_at",
  "updated_at",
];

type TableInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
};

function getColumnTypeFromZod(key: string, value: any): string {
  let sqlType = "TEXT";
  if (value instanceof z.ZodNumber) {
    if (value.isInt) {
      sqlType = "INTEGER";
    } else {
      sqlType = "REAL";
    }
  } else if (value instanceof z.ZodBoolean) {
    sqlType = "INTEGER"; // Boolean represented as INTEGER in SQLite
  } else if (value instanceof z.ZodDate) {
    sqlType = "DATETIME";
  }
  return sqlType;
}

function getColumnTypeFromTableInfo(
  key: string,
  info: TableInfo[],
): string | undefined {
  return info.find((row) => row.name === key)?.type;
}

function getConstraintsFromZod(key: string, value: any): string[] {
  let constraints: string[] = [];
  const description = value._def.description?.toLowerCase();
  if (description) {
    if (description.includes("unique")) {
      constraints.push("UNIQUE");
    }
    if (description.includes("primary")) {
      constraints.push("PRIMARY KEY");
    }
    if (description.includes("autoincrement")) {
      constraints.push("AUTOINCREMENT");
    }
    if (description.includes("default now")) {
      constraints.push("DEFAULT (datetime('now'))");
    }
  }
  if (value instanceof z.ZodBoolean) {
    constraints.push("CHECK (" + key + " IN (0, 1))"); // Ensure boolean values are 0 or 1
  }
  return constraints;
}

export function createTableStatement(
  tableName: string,
  schema: ZodObject<any>,
): string {
  const platformSchema = z.object({
    id: z.number().int().describe("primary autoincrement"),
    trace_id: z.string().describe("unique"),
    atch_key: z.string(),
    url: z.string(),
    created_at: z.date().describe("default now"),
    updated_at: z.date().describe("default now"),
  });

  // Merge the shapes, with schema.shape taking precedence over platformSchema.shape
  const mergedSchema = platformSchema.extend(schema.shape);

  const sqlParts: string[] = [];
  for (const [key, value] of Object.entries(mergedSchema.shape)) {
    const sqlType = getColumnTypeFromZod(key, value);
    const constraints = getConstraintsFromZod(key, value);
    sqlParts.push(`${key} ${sqlType} ${constraints.join(" ")}`);
  }

  return `CREATE TABLE IF NOT EXISTS [${tableName}] (${sqlParts.join(", ")});`;
}

export function alterTableStatement(
  tableName: string,
  schema: ZodObject<any>,
  tableInfo: TableInfo[],
  tableConstraints: { unique: Record<string, string> },
): string {
  const statements: string[] = [];
  let expectedColumns = tableInfo
    .map((col) => col.name)
    .filter((name) => !RESERVED_COLUMN_NAMES.includes(name));
  for (const [col, value] of Object.entries(schema.shape)) {
    const schemaType = getColumnTypeFromZod(col, value);
    const tableType = getColumnTypeFromTableInfo(col, tableInfo);
    const schemaConstraints = getConstraintsFromZod(col, value);
    const schemaUnique = schemaConstraints.includes("UNIQUE");
    const uniqueIndex = tableConstraints.unique[col];
    const constraintMismatch =
      (schemaUnique && !uniqueIndex) || (!schemaUnique && uniqueIndex);
    if (!tableType) {
      // col is new, so we should add a new column
      statements.push(
        `ALTER TABLE ${tableName} ADD COLUMN ${col} ${schemaType}`,
      );
      if (schemaUnique) {
        statements.push(
          `CREATE UNIQUE INDEX idx_${tableName}_${col} ON ${tableName}(${col})`,
        );
      }
    } else if (tableType !== schemaType || constraintMismatch) {
      if (RESERVED_COLUMN_NAMES.includes(col)) {
        continue;
      }
      // col type has been modified, or constraints changed, so we should drop and then add
      statements.push(`ALTER TABLE ${tableName} DROP COLUMN ${col}`);
      statements.push(
        `ALTER TABLE ${tableName} ADD COLUMN ${col} ${schemaType}`,
      );
      if (schemaUnique) {
        statements.push(
          `CREATE UNIQUE INDEX idx_${tableName}_${col} ON ${tableName}(${col})`,
        );
      }
    }
    expectedColumns = expectedColumns.filter((k) => k !== col);
  }
  expectedColumns.forEach((col) => {
    // col has been removed from the schema, so we should drop it
    statements.push(`ALTER TABLE ${tableName} DROP COLUMN ${col}`);
  });
  return statements.join(";\n");
}
