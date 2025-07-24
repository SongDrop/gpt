import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  Send,
  Loader,
  AlertTriangle,
  Copy,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Trash2,
  Search,
  Plus,
  Quote,
  Upload,
  ExternalLink,
  Square,
  CheckSquare,
  PaletteIcon,
} from "lucide-react";
import { marked } from "marked";
import MarkdownEditor from "./components/MarkdownEditor";
import MessageContent from "./components/MessageContent";
import { config } from "./config";
import useLocalStorage from "./components/useLocalStorage";
import PromptWindow from "./components/PromptWindow";
import DragDropArea, { DroppedItem } from "./components/DragDropArea";
import FileUpload from "./components/FileUpload";
import UploadCompletePopup from "./components/UploadCompletePopup";
import GptImage from "./components/GptImage";
import DatabaseCreate from "./components/DatabaseCreate";
import ThemeManager from "./components/ThemeManager";
import {
  saveMessageToDb,
  getMessagesBySession,
  deleteMessageFromDb,
  clearMessagesBySession,
  StoredMessage,
  createSessionMdFile,
  deleteAllMessages,
  saveMessagesBatch,
  downloadSessionMd,
} from "./components/messageDb";
import DatabaseSelector from "./components/DatabaseSelector";
import {
  RagDatabase,
  DatabaseType,
  Contributor,
  DatabaseFilterOptions,
} from "./components/types";
import { SearchComponent } from "./components/SearchComponent";

const baseUrlLogo = "https://i.postimg.cc/C53CqTfx/chatgpt.png";

type Role = "assistant" | "user" | "system";

class Message {
  role: Role;
  content: string;
  timestamp: string;
  id: string;

  constructor(role: Role, content: string, timestamp: string, id: string) {
    this.role = role;
    this.content = content;
    this.timestamp = timestamp;
    this.id = id;
  }

  static fromJSON(obj: any): Message {
    return new Message(
      obj.role,
      obj.content,
      obj.timestamp || new Date().toISOString(),
      obj.id || uuidv4()
    );
  }

  // Add this for better serialization
  toJSON() {
    return {
      role: this.role,
      content: this.content,
      timestamp: this.timestamp,
      id: this.id,
    };
  }
}
class ChatResponse {
  response: string;
  timestamp: string;

  constructor(response: string, timestamp: string) {
    this.response = response;
    this.timestamp = timestamp;
  }

  isEmpty(): boolean {
    return this.response.trim() === "";
  }

  static fromJSON(obj: any): ChatResponse {
    return new ChatResponse(obj.response, obj.timestamp);
  }
}

class Session {
  id: string;
  name: string;
  lastUpdated: string;

  constructor(id: string, name: string, lastUpdated: string) {
    this.id = id;
    this.name = name;
    this.lastUpdated = lastUpdated;
  }

  static fromJSON(obj: any): Session {
    return new Session(
      obj.id || uuidv4(),
      obj.name || "Untitled Session",
      obj.lastUpdated || new Date().toISOString()
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      lastUpdated: this.lastUpdated,
    };
  }
}

// Configure marked
const renderer = new marked.Renderer();

renderer.codespan = function (text: string) {
  text = text.replace(/^`|`$/g, "");
  return `<code class="inline-code">${text}</code>`;
};

marked.setOptions({ renderer });

