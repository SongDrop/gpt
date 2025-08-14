import * as vscode from "vscode";
import * as difflib from "difflib";

interface DiffViewOptions {
  original: string;
  improved: string;
  language: string;
  fileName: string;
  explanation: string;
  changedLines: number[];
}

export class DiffView {
  private context: vscode.ExtensionContext;
  private diffDocument?: vscode.TextDocument;
  private originalContent?: string;
  private improvedContent?: string;
  private language?: string;
  private changedLines: number[] = [];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async showDiff(options: DiffViewOptions): Promise<void> {
    this.originalContent = options.original;
    this.improvedContent = options.improved;
    this.language = options.language;
    this.changedLines = options.changedLines;

    try {
      const uri = vscode.Uri.parse(
        `code-improve://diff/${options.fileName}.diff`
      );
      const diffContent = this.generateDiffContent(
        options.original,
        options.improved
      );

      const doc = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(0, 0, doc.lineCount, 0), diffContent);

      await vscode.workspace.applyEdit(edit);
      await vscode.window.showTextDocument(uri, {
        viewColumn: vscode.ViewColumn.Beside,
        preview: false,
      });

      if (options.explanation) {
        this.showExplanation(options.explanation);
      }
    } catch (error) {
      console.error("Failed to show diff:", error);
      throw error;
    }
  }

  private generateDiffContent(original: string, improved: string): string {
    const originalLines = original.split("\n");
    const improvedLines = improved.split("\n");
    const diff = difflib.unifiedDiff(originalLines, improvedLines, {
      fromfile: "Original",
      tofile: "Improved",
      lineterm: "",
    });

    return Array.from(diff).join("\n");
  }

  private showExplanation(explanation: string): void {
    const panel = vscode.window.createWebviewPanel(
      "codeImproveExplanation",
      "Code Improvement Explanation",
      vscode.ViewColumn.Two,
      {}
    );

    panel.webview.html = this.getExplanationWebviewContent(explanation);
    panel.webview.onDidReceiveMessage(this.handleWebviewMessage.bind(this));
  }

  private getExplanationWebviewContent(explanation: string): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Explanation</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 1em;
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                pre {
                    white-space: pre-wrap;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 1em;
                    border-radius: 4px;
                }
                .actions {
                    margin-top: 1em;
                    display: flex;
                    gap: 0.5em;
                }
                button {
                    padding: 0.5em 1em;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <h2>Code Improvement Explanation</h2>
            <pre>${explanation}</pre>
            <div class="actions">
                <button onclick="copyExplanation()">Copy</button>
                <button onclick="applyChanges()">Apply Changes</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                function copyExplanation() {
                    navigator.clipboard.writeText(\`${explanation}\`);
                    vscode.postMessage({ command: 'copy' });
                }
                function applyChanges() {
                    vscode.postMessage({ command: 'apply' });
                }
            </script>
        </body>
        </html>`;
  }

  private handleWebviewMessage(message: { command: string }): void {
    switch (message.command) {
      case "copy":
        vscode.window.showInformationMessage("Explanation copied to clipboard");
        break;
      case "apply":
        this.applyChanges();
        break;
    }
  }

  async applyChanges(): Promise<void> {
    if (!this.improvedContent) {
      vscode.window.showErrorMessage("No improvements to apply");
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor to apply changes");
      return;
    }

    try {
      const success = await editor.edit((editBuilder) => {
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        editBuilder.replace(fullRange, this.improvedContent!);
      });

      if (success) {
        vscode.window.showInformationMessage(
          "Improvements applied successfully"
        );
        this.highlightChangedLines(editor);
      } else {
        vscode.window.showErrorMessage("Failed to apply changes");
      }
    } catch (error) {
      console.error("Failed to apply changes:", error);
      vscode.window.showErrorMessage(
        `Failed to apply changes: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private highlightChangedLines(editor: vscode.TextEditor): void {
    if (this.changedLines.length === 0) return;

    const decorations = this.changedLines.map((line) => ({
      range: new vscode.Range(line, 0, line, 0),
      hoverMessage: "Changed by Code Improve",
    }));

    editor.setDecorations(
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(46, 160, 67, 0.1)",
        isWholeLine: true,
      }),
      decorations
    );
  }
}
