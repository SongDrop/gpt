import * as vscode from "vscode";
import { OpenAI } from "./openaiClient";
import { DiffView } from "./diffView";
import { CodeImprovementResponse } from "./types";

class ExtensionState {
  private static instance: ExtensionState;
  private _isProcessing = false;

  private constructor() {}

  static getInstance(): ExtensionState {
    if (!ExtensionState.instance) {
      ExtensionState.instance = new ExtensionState();
    }
    return ExtensionState.instance;
  }

  get isProcessing(): boolean {
    return this._isProcessing;
  }

  set isProcessing(value: boolean) {
    this._isProcessing = value;
    vscode.commands.executeCommand(
      "setContext",
      "codeImprove.isProcessing",
      value
    );
  }
}

export async function activate(context: vscode.ExtensionContext) {
  console.log("🔵 Code Improve extension activating...");

  // Initialize components
  const state = ExtensionState.getInstance();
  const openai = new OpenAI();
  const diffView = new DiffView(context);

  // Debug: Check existing commands before registration
  const preCommands = await vscode.commands.getCommands();
  console.log(
    "🔵 Pre-registration commands:",
    preCommands.filter((c) => c.includes("codeImprove"))
  );

  // Enhanced command registration with verification
  const registerVerifiedCommand = async (
    command: string,
    handler: () => Promise<void>
  ) => {
    try {
      const disposable = vscode.commands.registerCommand(command, async () => {
        if (state.isProcessing) {
          vscode.window.showWarningMessage(
            "Please wait for current operation to complete"
          );
          return;
        }
        state.isProcessing = true;
        try {
          await handler();
        } finally {
          state.isProcessing = false;
        }
      });

      context.subscriptions.push(disposable);

      // Verify registration
      const postCommands = await vscode.commands.getCommands();
      if (!postCommands.includes(command)) {
        throw new Error(`Command ${command} failed to register`);
      }

      console.log(`✅ Successfully registered command: ${command}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to register ${command}:`, error);
      vscode.window.showErrorMessage(
        `Failed to register ${command}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  };

  // Core improvement function
  const improveCode = async (selectionOnly: boolean): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error("No active text editor");
    }

    const { document, selection } = editor;
    const code = selectionOnly
      ? document.getText(selection)
      : document.getText();
    if (!code.trim()) {
      throw new Error(selectionOnly ? "No code selected" : "File is empty");
    }

    const instructions = await vscode.window.showInputBox({
      prompt: "How would you like to improve this code?",
      placeHolder: "Refactor for readability and performance...",
      validateInput: (input) =>
        input.trim().length < 10
          ? "Please provide more detailed instructions"
          : null,
    });

    if (!instructions) return;

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Code Improve: Processing",
        cancellable: true,
      },
      async (progress, token) => {
        try {
          // Phase 1: Preparation
          progress.report({ message: "Preparing request..." });
          token.onCancellationRequested(() => {
            throw new Error("Operation cancelled by user");
          });

          // Phase 2: API Processing
          progress.report({ message: "Analyzing code...", increment: 20 });
          const response = await Promise.race<CodeImprovementResponse>([
            openai.improveCode({
              original_code: code,
              instructions,
              language: document.languageId,
              generate_full_code: true,
            }),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Request timed out after 30 seconds")),
                30000
              )
            ),
          ]);

          // Phase 3: Display Results
          progress.report({ message: "Preparing results...", increment: 80 });
          diffView.showDiff({
            original: code,
            improved: response.improved_code,
            language: document.languageId,
            fileName: document.fileName.split("/").pop() || "code",
            explanation: response.explanation,
            changedLines: response.changed_lines,
          });

          progress.report({ message: "Done!", increment: 100 });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Improvement failed: ${message}`);
          throw error;
        }
      }
    );
  };

  // Register commands with verification
  const commandsToRegister = [
    { name: "codeImprove.improve", handler: () => improveCode(false) },
    { name: "codeImprove.improveSelection", handler: () => improveCode(true) },
    {
      name: "codeImprove.applyChanges",
      handler: async () => {
        try {
          await diffView.applyChanges();
        } catch (error) {
          console.error("Failed to apply changes:", error);
        }
      },
    },
  ];

  const registrationResults = await Promise.all(
    commandsToRegister.map((cmd) =>
      registerVerifiedCommand(cmd.name, cmd.handler)
    )
  );

  if (!registrationResults.every(Boolean)) {
    vscode.window.showErrorMessage(
      "Some commands failed to register. See console for details."
    );
  }

  // Final verification
  setTimeout(async () => {
    const postCommands = await vscode.commands.getCommands();
    console.log(
      "🔵 All registered commands:",
      postCommands.filter((c) => c.includes("codeImprove"))
    );
  }, 2000);

  // Set initial state
  vscode.commands.executeCommand(
    "setContext",
    "codeImprove.isProcessing",
    false
  );
  console.log("✅ Code Improve extension activated");
}

export function deactivate() {
  console.log("🟡 Code Improve extension deactivated");
}
