import * as vscode from "vscode";
import axios from "axios";

interface CodeImprovementRequest {
  original_code: string;
  instructions: string;
  language: string;
  max_tokens?: number;
  temperature?: number;
  generate_full_code?: boolean;
}

interface CodeDiffResponse {
  diff: string;
  improved_code: string | null;
  explanation: string;
  changed_lines: number[];
}

export class AzureOpenAIClient {
  private getConfig() {
    const config = vscode.workspace.getConfiguration("codeImprove");
    return {
      apiKey: config.get<string>("azure.apiKey"),
      apiBase: config.get<string>("azure.apiBase"),
      deploymentName: config.get<string>("azure.deploymentName"),
      apiVersion: config.get<string>("azure.apiVersion"),
      maxTokens: config.get<number>("maxTokens", 2000),
      temperature: config.get<number>("temperature", 0.7),
    };
  }

  async improveCode(
    request: CodeImprovementRequest
  ): Promise<CodeDiffResponse> {
    const config = this.getConfig();

    if (!config.apiKey || !config.apiBase) {
      throw new Error(
        "Azure OpenAI configuration not complete. Please check your settings."
      );
    }

    const payload = {
      ...request,
      max_tokens: request.max_tokens || config.maxTokens,
      temperature: request.temperature || config.temperature,
    };

    try {
      const url = `${config.apiBase}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;

      const response = await axios.post(
        url,
        {
          messages: [
            {
              role: "system",
              content:
                "You are a code improvement assistant. Return changes in unified diff format.",
            },
            {
              role: "user",
              content: this.buildPrompt(
                request.original_code,
                request.instructions,
                request.language
              ),
            },
          ],
          max_tokens: payload.max_tokens,
          temperature: payload.temperature,
          stream: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": config.apiKey,
          },
        }
      );

      // Parse Azure OpenAI response format
      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in response");
      }

      return this.parseResponse(content);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data?.error || {};
        throw new Error(errorData.message || error.message);
      }
      throw error;
    }
  }

  private buildPrompt(
    originalCode: string,
    instructions: string,
    language: string
  ): string {
    return `Improve this ${language} code:
\`\`\`${language}
${originalCode}
\`\`\`

Changes requested: ${instructions}

Respond STRICTLY in this format:
\`\`\`diff
[Unified diff showing changes]
\`\`\`

Explanation:
[Brief explanation]`;
  }

  private parseResponse(content: string): CodeDiffResponse {
    let diff = "";
    let explanation = "";
    let improvedCode = "";

    // Extract diff section
    const diffMatch = content.match(/```diff\n([\s\S]*?)\n```/);
    if (diffMatch) {
      diff = diffMatch[1];
    }

    // Extract explanation
    const explanationMatch = content.split("Explanation:");
    if (explanationMatch.length > 1) {
      explanation = explanationMatch[1].trim();
    }

    // For Azure, we'll generate the improved code from the diff
    if (diff) {
      const originalMatch = content.match(/```[a-z]+\n([\s\S]*?)\n```/);
      if (originalMatch) {
        const originalCode = originalMatch[1];
        const { patchedCode } = this.applyDiff(originalCode, diff);
        improvedCode = patchedCode;
      }
    }

    return {
      diff,
      improved_code: improvedCode,
      explanation,
      changed_lines: [], // Will be calculated when applying diff
    };
  }

  private applyDiff(
    original: string,
    diffText: string
  ): { patchedCode: string; changedLines: number[] } {
    const originalLines = original.split("\n");
    const diffLines = diffText.split("\n");
    const patchedLines = [...originalLines];
    const changedLines: number[] = [];
    let linePointer = 0;

    for (const line of diffLines) {
      if (line.startsWith("@@")) {
        // Parse line numbers from diff header
        const lineNumbers = line.match(/\+(\d+)/);
        if (lineNumbers) {
          linePointer = parseInt(lineNumbers[1]) - 1;
        }
        continue;
      }

      if (line.startsWith("+")) {
        // Added line
        patchedLines.splice(linePointer, 0, line.substring(1));
        changedLines.push(linePointer);
        linePointer++;
      } else if (line.startsWith("-")) {
        // Removed line
        patchedLines.splice(linePointer, 1);
        changedLines.push(linePointer);
      } else if (line.startsWith(" ")) {
        // Unchanged line
        linePointer++;
      }
    }

    return {
      patchedCode: patchedLines.join("\n"),
      changedLines,
    };
  }
}
