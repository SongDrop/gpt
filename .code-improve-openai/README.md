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

## Azure Configuration

1. Go to your Azure OpenAI resource in the Azure portal
2. Under "Resource Management", copy:
   - Endpoint (API Base)
   - Key (API Key)
3. Set these in VS Code settings:
   - `codeImprove.azure.apiKey`: Your Azure OpenAI API key
   - `codeImprove.azure.apiBase`: Azure OpenAI endpoint URL
   - `codeImprove.azure.deploymentName`: Deployment name (default: "gpt-4.0-mini")
   - `codeImprove.azure.apiVersion`: API version (default: "2024-02-01")

Example settings:

```json
{
  "codeImprove.azure.apiKey": "your-azure-key-here",
  "codeImprove.azure.apiBase": "https://your-resource.openai.azure.com",
  "codeImprove.azure.deploymentName": "gpt-4.0-mini",
  "codeImprove.azure.apiVersion": "2024-02-01"
}

## Requirements

- VS Code 1.75.0 or higher
- OpenAI API key

## Known Issues

- Large files may hit token limits
- Some languages may not be fully supported

## Release Notes

### 1.0.0

Initial release of Code Improve extension
```
