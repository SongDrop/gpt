import { Config } from "./types";

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[`${key}`] ?? defaultValue;
  if (value === undefined) {
    console.error(`Environment variable ${key} is not defined`);
    return defaultValue || "";
  }
  return value;
};

// Create the configuration object
export const config: Config = {
  // Basic configuration
  APP_NAME: getEnvVar("REACT_APP_NAME", "AI Chat Assistant"),

  // API Configuration
  API_URL: getEnvVar(
    "REACT_APP_API_URL",
    window.location.protocol === "https:"
      ? `${window.location.protocol}//${window.location.hostname}:8000`
      : `${window.location.protocol}//${window.location.hostname}:8000`
  ),
  WS_URL: getEnvVar(
    "REACT_APP_WS_URL",
    window.location.protocol === "https:"
      ? `wss://${window.location.hostname}:8000/ws`
      : `ws://${window.location.hostname}:8000/ws`
  ),

  // Chat Configuration
  MAX_RECONNECT_ATTEMPTS: parseInt(getEnvVar("MAX_RECONNECT_ATTEMPTS", "5")),
  DEFAULT_MAX_TOKENS: parseInt(getEnvVar("DEFAULT_MAX_TOKENS", "4000")),
  DEFAULT_TEMPERATURE: parseFloat(getEnvVar("DEFAULT_TEMPERATURE", "0.7")),

  // UI Configuration
  MESSAGE_HISTORY_LIMIT: parseInt(getEnvVar("MESSAGE_HISTORY_LIMIT", "1000")),
  CODE_LANGUAGES: [
    "python",
    "javascript",
    "typescript",
    "bash",
    "json",
    "html",
    "css",
    "sql",
    "yaml",
    "markdown",
    "plaintext",
  ] as const,
};

// Log configuration in development
if (process.env.NODE_ENV !== "production") {
  console.log("Development Configuration:", {
    APP_NAME: config.APP_NAME,
    API_URL: config.API_URL,
    WS_URL: config.WS_URL,
  });
}

export default config;
