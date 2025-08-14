export interface CodeImprovementRequest {
  original_code: string;
  instructions: string;
  language: string;
  max_tokens?: number;
  temperature?: number;
  generate_full_code?: boolean;
}

export interface CodeImprovementResponse {
  diff: string;
  improved_code: string;
  explanation: string;
  changed_lines: number[];
}
