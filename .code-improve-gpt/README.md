# Code Improve VSCode Extension

AI-powered code improvements with diff view for Visual Studio Code.

## Features

- Improve entire files or selected code
- Custom improvement instructions
- Side-by-side diff view
- Detailed explanations of changes
- One-click apply improvements

## Installation

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=your-name.code-improve)
2. Configure your OpenAI API key in settings

## Usage

1. Open a code file
2. Use the command palette to run:
   - "Improve Current File" - Improve the entire file
   - "Improve Selection" - Improve the selected code
3. Enter improvement instructions when prompted
4. Review the diff and explanation
5. Click "Apply Changes" if satisfied

## Configuration

Set these in your VS Code settings:

- `codeImprove.openai.apiKey`: Your OpenAI API key (required)
- `codeImprove.openai.apiBase`: OpenAI API base URL (default: "https://api.openai.com/v1")
- `codeImprove.openai.model`: Model to use (default: "gpt-4")
- `codeImprove.maxTokens`: Maximum tokens for completion (default: 2000)
- `codeImprove.temperature`: Temperature for completions (default: 0.7)

## Requirements

- VS Code 1.75.0 or higher
- OpenAI API key

## Known Issues

- Large files may hit token limits
- Some languages may not be fully supported

## Release Notes

### 1.0.0

Initial release of Code Improve extension
