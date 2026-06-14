import readline from "readline";
import { parseIntent } from "../core/intentParser.js";
import {
  showBanner,
  showPrompt,
  showIntent,
  showSuccess,
  showError,
  showOutput,
  showUnknown,
  showCancelled,
  showGoodbye,
  startSpinner,
  stopSpinner,
  showConfirmPrompt,
} from "./display.js";

// ── Conversation memory (last 10 exchanges) ───────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };
const memory: Message[] = [];

function addToMemory(role: "user" | "assistant", content: string): void {
  memory.push({ role, content });
  if (memory.length > 10) memory.shift();
}

// ── Confirmation gate 

async function confirm(rl: readline.Interface): Promise<boolean> {
  return new Promise((resolve) => {
    showConfirmPrompt();
    rl.once("line", (answer) => {
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

// ── Main loop 

async function main(): Promise<void> {
  showBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // Graceful exit on Ctrl+C
  rl.on("SIGINT", () => {
    showGoodbye();
    process.exit(0);
  });

  const ask = (): void => {
    showPrompt();

    rl.once("line", async (input) => {
      const trimmed = input.trim();

      // Empty input
      if (!trimmed) {
        ask();
        return;
      }

      // Exit commands
      if (["exit", "quit", "bye"].includes(trimmed.toLowerCase())) {
        showGoodbye();
        rl.close();
        process.exit(0);
      }

      // Parse intent via Groq
      startSpinner("Thinking...");
      let intent;
      try {
        intent = await parseIntent(trimmed, memory);
      } catch (err) {
        stopSpinner();
        showError(
          "Failed to reach Groq API. Check your GROQ_API_KEY and internet connection.",
        );
        ask();
        return;
      }
      stopSpinner();

      // Show what Octopus understood
      showIntent(intent.summary, intent.action);

      // Handle unknown
      if (intent.action === "unknown") {
        const reason =
          intent.params["reason"] ?? "Could not understand command.";
        showUnknown(reason);
        addToMemory("user", trimmed);
        addToMemory("assistant", `Could not execute: ${reason}`);
        ask();
        return;
      }

      // Confirmation gate for risky actions
      if (intent.confirmRequired) {
        const approved = await confirm(rl);
        if (!approved) {
          showCancelled();
          ask();
          return;
        }
      }

      // Route to tentacle (coming in Step 9)
      try {
        const { execute } = await import("../core/router.js");
        const result = await execute(intent);

        if (result.success) {
          if (result.output) showOutput(result.output);
          showSuccess(result.message);
        } else {
          showError(result.message);
        }

        addToMemory("user", trimmed);
        addToMemory("assistant", result.message);
      } catch (err) {
        showError("Router not ready yet — build Steps 7-9 first.");
      }

      ask();
    });
  };

  ask();
}

main();
