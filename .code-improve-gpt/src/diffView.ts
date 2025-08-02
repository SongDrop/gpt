import * as vscode from 'vscode';
import * as difflib from 'difflib';

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

    showDiff(options: DiffViewOptions) {
        this.originalContent = options.original;
        this.improvedContent = options.improved;
        this.language = options.language;
        this.changedLines = options.changedLines;

        // Create a virtual document for the diff
        const uri = vscode.Uri.parse(`code-improve://diff/${options.fileName}.diff`);
        const diffContent = this.generateDiffContent(options.original, options.improved);

        vscode.workspace.openTextDocument(uri).then(doc => {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(uri, new vscode.Range(0, 0, doc.lineCount, 0), diffContent;
            return vscode.workspace.applyEdit(edit);
        }).then(() => {
            vscode.window.showTextDocument(uri, {
                viewColumn: vscode.ViewColumn.Beside,
                preview: false
            });

            // Show explanation in a webview
            if (options.explanation) {
                this.showExplanation(options.explanation);
            }
        });
    }

    private generateDiffContent(original: string, improved: string): string {
        const originalLines = original.split('\n');
        const improvedLines = improved.split('\n');
        const diff = difflib.unifiedDiff(originalLines, improvedLines, {
            fromfile: 'Original',
            tofile: 'Improved',
            lineterm: ''
        });

        return Array.from(diff).join('\n');
    }

    private showExplanation(explanation: string) {
        const panel = vscode.window.createWebviewPanel(
            'codeImproveExplanation',
            'Code Improvement Explanation',
            vscode.ViewColumn.Two,
            {}
        );

        panel.webview.html = `
            <!DOCTYPE html>
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
            </html>
        `;

        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'copy':
                    vscode.window.showInformationMessage('Explanation copied to clipboard');
                    break;
                case 'apply':
                    this.applyChanges();
                    panel.dispose();
                    break;
            }
        });
    }

    applyChanges() {
        if (!this.improvedContent) {
            vscode.window.showErrorMessage('No improvements to apply');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );

            editor.edit(editBuilder => {
                editBuilder.replace(fullRange, this.improvedContent!);
            }).then(success => {
                if (success) {
                    vscode.window.showInformationMessage('Improvements applied successfully');
                    
                    // Highlight changed lines
                    if (this.changedLines.length > 0) {
                        const decorations = this.changedLines.map(line => {
                            return {
                                range: new vscode.Range(line, 0, line, 0),
                                hoverMessage: 'Changed by Code Improve'
                            };
                        });

                        editor.setDecorations(
                            vscode.window.createTextEditorDecorationType({
                                backgroundColor: 'rgba(46, 160, 67, 0.1)',
                                isWholeLine: true
                            }),
                            decorations
                        );
                    }
                }
            });
        }
    }
}