import { exec } from "child_process";
import { promisify } from "util";
import os, { platform } from "os";

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
  if (platform() === "win32") {
    return command
      .replace(/^~[/\\]/, os.homedir() + "\\")
      .replace(/~/g, os.homedir());
  }
  return command.replace(/~/g, os.homedir());
}

// ── Normalize Unix commands to Windows equivalents
function normalizeCommand(command: string): string {
  if (platform() !== "win32") return command;

  // Fix path separators first
  command = command.replace(/~\//g, "%USERPROFILE%\\");
  command = command.replace(/(?<!%)\//g, "\\");

  // Unix -> Windows command map using regex
  const map: [RegExp, string][] = [
    [/^ls\b/, "dir"],
    [/^clear$/, "cls"],
    [/^cat\b/, "type"],
    [/^touch\b/, "type nul >"],
    [/^which\b/, "where"],
    [/^pwd$/, "cd"],
    [/^cp\b/, "copy"],
    [/^mv\b/, "move"],
    [/^rm -rf\b/, "rd /s /q"],
    [/^rm\b/, "del"],
    [/^mkdir\b/, "mkdir"],
    [/^grep\b/, "findstr"],
    [/^echo\b/, "echo"],
    [/^env$/, "set"],
    [/^printenv\b/, "echo"],
  ];

  for (const [pattern, replacement] of map) {
    if (pattern.test(command)) {
      command = command.replace(pattern, replacement);
      break;
    }
  }

  return command;
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
