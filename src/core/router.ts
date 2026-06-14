import { ParsedIntent } from "./intentParser.js";
import { executeShell } from "../tentacles/shell.js";
import { executeFile } from "../tentacles/file.js";

// ── Unified result type 
export interface ExecuteResult {
  success: boolean;
  output: string;
  message: string;
}

// ── Router 
export async function execute(intent: ParsedIntent): Promise<ExecuteResult> {
  switch (intent.action) {
    case "shell": {
      const command = intent.params["command"];
      if (!command) {
        return {
          success: false,
          output: "",
          message: "No command found in parsed intent.",
        };
      }
      return executeShell(command);
    }

    case "file": {
      return executeFile(intent.params);
    }

    case "email": {
      // Coming in — email tentacle
      return {
        success: false,
        output: "",
        message: "Email tentacle not wired yet — coming in",
      };
    }

    case "unknown":
    default: {
      return {
        success: false,
        output: "",
        message: "Unknown action — nothing to execute.",
      };
    }
  }
}
