import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

// ── Blocked commands (safety layer)

const BLOCKED = [
  "rm -rf /",
  "rm -rf /*",
  "mkfs",
  "dd if=",
  ":(){:|:&};:", // fork bomb
  "chmod -R 777 /",
  "chown -R",
  "> /dev/sda",
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

  try {
    const { stdout, stderr } = await execAsync(expanded, {
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
