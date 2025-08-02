import * as vscode from "vscode";
import { AzureOpenAIClient } from "./openaiClient";
import { DiffView } from "./diffView";

export function activate(context: vscode.ExtensionContext) {
  const openai = new AzureOpenAIClient();
  const diffView = new DiffView(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("codeImprove.improve", async () => {
      await improveCode(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codeImprove.improveSelection",
      async () => {
        await improveCode(true);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeImprove.applyChanges", () => {
      diffView.applyChanges();
    })
  );

  async function improveCode(selectionOnly: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor");
      return;
    }

    const document = editor.document;
    const languageId = document.languageId;
    const fileName = document.fileName.split("/").pop() || "code";

    let code = "";
    if (selectionOnly) {
      code = editor.document.getText(editor.selection);
    } else {
      code = editor.document.getText();
    }

    if (!code.trim()) {
      vscode.window.showErrorMessage("No code to improve");
      return;
    }

    const instructions = await vscode.window.showInputBox({
      prompt: "How would you like to improve this code?",
      placeHolder: "Refactor for readability and performance...",
    });

    if (!instructions) {
      return;
    }

    try {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Improving code...",
          cancellable: true,
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            console.log("User canceled the improvement");
          });

          progress.report({ increment: 0 });

          const response = await openai.improveCode({
            original_code: code,
            instructions,
            language: languageId,
            generate_full_code: true,
          });

          progress.report({ increment: 100 });

          if (response) {
            diffView.showDiff({
              original: code,
              improved: response.improved_code || "",
              language: languageId,
              fileName,
              explanation: response.explanation,
              changedLines: response.changed_lines,
            });
          }
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to improve code: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

export function deactivate() {}
