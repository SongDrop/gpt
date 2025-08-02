import * as vscode from "vscode";
import { OpenAI } from "./openaiClient";
import { DiffView } from "./diffView";

// Extension state management
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
        vscode.commands.executeCommand('setContext', 'codeImprove.isProcessing', value);
    }
}

export function activate(context: vscode.ExtensionContext) {
    const state = ExtensionState.getInstance();
    const openai = new OpenAI();
    const diffView = new DiffView(context);

    // Register commands with better error handling
    const registerCommand = (command: string, callback: (...args: any[]) => any) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, async (...args) => {
                try {
                    if (state.isProcessing) {
                        vscode.window.showWarningMessage("Another operation is already in progress");
                        return;
                    }
                    state.isProcessing = true;
                    await callback(...args);
                } catch (error) {
                    handleError(error);
                } finally {
                    state.isProcessing = false;
                }
            })
        );
    };

    // Command registrations
    registerCommand("codeImprove.improve", () => improveCode(false));
    registerCommand("codeImprove.improveSelection", () => improveCode(true));
    registerCommand("codeImprove.applyChanges", () => diffView.applyChanges());

    // Error handler
    const handleError = (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[CodeImprove] ${message}`);
        vscode.window.showErrorMessage(`Code Improve Error: ${message}`);
    };

    // Core improvement function
    async function improveCode(selectionOnly: boolean) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error("No active editor");
        }

        const { document, selection } = editor;
        const languageId = document.languageId;
        const fileName = document.fileName.split("/").pop() || "code";

        // Get code with context
        const code = selectionOnly 
            ? document.getText(selection)
            : document.getText();

        if (!code.trim()) {
            throw new Error("No code selected or file is empty");
        }

        // Get improvement instructions with validation
        const instructions = await vscode.window.showInputBox({
            prompt: "How would you like to improve this code?",
            placeHolder: "Refactor for readability and performance...",
            validateInput: input => input.trim().length < 10 
                ? "Please provide more detailed instructions" 
                : null
        });

        if (!instructions) return;

        // Track progress with cancellation support
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Improving code...",
            cancellable: true
        }, async (progress, token) => {
            try {
                // Phase 1: Preparation
                progress.report({ message: "Preparing request..." });
                token.onCancellationRequested(() => {
                    throw new Error("Operation cancelled by user");
                });

                // Phase 2: API Call
                progress.report({ message: "Contacting AI service...", increment: 30 });
                const response = await Promise.race([
                    openai.improveCode({
                        original_code: code,
                        instructions,
                        language: languageId,
                        generate_full_code: true,
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Request timeout")), 30000)
                ]);

                // Phase 3: Processing response
                progress.report({ message: "Processing results...", increment: 70 });
                if (!response) {
                    throw new Error("No response from AI service");
                }

                // Phase 4: Display results
                progress.report({ message: "Finalizing...", increment: 90 });
                diffView.showDiff({
                    original: code,
                    improved: response.improved_code || "",
                    language: languageId,
                    fileName,
                    explanation: response.explanation,
                    changedLines: response.changed_lines,
                });

                // Track usage analytics (optional)
                vscode.commands.executeCommand('codeImprove.trackEvent', 'improvementSuccess');
            } catch (error) {
                vscode.commands.executeCommand('codeImprove.trackEvent', 'improvementFailed');
                throw error;
            }
        });
    }

    // Register additional context keys
    vscode.commands.executeCommand('setContext', 'codeImprove.isProcessing', false);
}

export function deactivate() {
    // Cleanup resources if needed
    console.log("[CodeImprove] Extension deactivated");
}