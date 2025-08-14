import * as vscode from "vscode";
import axios from "axios";
import { CodeImprovementRequest, CodeImprovementResponse } from "./types";

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
  ): Promise<CodeImprovementResponse> {
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
      const response = await axios.post<CodeImprovementResponse>(
        `${config.apiBase}/diff-improve`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          timeout: 30000, // 30 second timeout
        }
      );

      // Validate response structure
      if (!response.data || typeof response.data !== "object") {
        throw new Error("Invalid API response format");
      }

      return {
        improved_code: response.data.improved_code || "",
        explanation: response.data.explanation || "",
        changed_lines: response.data.changed_lines || [],
        diff: response.data.diff || "",
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message;
        throw new Error(`API Error: ${errorMessage}`);
      }
      throw new Error(
        `Request failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
