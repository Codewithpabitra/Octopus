import fs from "fs/promises";
import path from "path";
import os, { platform } from "os";

// ── Expand ~ to home directory

function expandHome(filePath: string): string {
  const home = os.homedir();

  if (platform() === "win32") {
    return filePath
      .replace(/^~[/\\]/, home + "\\")
      .replace(/^~$/, home)
      .replace(/%USERPROFILE%/gi, home)
      .replace(/\//g, "\\");
  }

  return filePath.replace(/^~\//, home + "/").replace(/^~$/, home);
}

// ── Result type

export interface FileResult {
  success: boolean;
  output: string;
  message: string;
}

// ── Operations

async function readFile(filePath: string): Promise<FileResult> {
  try {
    const resolved = expandHome(filePath);
    const content = await fs.readFile(resolved, "utf-8");
    return {
      success: true,
      output: content.trimEnd(),
      message: `Read file: ${filePath}`,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return {
      success: false,
      output: "",
      message: `Could not read file: ${error.message ?? "unknown error"}`,
    };
  }
}

async function writeFile(
  filePath: string,
  content: string,
): Promise<FileResult> {
  try {
    const resolved = expandHome(filePath);

    // Create parent directories if they don't exist
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf-8");

    return {
      success: true,
      output: "",
      message: `Written to: ${filePath}`,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return {
      success: false,
      output: "",
      message: `Could not write file: ${error.message ?? "unknown error"}`,
    };
  }
}

async function listDirectory(dirPath: string): Promise<FileResult> {
  try {
    const resolved = expandHome(dirPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });

    if (entries.length === 0) {
      return {
        success: true,
        output: "(empty directory)",
        message: `Listed: ${dirPath}`,
      };
    }

    // Folders first, then files, both alphabetically
    const folders = entries
      .filter((e) => e.isDirectory())
      .map((e) => `📁  ${e.name}/`)
      .sort();

    const files = entries
      .filter((e) => e.isFile())
      .map((e) => `📄  ${e.name}`)
      .sort();

    const output = [...folders, ...files].join("\n");

    return {
      success: true,
      output,
      message: `Listed: ${dirPath}`,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return {
      success: false,
      output: "",
      message: `Could not list directory: ${error.message ?? "unknown error"}`,
    };
  }
}

async function searchFiles(
  dirPath: string,
  query: string,
): Promise<FileResult> {
  try {
    const resolved = expandHome(dirPath);

    // Recursive file walker
    async function walk(dir: string): Promise<string[]> {
      const results: string[] = [];

      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        // Skip folders we don't have permission to read (Windows protected dirs)
        return results;
      }

      for (const entry of entries) {
        // Skip hidden folders, node_modules, and Windows system folders
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "AppData" ||
          entry.name === "Application Data" ||
          entry.name === "Local Settings"
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const nested = await walk(fullPath);
          results.push(...nested);
        } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push(fullPath);
        }
      }

      return results;
    }

    const matches = await walk(resolved);

    if (matches.length === 0) {
      return {
        success: true,
        output: `No files found matching "${query}"`,
        message: `Search complete in: ${dirPath}`,
      };
    }

    const output = matches.map((f) => f.replace(os.homedir(), "~")).join("\n");

    return {
      success: true,
      output,
      message: `Found ${matches.length} file(s) matching "${query}"`,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return {
      success: false,
      output: "",
      message: `Search failed: ${error.message ?? "unknown error"}`,
    };
  }
}

// ── Main executor

export async function executeFile(
  params: Record<string, string>,
): Promise<FileResult> {
  const { operation, path: filePath, content, query } = params;

  switch (operation) {
    case "read":
      if (!filePath) {
        return {
          success: false,
          output: "",
          message: "No file path provided.",
        };
      }
      return readFile(filePath);

    case "write":
      if (!filePath || !content) {
        return {
          success: false,
          output: "",
          message: "Path and content are required for write.",
        };
      }
      return writeFile(filePath, content);

    case "list":
      return listDirectory(filePath ?? "~");

    case "search":
      if (!query) {
        return {
          success: false,
          output: "",
          message: "No search query provided.",
        };
      }
      return searchFiles(filePath ?? "~", query);

    default:
      return {
        success: false,
        output: "",
        message: `Unknown file operation: ${operation}`,
      };
  }
}