// HTTP fallback function
const sendMessageHttp = async (requestBody: any): Promise<ChatResponse> => {
  const url = `${config.API_URL}/chat`;
  console.log("Sending HTTP request to:", url);
  console.log("Request body:", requestBody);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

interface WebSocketManagerOptions {
  url: string;
  maxReconnectAttempts: number;
  onMessage: (data: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (error: string) => void;
}
interface WebSocketManagerOptions {
  url: string;
  maxReconnectAttempts: number;
  onMessage: (data: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (error: string) => void;
}

class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageQueue: string[] = [];
  private connecting = false;
  private options: WebSocketManagerOptions;
  private closedIntentionally = false;
  private lastConnectAttempt = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongTime = 0;

  private constructor(options: WebSocketManagerOptions) {
    this.options = options;
  }

  public static getInstance(
    options: WebSocketManagerOptions
  ): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager(options);
      // Auto-connect when instance is created
      WebSocketManager.instance.connect();
    }
    return WebSocketManager.instance;
  }

  public connect(): void {
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastConnectAttempt;

    if (timeSinceLastAttempt < 1000) {
      return;
    }

    this.lastConnectAttempt = now;
    this.connecting = true;
    this.closedIntentionally = false;

    try {
      // Clean up any existing connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      console.log("Connecting to WebSocket:", this.options.url);
      this.ws = new WebSocket(this.options.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      this.connecting = false;
      this.options.onError("Failed to create connection");
      this.scheduleReconnect();
    }
  }

  private setupPingPong(): void {
    // Clear existing interval if any
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.lastPongTime = Date.now();

    // Setup ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        // Check if we've received a pong recently
        if (Date.now() - this.lastPongTime > 45000) {
          // 45 seconds without pong
          console.warn("No pong received, closing connection");
          this.ws?.close();
          return;
        }

        // Send ping
        try {
          // this.ws?.send(JSON.stringify({ type: "ping" }));
          this.ws?.send(
            JSON.stringify({
              type: "ping",
              sessionId: "sessionId", // Add if available
              messages: [],
              continue_last: false,
            })
          );
        } catch (error) {
          console.error("Error sending ping:", error);
        }
      }
    }, 30000); // 30 seconds
  }

  private handleOpen(): void {
    console.log("WebSocket connected");
    this.connecting = false;
    this.reconnectAttempt = 0;
    this.options.onConnectionChange(true);
    this.setupPingPong();

    // Send queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) this.send(message);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log("WebSocket closed:", event.code, event.reason);
    this.cleanUp();

    if (!this.closedIntentionally) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.options.onError("Connection error");
    this.cleanUp();
    this.scheduleReconnect();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      // Handle pong messages
      if (event.data === '{"type":"pong"}') {
        this.lastPongTime = Date.now();
        return;
      }

      // Handle system messages
      if (event.data === "[SYSTEM] Generation stopped") {
        console.log("Server confirmed generation stopped");
      }

      this.options.onMessage(event.data);
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  public sendTranslationRequest(
    source: string,
    sourceLang: string,
    targetLang: string
  ): boolean {
    if (!this.isConnected()) {
      console.warn("WebSocket not connected, cannot send translation request");
      return false;
    }

    const message = JSON.stringify({
      source,
      sourceLang,
      targetLang,
    });

    return this.send(message);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.options.maxReconnectAttempts) {
      console.log("Max reconnect attempts reached");
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const backoffDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      30000 // Max 30 seconds
    );

    console.log(
      `Reconnecting in ${backoffDelay}ms (attempt ${this.reconnectAttempt + 1})`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempt++;
      this.connect();
    }, backoffDelay);
  }

  private cleanUp(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }

      this.ws = null;
    }

    this.connecting = false;
    this.options.onConnectionChange(false);
  }

  public send(message: string): boolean {
    if (this.isConnected()) {
      try {
        this.ws?.send(message);
        return true;
      } catch (error) {
        console.error("Error sending message:", error);
        return false;
      }
    } else if (this.connecting && this.messageQueue.length < 20) {
      this.messageQueue.push(message);
      return true;
    }
    return false;
  }

  public stop(): void {
    this.sendStopCommand();
    this.disconnect();
  }

  private sendStopCommand(): void {
    try {
      const stopCommand = JSON.stringify({ command: "stop" });
      if (this.isConnected()) {
        this.ws?.send(stopCommand);
      } else {
        this.messageQueue.unshift(stopCommand);
      }
    } catch (error) {
      console.error("Error sending stop command:", error);
    }
  }

  public disconnect(): void {
    this.closedIntentionally = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.cleanUp();
    this.messageQueue = [];
    this.reconnectAttempt = 0;
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public static cleanup(): void {
    if (WebSocketManager.instance) {
      WebSocketManager.instance.disconnect();
      WebSocketManager.instance = null;
    }
  }
}

const ConnectionStatus: React.FC<{
  wsConnected: boolean;
  useHttpFallback: boolean;
  reconnectCount: number;
}> = ({ wsConnected, useHttpFallback, reconnectCount }) => {
  // Log here, before the return statement
  console.log(wsConnected, useHttpFallback, reconnectCount);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`w-2 h-2 rounded-full ${
          wsConnected ? "bg-green-500" : "bg-red-500"
        }`}
        aria-label={wsConnected ? "Connected" : "Disconnected"}
        title={wsConnected ? "Connected" : "Disconnected"}
      />
      {useHttpFallback ? (
        <span>Using HTTP Mode</span>
      ) : wsConnected ? (
        <span>Connected (reconnects: {reconnectCount})</span>
      ) : (
        <span>Disconnected</span>
      )}
    </div>
  );
};

const MessageActions: React.FC<{
  content: string;
  onContinue?: () => void;
  isAssistant?: boolean;
}> = ({ content, onContinue, isAssistant = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={handleCopy}
        className="text-xs flex items-center gap-1 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] px-2 py-1 rounded"
        title="Copy to clipboard"
      >
        <Copy size={14} />
        {copied ? "Copied!" : "Copy"}
      </button>
      {isAssistant && onContinue && (
        <button
          onClick={onContinue}
          className="text-xs flex items-center gap-1 bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] px-2 py-1 rounded"
          title="Continue generating"
        >
          <ChevronRight size={14} />
          Continue
        </button>
      )}
    </div>
  );
};

