import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { platform } from "os";

const execAsync = promisify(exec);

// ── Blocked commands (safety layer)

const BLOCKED = [
  "rm -rf /",
  "rm -rf /*",
  "mkfs",
  "dd if=",
  ":(){:|:&};:",
  "chmod -R 777 /",
  "chown -R",
  "> /dev/sda",
  // Windows specific
  "format c:",
  "del /f /s /q c:\\",
  "rd /s /q c:\\",
  "rmdir /s /q c:\\",
];

function isBanned(command: string): boolean {
  return BLOCKED.some((pattern) =>
    command.toLowerCase().includes(pattern.toLowerCase()),
  );
}

// ── Expand ~ to home directory

function expandHome(command: string): string {
  return command.replace(/~/g, os.homedir());
}

// ── Normalize Unix commands to Windows equivalents
function normalizeCommand(command: string): string {
  if (platform() !== "win32") return command;

  // Map common Unix commands to Windows equivalents
  const map: Record<string, string> = {
    "ls ~": "dir %USERPROFILE%",
    ls: "dir",
    clear: "cls",
    cat: "type",
    touch: "type nul >",
    which: "where",
    whoami: "whoami",
    pwd: "cd",
    cp: "copy",
    mv: "move",
    rm: "del",
  };

  let normalized = command;
  for (const [unix, win] of Object.entries(map)) {
    if (normalized.startsWith(unix)) {
      normalized = normalized.replace(unix, win);
      break;
    }
  }

  return normalized;
}

// ── Execute
export interface ShellResult {
  success: boolean;
  output: string;
  message: string;
}

export async function executeShell(command: string): Promise<ShellResult> {
  // Safety check
  if (isBanned(command)) {
    return {
      success: false,
      output: "",
      message: "Blocked: this command is not allowed for safety reasons.",
    };
  }

  const expanded = expandHome(command);
  const normalized = normalizeCommand(expanded);

  try {
    const { stdout, stderr } = await execAsync(normalized, {
      timeout: 15000, // 15 second timeout
      maxBuffer: 1024 * 512, // 512kb max output
    });

    const output = stdout || stderr;

    return {
      success: true,
      output: output.trimEnd(),
      message: `Command executed: ${command}`,
    };
  } catch (err: unknown) {
    const error = err as { message?: string; stderr?: string };
    const reason = error.stderr ?? error.message ?? "Unknown error";
    return {
      success: false,
      output: "",
      message: `Command failed: ${reason.trimEnd()}`,
    };
  }
}
