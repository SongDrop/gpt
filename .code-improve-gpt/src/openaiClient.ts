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

export class OpenAI {
  private getConfig() {
    const config = vscode.workspace.getConfiguration("codeImprove");
    return {
      apiKey: config.get<string>("openai.apiKey"),
      apiBase: config.get<string>("openai.apiBase"),
      model: config.get<string>("openai.model"),
      maxTokens: config.get<number>("maxTokens"),
      temperature: config.get<number>("temperature"),
    };
  }

  async improveCode(
    request: CodeImprovementRequest
  ): Promise<CodeDiffResponse> {
    const config = this.getConfig();

    if (!config.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const payload = {
      ...request,
      max_tokens: request.max_tokens || config.maxTokens,
      temperature: request.temperature || config.temperature,
    };

    try {
      const response = await axios.post(
        `${config.apiBase}/diff-improve`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.error?.message || error.message);
      }
      throw error;
    }
  }
}