export default function ChatApp() {
  //
  const navigate = useNavigate();
  const [backgroundUrl, setBackgroundUrl] = useState(
    process.env.REACT_APP_LOGO || baseUrlLogo
  );
  const { sessionId: paramSessionId } = useParams<{ sessionId: string }>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useLocalStorage<Session[]>(
    "chat_sessions",
    []
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const PAGE_SIZE = 1000; // or suitable chunk size

  const [messagePageOffset, setMessagePageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  //
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  //
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [useHttpFallback, setUseHttpFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const generateId = () => uuidv4();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  ///
  const [showSidebar, setShowSidebar] = useState(false);
  // Toggle sidebar visibility on logo click
  const toggleSidebar = () => {
    setShowSidebar((prev) => !prev);
  };
  const [showGptImageWindow, setShowGptImageWindow] = useState(false);
  const [showDatabaseWindow, setShowDatabaseWindow] = useState(false);
  const [selectedDatabases, setSelectedDatabases] = useState<RagDatabase[]>([]);
  const [databases, setDatabases] = useState<RagDatabase[]>([]);
  const currentUser = { id: "user1", name: "Alice" };
  ///
  const [showPromptWindow, setShowPromptWindow] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useLocalStorage<string>(
    "promptWindow-selectedPrompt",
    ""
  );
  const [ragSearchEnabled, setRagSearchEnabled] = useLocalStorage<boolean>(
    "ragsearch-enabled",
    true
  );
  //File Upload/DragAndDrop
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [showUploadComplete, setShowUploadComplete] = useState(false);
  //Search Bar
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Add this state at the top of your component
  const [isInitializing, setIsInitializing] = useState(true);
  const initialPagination = { offset: 0, limit: 1000 }; // Explicit initial state
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<
    string | null
  >(null);

  //Database creation for vector RAG
  const [showCreateDatabaseModal, setShowCreateDatabaseModal] = useState(false);
  const openCreateNewDatabaseModal = () => setShowCreateDatabaseModal(true);
  const closeCreateNewDatabaseModal = () => setShowCreateDatabaseModal(false);

  //Theme Manager
  const [showThemeManager, setShowThemeManager] = useState(false);
  const closeThemeManager = () => setShowThemeManager(false);

  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const clearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOffset(0);
    setSearchHasMore(false);
  };

  const handleCreateDatabase = async (data: {
    title: string;
    description?: string;
    tags?: string[];
  }) => {
    // Call your API here via the prop or directly
    //await onCreateDatabase(data);
    // Optionally refresh your list or update state here
  };

  // 1. On mount or paramSessionId change, set sessionId or load last session
  useEffect(() => {
    console.groupCollapsed(`[Session Init] Running session init effect`);
    console.log(`paramSessionId:`, paramSessionId);
    console.log(`sessions:`, sessions);

    // Skip if we're already on the correct session or still initializing
    if (paramSessionId === sessionId || !isInitializing) {
      console.log(`Already on correct session or initialized, skipping update`);
      console.groupEnd();
      return;
    }

    const initializeSession = async () => {
      let targetSessionId = paramSessionId;

      if (!targetSessionId) {
        if (sessions.length > 0) {
          const lastSession = sessions.reduce((prev, current) =>
            new Date(prev.lastUpdated) > new Date(current.lastUpdated)
              ? prev
              : current
          );
          console.log(
            `No paramSessionId, setting to last session:`,
            lastSession.id
          );
          targetSessionId = lastSession.id;
        } else {
          targetSessionId = uuidv4();
          console.log(
            `No sessions exist, creating new session:`,
            targetSessionId
          );
        }
      }

      // Update state and URL in one go
      setSessionId(targetSessionId);
      navigate(`/${targetSessionId}`, { replace: true });
      setIsInitializing(false);
      console.groupEnd();
    };

    initializeSession().catch((error) => {
      console.error("Session initialization failed:", error);
      setIsInitializing(false);
    });
  }, [paramSessionId, sessionId, sessions, navigate, isInitializing]);

  // 2. Add/update session in sessions list when sessionId changes
  useEffect(() => {
    if (isInitializing || !sessionId) return;

    console.groupCollapsed(`[Session Tracking] Checking session state`);
    console.log(`Current sessionId:`, sessionId);

    setSessions((prevSessions) => {
      const existingSessionIndex = prevSessions.findIndex(
        (s) => s.id === sessionId
      );
      const now = new Date().toISOString();

      if (existingSessionIndex >= 0) {
        const updatedSessions = [...prevSessions];
        const existingSession = updatedSessions[existingSessionIndex];
        updatedSessions[existingSessionIndex] = new Session(
          existingSession.id,
          existingSession.name,
          now
        );
        console.log(`Updated lastUpdated for existing session`);
        console.groupEnd();
        return updatedSessions;
      } else {
        const newSession = new Session(sessionId, "Untitled Session", now);
        console.log(`Adding new session to sessions list:`, newSession);
        console.groupEnd();
        return [...prevSessions, newSession];
      }
    });
  }, [sessionId, setSessions, isInitializing]);

  // Function to update session name based on messages
  const updateSessionName = useCallback(
    (targetSessionId: string, messages: Message[]) => {
      if (!targetSessionId) return;

      let newName = "";

      if (messages.length === 0) {
        newName = "No messages yet";
      } else {
        // Find the last user message
        const lastUserMessage = [...messages]
          .reverse()
          .find((msg) => msg.role === "user");

        if (!lastUserMessage) return;

        // Create a name from the first 40 chars of the last user message
        newName = lastUserMessage.content
          .trim()
          .split("\n")[0] // Take first line
          .slice(0, 40); // Limit to 40 chars
      }

      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id === targetSessionId && session.name !== newName) {
            // Return a new Session instance with updated name
            return new Session(session.id, newName, new Date().toISOString());
          }
          return session;
        })
      );
    },
    [setSessions]
  );

  useEffect(() => {
    console.groupCollapsed(`[Message Loading] Loading messages for session`);
    console.log(`Current sessionId:`, sessionId);

    if (!sessionId) {
      console.log(`No sessionId, clearing messages`);
      setMessages([]);
      console.groupEnd();
      return;
    }

    let isMounted = true;
    console.log(`Starting async message load for session:`, sessionId);

    (async () => {
      try {
        console.log(`Fetching messages from DB...`);
        // Reset pagination when session changes
        ///PAGE_SIZE; should be aded
        const storedMessages = await getMessagesBySession(
          sessionId,
          initialPagination.limit,
          initialPagination.offset
        );
        console.log(`Retrieved ${storedMessages.length} messages`);

        if (!isMounted) {
          console.log(`Component unmounted, aborting update`);
          console.groupEnd();
          return;
        }

        if (storedMessages.length < PAGE_SIZE) {
          setHasMoreMessages(false);
        } else {
          setHasMoreMessages(true);
        }

        if (storedMessages.length > 0) {
          const loadedMessages = storedMessages.map((msg) =>
            Message.fromJSON({
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              id: msg.id || uuidv4(),
            })
          );
          console.log(`Setting loaded messages`);
          // Clear any existing messages before setting new ones
          setMessages(loadedMessages);
          // Update session name based on first user message
          updateSessionName(sessionId, loadedMessages);
        } else {
          console.log(`No messages found, setting empty array`);
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to load messages from DB", error);
        if (isMounted) {
          setMessages([]);
        }
      }
      console.groupEnd();
    })();

    return () => {
      console.log(`[Message Loading] Cleanup - unmounting`);
      isMounted = false;
    };
  }, [sessionId]); // Add any other dependencies if needed

  // 4. Save messages when they change (debounced)
  useEffect(() => {
    console.groupCollapsed(`[Message Saving] Debounce effect triggered`);
    console.log(`Current sessionId:`, sessionId);
    console.log(`Current messages:`, messages);

    if (!sessionId || messages.length === 0) {
      console.log(`No sessionId or empty messages, skipping save`);
      console.groupEnd();
      return;
    }

    const saveTimeout = setTimeout(async () => {
      try {
        console.log(`Starting to save ${messages.length} messages...`);

        // Batch save all messages at once
        await saveMessagesBatch(
          messages.map((message) => ({
            id: message.id,
            sessionId,
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
          }))
        );

        console.log(`Successfully saved ${messages.length} messages`);

        // Update session name after saving
        updateSessionName(sessionId, messages);
      } catch (error) {
        console.error("Failed to save messages:", error);
      }
      console.groupEnd();
    }, 1000); // 1 second debounce

    return () => {
      console.log(`[Message Saving] Cleanup - clearing timeout`);
      clearTimeout(saveTimeout);
    };
  }, [messages, sessionId, updateSessionName]);

  // Health check on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${config.API_URL}/health`, {
          credentials: "include",
          mode: "cors",
        });
        if (!response.ok)
          throw new Error(`Health check failed: ${response.status}`);
        setInitError(null);
      } catch (err) {
        console.error("Health check error:", err);
        setInitError(
          "Could not connect to chat service. Please try again later."
        );
      }
    };
    checkHealth();
  }, []);

  // WebSocket connection management
  useEffect(() => {
    console.log("Config WS_URL:", config.WS_URL);
    if (!useHttpFallback && sessionId) {
      const manager = WebSocketManager.getInstance({
        url: config.WS_URL,
        maxReconnectAttempts: config.MAX_RECONNECT_ATTEMPTS,
        // In the WebSocketManager initialization in useEffect
        onMessage: (data: string) => {
          setConnectionError(null);
          setTyping(true);
          focusInput();
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];

            if (
              lastMessage?.role === "assistant" &&
              lastMessage.id === streamingMessageId
            ) {
              // Create a new Message instance instead of spreading
              newMessages[newMessages.length - 1] = new Message(
                lastMessage.role,
                lastMessage.content + data,
                lastMessage.timestamp,
                lastMessage.id
              );
            } else {
              // Create new Message instance
              const newId = generateId();
              setStreamingMessageId(newId);
              newMessages.push(
                new Message("assistant", data, new Date().toISOString(), newId)
              );
            }
            return newMessages;
          });
        },
        onError: (error: string) => {
          console.error("WebSocket error:", error);
          setConnectionError(`Connection error: ${error}`);
          setTyping(false);
          setUseHttpFallback(true);
        },
        onConnectionChange: (connected: boolean) => {
          setWsConnected(connected);
          setError(null);
          // setUseHttpFallback(false);
          setUseHttpFallback(!connected);
          if (!connected) setTyping(false);
          setReconnectCount((prev) => (connected ? 0 : prev + 1));
          if (connected) setConnectionError(null);
        },
      });

      manager.connect();

      return () => {
        manager.disconnect();
      };
    }
  }, [useHttpFallback, streamingMessageId, sessionId]);

  const location = useLocation();
  // Auto-scroll when messages or typing state changes, only if no highlighted message
  useEffect(() => {
    if (!highlightedMessageId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const el = messageRefs.current[lastMessage.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [messages, highlightedMessageId]);

  // Auto-scroll on window load, only if no highlighted message
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    if (!highlightedMessageId) {
      timeout = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100); // Adjust delay as needed
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [highlightedMessageId, location.pathname]);

  // Continue generating response for a given message ID
  const continueGeneration = async (messageId: string) => {
    if (!messages.length || !sessionId) return;

    try {
      setTyping(true);
      focusInput();
      setStreamingMessageId(messageId);

      const requestBody = {
        sessionId,
        messages: messages.map(({ role, content, timestamp }) => ({
          role,
          content,
          timestamp,
        })),
        max_tokens: config.DEFAULT_MAX_TOKENS,
        temperature: config.DEFAULT_TEMPERATURE,
        continue_last: true,
        systemPrompt: selectedPrompt,
        vectorSearchEnabled: ragSearchEnabled,
      };

      const manager = WebSocketManager.getInstance({
        url: config.WS_URL,
        maxReconnectAttempts: config.MAX_RECONNECT_ATTEMPTS,
        onMessage: () => {},
        onConnectionChange: () => {},
        onError: () => {},
      });

      if (!useHttpFallback && manager.isConnected()) {
        const sent = manager.send(JSON.stringify(requestBody));
        if (!sent) throw new Error("Failed to send message via WebSocket");
      } else {
        const data = await sendMessageHttp(requestBody);
        setMessages((prev) => [
          ...prev,
          new Message("assistant", data.response, data.timestamp, generateId()),
        ]);
        setTyping(false);
      }
    } catch (err) {
      console.error("Continue generation error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to continue message. Please try again."
      );
      setTyping(false);
    }
  };

  const focusInput = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    if (textarea.disabled) {
      console.warn("Textarea disabled, can't focus");
      return;
    }

    textarea.focus();

    setTimeout(() => {
      if (document.activeElement !== textarea) {
        // console.warn("Focus didn't work, trying again...");
        textarea.focus();
      }
    }, 1000);
  };

  // Send a new user message
  const sendMessage = async () => {
    if (!input.trim() || !sessionId || isLoading) return; // Prevent duplicate sends
    setError(null);

    const newMessage = new Message(
      "user",
      input,
      new Date().toISOString(),
      generateId()
    );
    try {
      setMessages((prev) => [...prev, newMessage]);
      setIsLoading(true);
      setTyping(true);
      focusInput();

      const requestBody = {
        sessionId,
        messages: [...messages, newMessage].map(
          ({ role, content, timestamp }) => ({
            role,
            content,
            timestamp,
          })
        ),
        max_tokens: config.DEFAULT_MAX_TOKENS,
        temperature: config.DEFAULT_TEMPERATURE,
        continue_last: false,
        systemPrompt: selectedPrompt,
        vectorSearchEnabled: ragSearchEnabled,
      };

      const manager = WebSocketManager.getInstance({
        url: config.WS_URL,
        maxReconnectAttempts: config.MAX_RECONNECT_ATTEMPTS,
        onMessage: () => {},
        onConnectionChange: () => {},
        onError: () => {},
      });

      if (!useHttpFallback && manager.isConnected()) {
        const sent = manager.send(JSON.stringify(requestBody));
        if (!sent) throw new Error("Failed to send message via WebSocket");
      } else {
        const data = await sendMessageHttp(requestBody);
        setMessages((prev) => [
          ...prev,
          new Message("assistant", data.response, data.timestamp, generateId()),
        ]);
        setTyping(false);
      }

      setInput("");
    } catch (err) {
      console.error("Send message error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send message. Please try again."
      );
      // Remove last user message if send fails
      setMessages((prev) => prev.slice(0, -1));
      setTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  const newConversation = () => {
    const newSessionId = uuidv4();

    // Add new session if it doesn't exist
    setSessions((prevSessions) => {
      const exists = prevSessions.some((s) => s.id === newSessionId);
      if (!exists) {
        const newSession = new Session(
          newSessionId,
          "Untitled Session",
          new Date().toISOString()
        );
        return [...prevSessions, newSession];
      }
      return prevSessions;
    });

    // Clear messages for new session
    setMessages([]);

    // Reset input and errors
    setInput("");
    setError(null);
    setTyping(false);
    setIsLoading(false);

    console.log("New session_id", newSessionId);
    // Update sessionId state and navigate
    setSessionId(newSessionId);
    navigate(`/${newSessionId}`, { replace: true });
  };

  // Sidebar session click handler updates URL (thus sessionId)
  const handleSessionClick = (id: string) => {
    setSessionId(id);
    navigate(`/${id}`);
    setShowSidebar(false);
  };

  const refreshConversation = async () => {
    if (!sessionId) return;
    if (window.confirm("Are you sure you want to clear the conversation?")) {
      try {
        await clearMessagesBySession(sessionId);
        setMessages([]);
        setInput("");
        setError(null);
        updateSessionName(sessionId, []);
      } catch (error) {
        console.error("Failed to clear messages from DB", error);
      }
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleStop = () => {
    // Get the WebSocket instance (reuse existing instance if available)
    const wsManager = WebSocketManager.getInstance({
      url: config.WS_URL,
      maxReconnectAttempts: config.MAX_RECONNECT_ATTEMPTS,
      onMessage: (data) => {
        // Handle any incoming messages (including stop confirmation)
        if (data === "[SYSTEM] Generation stopped") {
          console.log("Generation stopped confirmed by server");
        }
      },
      onConnectionChange: (connected) => {
        console.log(`Connection state changed: ${connected}`);
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
      },
    });

    // Call the stop method on the WebSocketManager instance
    wsManager.stop();

    // Update UI state
    setTyping(false);
    setIsLoading(false);

    // Optional: Show feedback to user
    console.log("Stop generation requested");
  };

  const handleChangePrompt = (prompt: string) => {
    setSelectedPrompt(prompt);
    setInput(prompt);
    // Optional: Show feedback to user
    console.log(prompt);
    togglePromptWindow();
    sendMessage();
  };

  // Sidebar session click handler updates URL (thus sessionId)
  const handleSessionDelete = (id: string) => {
    clearMessagesBySession(id);
    // Optionally update local state to remove the deleted session
    setSessions((prev) => prev.filter((session) => session.id !== id));

    // Optionally, if you want to clear the selected session when it is deleted:
    if (sessionId === id) {
      setSessionId(null); // or "" depending on your state type
      newConversation();
    }
    deleteMessageFromDb(id);
  };

  const handleDropItems = (items: DroppedItem[]) => {
    // Convert DroppedItems to File objects
    const files = items
      .filter((item) => item.type === "file" && item.file)
      .map((item) => item.file!);

    setUploadedFiles(files);
  };

  const handleUploadComplete = () => {
    console.log("Upload completed!");
    setShowUploadComplete(true);
    setTimeout(() => {
      setUploadedFiles([]);
      setShowUploadComplete(false);
    }, 3000);
  };

  const handleDeleteAllMessages = () => {
    deleteAllMessages();
    setSessions([]);
    setMessages([]);
  };

  // Helper to truncate message content for sidebar display
  const truncate = (text: string, maxLength = 30) =>
    text.length > maxLength ? text.slice(0, maxLength) + "..." : text;

  // Toggle sidebar visibility on logo click
  const togglePromptWindow = () => {
    setShowPromptWindow((prev) => !prev);
  };

  // Toggle sidebar visibility on logo click
  const toggleDatabaseWindow = () => {
    setShowDatabaseWindow((prev) => !prev);
  };

  const toggleRagSearch = () => {
    setRagSearchEnabled((prev) => !prev);
  };

  const toggleThemeManager = () => {
    setShowThemeManager((prev) => !prev);
  };

  const handleCreateNew = () => {
    // Implement database creation logic
    console.log("Create new database");
    openCreateNewDatabaseModal();
  };

  const handleUploadFiles = async (databaseId: string, files: File[]) => {};

  const addSessionMdFileToUploads = async (sessionId: string) => {
    const mdFile = await createSessionMdFile(sessionId);

    console.log("[addSessionMdFileToUploads] Created session md file:", mdFile);

    const item: DroppedItem = {
      type: "file",
      name: mdFile.name,
      path: "",
      file: mdFile,
    };

    handleDropItems([item]);
  };

  const uploadAllSessions = async (sessionIds: string[]) => {
    console.log(
      "[uploadAllSessions] Starting upload for sessions:",
      sessionIds
    );

    const droppedItems: DroppedItem[] = [];

    for (const sessionId of sessionIds) {
      try {
        const mdFile = await createSessionMdFile(sessionId);
        droppedItems.push({
          type: "file",
          name: mdFile.name,
          path: "",
          file: mdFile,
        });
        console.log(
          `[uploadAllSessions] Created DroppedItem for session ${sessionId}`
        );
      } catch (error) {
        console.error(
          `[uploadAllSessions] Failed to create md file for session ${sessionId}`,
          error
        );
      }
    }

    if (droppedItems.length > 0) {
      handleDropItems(droppedItems);
      console.log(
        "[uploadAllSessions] All session files passed to handleDropItems"
      );
    } else {
      console.warn("[uploadAllSessions] No session files to upload");
    }
  };

  const handleDownloadSession = () => {
    console.log(`Current sessionId:`, sessionId);
    downloadSessionMd(sessionId as string);
  };

  const handleDatabase = () => {
    console.log(`Current sessionId:`, sessionId);
    toggleDatabaseWindow();
  };

  const handleDatabaseSelect = (selectedDatabases: RagDatabase[]) => {};

  const handleSelectedSearchResult = (
    sessionId: string,
    messageId?: string
  ) => {
    console.log("[handleSelectedSearchResult] Called with:", {
      sessionId,
      messageId,
    });

    handleSessionClick(sessionId);
    console.log("[handleSelectedSearchResult] Session clicked:", sessionId);

    setHighlightedMessageId(messageId ?? null);
    console.log(
      "[handleSelectedSearchResult] Highlighted message ID set to:",
      messageId ?? null
    );

    if (messageId && chatRef.current) {
      console.log(
        "[handleSelectedSearchResult] messageId and chatRef.current exist, scheduling scroll"
      );
      setTimeout(() => {
        console.log(
          "[handleSelectedSearchResult] Running scroll timeout for messageId:",
          messageId
        );

        const messageElement = chatRef.current!.querySelector(
          `#msg-${messageId}`
        ) as HTMLElement | null;

        if (messageElement) {
          console.log(
            "[handleSelectedSearchResult] Found message element, scrolling into view"
          );
          messageElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } else {
          console.warn(
            "[handleSelectedSearchResult] Message element not found:",
            `#msg-${messageId}`
          );
        }
      }, 1000);
    } else {
      if (!messageId) {
        console.warn(
          "[handleSelectedSearchResult] messageId is undefined or null"
        );
      }
      if (!chatRef.current) {
        console.warn("[handleSelectedSearchResult] chatRef.current is null");
      }
    }
  };

  // Send translation request
  const onTranslate = async (
    source: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> => {
    try {
      // console.log("translate_request", sourceLang, targetLang, source);
      const response = await fetch(`${config.API_URL}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source, sourceLang, targetLang }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Translation failed: ${errorText}`);
      }

      const data = await response.json();
      return data.translatedCode;
    } catch (error) {
      console.error("Translation error:", error);
      return `// Translation error: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  };

  //CONNECTION ERROR
  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-secondary)] p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center gap-2 text-[var(--color-error)] mb-4">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Connection Error</h2>
          </div>
          <p className="text-gray-600 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white px-4 py-2 rounded  transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  //CHAT
  return (
    <div>
      {/* Background image layer */}
      <div
        className="h-screen w-screen bg-[var(--color-background)]"
        style={{
          position: "absolute",
          zIndex: 0,
        }}
      >
        <div className="h-screen w-screen" style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: "35%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 250,
              height: 64,
              WebkitMaskSize: "cover",
              maskSize: "cover",
              WebkitMaskImage: 'url("./gitgpt.svg")',
              maskImage: 'url("./gitgpt.svg")',
              backgroundColor: "var(--color-secondary-hover)",
            }}
          />
        </div>
      </div>
      <div
        id="chat"
        ref={chatRef}
        className="flex flex-col h-screen w-screen bg-transparent text-[var(--color-foreground)]"
        style={{ position: "absolute", zIndex: 1 }}
      >
        {/* Theme Manager */}
        <ThemeManager open={showThemeManager} onClose={closeThemeManager} />

        {/* Create New database */}
        <DatabaseCreate
          open={showCreateDatabaseModal}
          onClose={closeCreateNewDatabaseModal}
          onCreate={handleCreateDatabase}
        />

        {/* Drag and drop area */}
        <DragDropArea onDropItems={handleDropItems} />

        {/* File upload modal */}
        <FileUpload
          files={uploadedFiles}
          onUploadComplete={handleUploadComplete}
          onClearFiles={() => setUploadedFiles([])}
        />

        {/* Upload Indicator modal */}
        {showUploadComplete && (
          <UploadCompletePopup
            show={showUploadComplete}
            onClose={() => setShowUploadComplete(false)}
          />
        )}

        {/* Search modal */}
        {showSearchBar && (
          <SearchComponent
            onClose={() => setShowSearchBar(false)}
            onSelectResult={handleSelectedSearchResult}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 bg-[var(--color-background)] shadow-lg z-30 transform transition-transform duration-300 ease-in-out 
        ${showSidebar ? "translate-x-0" : "-translate-x-full"}
        w-72 flex flex-col`}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-bold text-[var(--color-foreground)]">
              Message History
            </h2>
            <button
              onClick={toggleSidebar}
              className="text-[var(--color-foreground)] hover:text-[var(--color-primary)]"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto p-4 space-y-2"
            style={{ marginBottom: "122px" }}
          >
            {sessions.length === 0 ? (
              <p className="text-[var(--color-foreground)] text-sm opacity-70">
                No messages yet.
              </p>
            ) : (
              sessions
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.lastUpdated).getTime() -
                    new Date(a.lastUpdated).getTime()
                )
                .map((session) => (
                  <div
                    key={session.id}
                    className={`p-2 rounded cursor-pointer flex justify-between items-center ${
                      session.id === sessionId
                        ? "bg-[var(--color-primary)] text-white font-semibold"
                        : "bg-[var(--color-secondary)] text-[var(--color-foreground)]"
                    }`}
                    onClick={() => {
                      handleSessionClick(session.id);
                      setShowSidebar(false);
                    }}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <button
                        aria-label={`Upload session ${session.name} as markdown`}
                        className={`p-1  ${
                          session.id === sessionId
                            ? "text-white"
                            : "text-[var(--color-primary)] hover:text-[var(--color-primary)]"
                        }`}
                        title="Upload as .md"
                        type="button"
                        onClick={() => addSessionMdFileToUploads(session.id)}
                      >
                        <Upload className="w-5 h-5" />
                      </button>

                      <div className="overflow-hidden">
                        <div className="text-sm truncate">
                          {truncate(session.name)}
                        </div>
                        <div
                          className={`text-xs opacity-70 overflow-hidden ${
                            session.id === sessionId
                              ? "bg-[var(--color-primary)] text-white font-semibold"
                              : "bg-[var(--color-secondary)] text-[var(--color-foreground)]"
                          }`}
                        >
                          Last updated:{" "}
                          {new Date(session.lastUpdated).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSessionDelete(session.id);
                      }}
                      aria-label={`Delete session ${session.name}`}
                      className={`p-1  ${
                        session.id === sessionId
                          ? "text-white"
                          : "text-[var(--color-error)] hover:text-[var(--color-error)]"
                      }`}
                      type="button"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
            )}
          </div>

          <div className="absolute bottom-0 left-0 w-full px-4 bg-[var(--color-background)] border-t border-[var(--color-border)]">
            <p className="text-center text-xs py-2 text-[var(--color-foreground)] opacity-60">
              Clearing site data will delete your messages too.
            </p>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to upload all messages?"
                  )
                ) {
                  uploadAllSessions(sessions.map((s) => s.id));
                }
              }}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white w-full py-2 rounded-lg flex items-center justify-center gap-2 shadow-md"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Messages</span>
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete all messages?"
                  )
                ) {
                  handleDeleteAllMessages();
                }
              }}
              className="text-[var(--color-error)] hover:text-[var(--color-error-hover)] w-full py-2 rounded flex items-center justify-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete Messages</span>
            </button>
          </div>
        </div>

        {/* Top bar */}
        <div
          id="top-scroll"
          className="bg-[var(--color-background)] p-4 shadow-sm overflow-x-auto border-b border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between min-w-[320px]">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                onClick={toggleSidebar}
                style={{ width: 40, height: 40, position: "relative" }}
                className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] cursor-pointer transition-transform active:scale-95 border border-[var(--color-border)] rounded-md p-1 flex-shrink-0"
              >
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 32, // 40 - 2*4 padding (p-1 = 4px)
                    height: 32,
                    transform: "translate(-50%, -50%)",
                    WebkitMaskSize: "cover",
                    maskSize: "cover",
                    WebkitMaskImage: 'url("./gitgptlogo.svg")',
                    maskImage: 'url("./gitgptlogo.svg")',
                    backgroundColor: "var(--color-foreground)",
                  }}
                />
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-foreground)] whitespace-nowrap mr-4">
                {process.env.REACT_APP_APP_NAME}
              </h1>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <button
                onClick={() => window.open(`/${uuidv4()}`, "_blank")}
                className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-foreground)] text-sm flex items-center gap-1 px-3 py-1 rounded whitespace-nowrap"
                title="New window"
              >
                <ExternalLink size={16} />
              </button>
              {/* Other buttons similarly themed */}
              <button
                onClick={newConversation}
                className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-[var(--color-foreground)] text-sm flex items-center gap-1 px-3 py-1 rounded whitespace-nowrap"
                title="New conversation"
              >
                <Plus size={16} />
              </button>
              <button
                onClick={() => setShowSearchBar(true)}
                className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] text-sm  flex items-center gap-1 px-3 py-1 rounded whitespace-nowrap"
                title="Refresh conversation"
              >
                <Search size={16} />
              </button>
              <div className="flex-shrink-0">
                {/* Prevent shrinking */}
                <ConnectionStatus
                  wsConnected={wsConnected}
                  useHttpFallback={useHttpFallback}
                  reconnectCount={reconnectCount}
                />
              </div>
              <button
                onClick={refreshConversation}
                className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] flex items-center gap-1 text-sm px-3 py-1 rounded whitespace-nowrap"
                title="Refresh conversation"
              >
                <RefreshCw size={16} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Messages section */}
        <div
          id="messages"
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 w-full max-w-full sm:max-w-[90%] mx-auto lg:max-w-[1200px]"
        >
          {/* {hasMoreMessages && !loadingMessages && (
            <button
              onClick={() =>
                setMessagePageOffset((offset) => offset + PAGE_SIZE)
              }
              className="text-sm text-[var(--color-primary)] hover:underline mb-2"
            >
              Load Older Messages
            </button>
          )} */}

          {loadingMessages && (
            <div className="text-sm italic text-[var(--color-secondary)] mb-2">
              Loading messages...
            </div>
          )}
          {/* Message items */}
          {messages
            .slice(-config.MESSAGE_HISTORY_LIMIT)
            .sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime()
            )
            .map((message, index) => {
              const isHighlighted = message.id === highlightedMessageId;
              return (
                <div
                  id="msgblock"
                  key={`#msg-${message.id}`}
                  ref={(el) => {
                    messageRefs.current[message.id] = el;
                  }}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    style={{
                      boxShadow: `0 10px 15px -3px var(--color-border)`,
                    }}
                    className={`max-w-[80%] rounded-lg p-6 mt-0 shadow-lg border border-[var(--color-secondary)] ${
                      message.role === "user"
                        ? "bg-[var(--color-background)] text-[var(--color-foreground)] ml-auto"
                        : "bg-[var(--color-background)] text-[var(--color-foreground)] mr-auto"
                    } ${isHighlighted ? "highlight-animation" : ""}`}
                    onAnimationEnd={() => {
                      if (isHighlighted) setHighlightedMessageId(null);
                    }}
                  >
                    <MessageContent
                      content={message.content}
                      role={message.role}
                      isTruncated={false}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-[var(--color-foreground)] opacity-70 mt-2">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                      <MessageActions
                        content={message.content}
                        onContinue={
                          message.role === "assistant" &&
                          index === messages.length - 1
                            ? () => continueGeneration(message.id)
                            : undefined
                        }
                        isAssistant={message.role === "assistant"}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] relative right--4 z-50000 p-2 m-0 rounded transition-colors shadow"
                    title="Scroll to bottom"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              );
            })}

          {(isLoading || typing) && (
            <div className="flex justify-start">
              <div className="bg-[var(--color-secondary)] rounded-lg p-4 shadow-sm flex items-center gap-2">
                <Loader className="w-6 h-6 animate-spin" />
                <span className="text-[var(--color-foreground)] italic">
                  Assistant is typing...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="pl-4 pr-4 pt-1 pb-4 shadow-lg">
          {error && (
            <div className="bg-[var(--color-secondary)] bg-opacity-20 text-[var(--color-error)] mb-4 p-3 rounded-lg border border-[var(--color-border)] flex items-center gap-2">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {showGptImageWindow && (
            <GptImage onClose={() => setShowGptImageWindow(false)} />
          )}

          {showDatabaseWindow && (
            <DatabaseSelector
              ref={chatRef}
              databases={databases}
              currentUser={currentUser}
              onSelectionChange={setSelectedDatabases}
              onClose={() => setShowDatabaseWindow(false)}
              onCreateNew={handleCreateNew}
              onUploadFiles={handleUploadFiles}
            />
          )}

          {showPromptWindow && <PromptWindow onSubmit={handleChangePrompt} />}

          {!showPromptWindow && (
            <MarkdownEditor
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={sendMessage}
              onDatabase={handleDatabase}
              onDownload={handleDownloadSession}
              onTranslate={onTranslate}
              onImage={() => setShowGptImageWindow(true)}
              placeholder="Type your message... (Shift + Enter for new line)"
              disabled={isLoading || typing}
            />
          )}

          <div className="flex justify-between items-center mt-4 w-full relative">
            <div
              id="flexbar-scroll-left"
              className="flex-1 overflow-x-auto max-w-[50vw] pr-6"
            >
              <div className="flex items-center gap-4 w-max h-full py-1">
                <button
                  onClick={refreshConversation}
                  className="text-[var(--color-foreground)] hover:text-[var(--color-primary)] flex items-center gap-2 whitespace-nowrap"
                  title="Clear conversation"
                >
                  <RefreshCw size={16} />
                  <span>Clear Chat</span>
                </button>
                <button
                  onClick={togglePromptWindow}
                  className="text-[var(--color-foreground)] hover:text-[var(--color-primary)] flex items-center gap-2 whitespace-nowrap"
                  title="Prompt Window"
                >
                  <Quote size={16} />
                  <span>{!showPromptWindow ? "Prompt" : "Chat"}</span>
                </button>
                <button
                  onClick={toggleRagSearch}
                  className="text-[var(--color-foreground)] hover:text-[var(--color-primary)] flex items-center gap-2 whitespace-nowrap"
                  title="Toggle RagSearch"
                >
                  {!ragSearchEnabled ? (
                    <Square size={16} />
                  ) : (
                    <CheckSquare size={16} />
                  )}
                  <span>RagSearch</span>
                </button>
                <button
                  onClick={toggleThemeManager}
                  className="text-[var(--color-foreground)] hover:text-[var(--color-primary)] flex items-center gap-2 whitespace-nowrap"
                  title="Theme"
                >
                  <PaletteIcon size={16} />
                  <span>Theme</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              {typing && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)] p-2 rounded transition-colors shadow"
                  title="Stop assistant"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      width="20"
                      height="20"
                      fill="var(--color-primary)"
                      rx="3.5 "
                      ry="3.5"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={sendMessage}
                disabled={isLoading || typing || !input.trim()}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-6 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                aria-label="Send Message"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
