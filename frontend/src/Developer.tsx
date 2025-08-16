import React, { useState, useRef, useEffect } from "react";
import { marked } from "marked";
import { Pin, FlagTriangleRight, Expand } from "lucide-react";

interface Tab {
  id: string;
  title: string;
  url: string;
  pinned?: boolean;
}

interface PanelProps {
  tabs: Tab[];
  activeTab: string | null;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabPin: (id: string) => void;
  onNewTab: (url: string) => void;
  onTabDragStart: (e: React.DragEvent, tabId: string) => void;
  onTabDragEnd: () => void;
  onTabDrop: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
  isTopPanel?: boolean;
  isDragging?: boolean;
  onMaximize?: () => void;
  onFullscreen?: () => void;
  isMaximized?: boolean;
}

const FullscreenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 472 472" fill="currentColor">
    <path d="M453,0 C463.49341,-1.92760819e-15 472,8.50658975 472,19 L472,453 C472,463.49341 463.49341,472 453,472 L19,472 C8.50658975,472 1.28507213e-15,463.49341 0,453 L0,19 C-1.28507213e-15,8.50658975 8.50658975,1.92760819e-15 19,0 L453,0 Z M88.5,257.5 C76.9020203,257.5 67.5,266.90202 67.5,278.5 L67.5,278.5 L67.4997689,380.425087 C67.1725622,381.897809 67,383.428752 67,385 C67,390.926154 69.4547223,396.278977 73.4028432,400.097145 C77.2210229,404.045278 82.5738459,406.5 88.5,406.5 C90.0694726,406.5 91.5987321,406.327827 93.0699214,406.001339 L195,406 C206.59798,406 216,396.59798 216,385 C216,373.40202 206.59798,364 195,364 L195,364 L109.5,364 L109.5,278.5 C109.5,267.019172 100.28696,257.690164 88.8507743,257.50287 Z M386,66 L279,66 C267.40202,66 258,75.4020203 258,87 C258,98.5979797 267.40202,108 279,108 L279,108 L365.5,108 L365.5,194.5 C365.5,205.980828 374.71304,215.309836 386.149226,215.49713 L386.5,215.5 C398.09798,215.5 407.5,206.09798 407.5,194.5 L407.5,194.5 L407.5,87.5 C407.5,81.5738459 405.045278,76.2210229 401.097157,72.4028548 C397.278977,68.4547223 391.926154,66 386,66 L386,66 Z" />
  </svg>
);

const RestoreIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
  </svg>
);

const Panel: React.FC<PanelProps> = ({
  tabs,
  activeTab,
  onTabClick,
  onTabClose,
  onTabPin,
  onNewTab,
  onTabDragStart,
  onTabDragEnd,
  onTabDrop,
  style,
  isTopPanel = false,
  isDragging = false,
  onMaximize,
  onFullscreen,
  isMaximized = false,
}) => {
  const [inputUrl, setInputUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State for inner panel resizing
  const [browserHeight, setBrowserHeight] = useState(70); // percentage
  const [isInnerResizing, setIsInnerResizing] = useState(false);
  const innerResizeStartY = useRef(0);
  const initialBrowserHeight = useRef(70);

  useEffect(() => {
    document.title = "AI Developer Assistant";
  }, []);

  // Convert YouTube URLs to embed format
  const getEmbedUrl = (url: string) => {
    const youtubeMatch = url.match(
      /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/
    );

    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return `https://www.youtube.com/embed/${videoId}?loop=1&mute=0&playlist=${videoId}`;
    }
    return url;
  };

  const activeUrl = getEmbedUrl(
    tabs.find((tab) => tab.id === activeTab)?.url || "about:blank"
  );

  const addTab = () => {
    if (!inputUrl.trim()) return;

    const url = inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`;
    onNewTab(url);
    setInputUrl("");
    setShowUrlInput(false);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      role: "user" as const,
      content: chatInput,
    };

    setChatMessages([...chatMessages, userMessage]);
    setChatInput("");

    // Simulate AI response
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I'm your AI assistant. You asked about: "${chatInput}". How can I help you develop this feature?`,
        },
      ]);
    }, 1000);
  };

  // Inner panel resize handlers
  const startInnerResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsInnerResizing(true);
    innerResizeStartY.current = e.clientY;
    initialBrowserHeight.current = browserHeight;
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const handleInnerMouseMove = (e: MouseEvent) => {
      if (!isInnerResizing) return;

      const container = iframeRef.current?.parentElement?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const deltaY = innerResizeStartY.current - e.clientY;
      const heightDelta = (deltaY / containerRect.height) * 100;

      const newHeight = Math.min(
        Math.max(30, initialBrowserHeight.current - heightDelta),
        85
      );

      setBrowserHeight(newHeight);
    };

    const handleInnerMouseUp = () => {
      setIsInnerResizing(false);
      document.body.style.userSelect = "";
    };

    if (isInnerResizing) {
      document.addEventListener("mousemove", handleInnerMouseMove);
      document.addEventListener("mouseup", handleInnerMouseUp);
      document.addEventListener("mouseleave", handleInnerMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleInnerMouseMove);
      document.removeEventListener("mouseup", handleInnerMouseUp);
      document.removeEventListener("mouseleave", handleInnerMouseUp);
    };
  }, [isInnerResizing]);

  return (
    <div
      className={`flex flex-col h-full rounded-lg overflow-hidden shadow-lg ${
        isTopPanel ? "mb-4" : ""
      }`}
      style={{
        ...style,
        backgroundColor: "var(--color-background)",
        border: "1px solid var(--color-border)",
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onTabDrop}
    >
      {/* Tab Bar */}
      <div
        className="flex items-center p-1 border-b"
        style={{
          backgroundColor: "var(--color-secondary)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="flex flex-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => onTabDragStart(e, tab.id)}
              onDragEnd={onTabDragEnd}
              className={`flex items-center px-3 py-1 mx-1 rounded-t-lg cursor-pointer ${
                activeTab === tab.id
                  ? "border-t border-l border-r"
                  : "hover:bg-[var(--color-secondary-hover)]"
              }`}
              onClick={() => onTabClick(tab.id)}
              style={{
                backgroundColor:
                  activeTab === tab.id
                    ? "var(--color-background)"
                    : "var(--color-secondary)",
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
              }}
            >
              <span className="truncate max-w-xs">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="ml-2 hover:text-[var(--color-primary)]"
                style={{ color: "var(--color-foreground)" }}
              >
                ×
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabPin(tab.id);
                }}
                className="ml-1 hover:text-[var(--color-primary)]"
                title={tab.pinned ? "Unpin" : "Pin to top"}
                style={{ color: "var(--color-foreground)" }}
              >
                {tab.pinned ? (
                  <FlagTriangleRight width={16} height={16} />
                ) : (
                  <Pin width={16} height={16} />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="flex space-x-1">
          {showUrlInput ? (
            <div className="flex">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Enter URL..."
                className="px-2 py-1 rounded-l text-sm"
                onKeyDown={(e) => e.key === "Enter" && addTab()}
                autoFocus
                style={{
                  backgroundColor: "var(--color-background)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-foreground)",
                }}
              />
              <button
                onClick={addTab}
                className="px-2 py-1 text-white rounded-r text-sm"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                Go
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              className="px-2 py-1 rounded text-sm"
              style={{
                backgroundColor: "var(--color-secondary)",
                color: "var(--color-foreground)",
                border: "1px solid var(--color-border)",
              }}
            >
              +
            </button>
          )}

          {/* Maximize Button */}
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="ml-1 p-1 hover:text-[var(--color-primary)]"
              title={isMaximized ? "Restore" : "Maximize"}
              style={{ color: "var(--color-foreground)" }}
            >
              {isMaximized ? (
                <RestoreIcon />
              ) : (
                <Expand width={16} height={16} />
              )}
            </button>
          )}

          {/* Fullscreen Button */}
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="ml-1 p-1 hover:text-[var(--color-primary)]"
              title="Fullscreen"
              style={{ color: "var(--color-foreground)" }}
            >
              <FullscreenIcon />
            </button>
          )}
        </div>
      </div>

      {/* Browser */}
      <div
        className="flex-1 min-h-0 relative"
        style={{ height: `${browserHeight}%` }}
      >
        {tabs.length === 0 && isTopPanel && isDragging ? (
          <div
            className="w-full h-full flex items-center justify-center border-2 border-dashed"
            style={{
              backgroundColor: "var(--color-secondary)",
              borderColor: "var(--color-primary)",
              color: "var(--color-primary)",
            }}
          >
            <p className="font-medium">Drop here to pin to top panel</p>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={activeUrl}
            title="Developer Browser"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        )}
      </div>

      {/* Inner resize handle for browser/chat */}
      {!isTopPanel && (
        <div
          className="h-1 cursor-row-resize transition-opacity"
          onMouseDown={startInnerResize}
          style={{
            background:
              "linear-gradient(to right, transparent, var(--color-primary), transparent)",
            opacity: 0.3,
          }}
        />
      )}

      {/* Chat */}
      {!isTopPanel && (
        <div
          className="flex flex-col border-t min-h-0"
          style={{
            height: `${100 - browserHeight}%`,
            borderColor: "var(--color-border)",
          }}
        >
          <div
            className="flex-1 overflow-y-auto p-2"
            style={{ backgroundColor: "var(--color-secondary)" }}
          >
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`mb-2 p-2 rounded ${
                  msg.role === "user" ? "ml-auto max-w-xs" : "mr-auto max-w-xs"
                }`}
                style={{
                  backgroundColor:
                    msg.role === "user"
                      ? "var(--color-primary)"
                      : "var(--color-secondary)",
                  color:
                    msg.role === "user"
                      ? "var(--color-background)"
                      : "var(--color-foreground)",
                }}
                dangerouslySetInnerHTML={{
                  __html: marked.parse(msg.content),
                }}
              />
            ))}
          </div>
          <div
            className="flex p-2 border-t"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-secondary)",
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask AI about development..."
              className="flex-1 px-2 py-1 rounded-l text-sm"
              onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
              style={{
                backgroundColor: "var(--color-background)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />
            <button
              onClick={sendChatMessage}
              className="px-4 py-1 text-white rounded-r text-sm"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Developer: React.FC = () => {
  const defaultTabs = [
    {
      id: "tab-forgejo",
      title: "Forgejo",
      url: "https://forgejo.win10dev.xyz",
    },
    {
      id: "tab-vscode",
      title: "VSCode",
      url: "https://vscode.win10dev.xyz",
    },
    {
      id: "tab-windows",
      title: "Windows",
      url: "https://rds.win10dev.xyz",
    },
  ];

  // State for all tabs
  const [allTabs, setAllTabs] = useState<Tab[]>([
    ...defaultTabs,
    { id: "tab-example", title: "Example", url: "https://example.com" },
  ]);

  // State for panel tabs
  const [topPanelTabs, setTopPanelTabs] = useState<Tab[]>([]);
  const [panel1Tabs, setPanel1Tabs] = useState<Tab[]>([defaultTabs[0]]);
  const [panel2Tabs, setPanel2Tabs] = useState<Tab[]>([defaultTabs[1]]);
  const [panel3Tabs, setPanel3Tabs] = useState<Tab[]>([defaultTabs[2]]);

  // Active tabs
  const [activeTopTab, setActiveTopTab] = useState<string | null>(null);
  const [activePanel1Tab, setActivePanel1Tab] = useState<string | null>(
    defaultTabs[0].id
  );
  const [activePanel2Tab, setActivePanel2Tab] = useState<string | null>(
    defaultTabs[1].id
  );
  const [activePanel3Tab, setActivePanel3Tab] = useState<string | null>(
    defaultTabs[2].id
  );

  // Dragging state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  // Resize states
  const [topPanelHeight, setTopPanelHeight] = useState(30); // in percentage
  const [panel1Width, setPanel1Width] = useState(33);
  const [panel2Width, setPanel2Width] = useState(34);
  const [panel3Width, setPanel3Width] = useState(33);
  const [isResizing, setIsResizing] = useState<
    "top" | "panel1" | "panel2" | null
  >(null);

  // New states for maximize/fullscreen
  const [maximizedPanel, setMaximizedPanel] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcutPopup, setShowShortcutPopup] = useState(false);

  // Refs for resize values
  const containerRef = useRef<HTMLDivElement>(null);
  const initialMousePosition = useRef({ x: 0, y: 0 });
  const initialSizes = useRef({ top: 0, panel1: 0, panel2: 0, panel3: 0 });

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        alert(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
        );
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Show shortcut popup when entering fullscreen or maximize mode
  useEffect(() => {
    if (isFullscreen || maximizedPanel) {
      setShowShortcutPopup(true);
      const timer = setTimeout(() => {
        setShowShortcutPopup(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, maximizedPanel]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Exit fullscreen with Ctrl+Esc
      if (e.ctrlKey && e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }

      // Exit maximize with Ctrl+M
      if (e.ctrlKey && e.key === "m") {
        setMaximizedPanel(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Save layout as JSON
  const saveLayout = () => {
    const layout = {
      topPanelTabs,
      panel1Tabs,
      panel2Tabs,
      panel3Tabs,
      activeTopTab,
      activePanel1Tab,
      activePanel2Tab,
      activePanel3Tab,
      topPanelHeight,
      panel1Width,
      panel2Width,
      panel3Width,
      allTabs,
    };

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(layout, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "workspace_layout.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Find which panel a tab is in
  const findTabPanel = (tabId: string) => {
    if (topPanelTabs.some((t) => t.id === tabId)) return "top";
    if (panel1Tabs.some((t) => t.id === tabId)) return "panel1";
    if (panel2Tabs.some((t) => t.id === tabId)) return "panel2";
    if (panel3Tabs.some((t) => t.id === tabId)) return "panel3";
    return null;
  };

  // Move tab between panels
  const moveTabToPanel = (tabId: string, targetPanel: string) => {
    const sourcePanel = findTabPanel(tabId);
    if (!sourcePanel || sourcePanel === targetPanel) return;

    const tab = allTabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Remove from source panel
    if (sourcePanel === "top") {
      setTopPanelTabs((top) => top.filter((t) => t.id !== tabId));
    } else if (sourcePanel === "panel1") {
      setPanel1Tabs((p1) => p1.filter((t) => t.id !== tabId));
    } else if (sourcePanel === "panel2") {
      setPanel2Tabs((p2) => p2.filter((t) => t.id !== tabId));
    } else if (sourcePanel === "panel3") {
      setPanel3Tabs((p3) => p3.filter((t) => t.id !== tabId));
    }

    // Add to target panel
    if (targetPanel === "top") {
      setTopPanelTabs((top) => [...top, { ...tab, pinned: true }]);
      setActiveTopTab(tabId);
    } else if (targetPanel === "panel1") {
      setPanel1Tabs((p1) => [...p1, { ...tab, pinned: false }]);
      setActivePanel1Tab(tabId);
    } else if (targetPanel === "panel2") {
      setPanel2Tabs((p2) => [...p2, { ...tab, pinned: false }]);
      setActivePanel2Tab(tabId);
    } else if (targetPanel === "panel3") {
      setPanel3Tabs((p3) => [...p3, { ...tab, pinned: false }]);
      setActivePanel3Tab(tabId);
    }
  };

  // Handle drag start
  const handleTabDragStart = (e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData("text/plain", tabId);
    setDraggedTabId(tabId);
  };

  // Handle drag end
  const handleTabDragEnd = () => {
    setDraggedTabId(null);
  };

  // Handle drop
  const handleTabDrop = (e: React.DragEvent, targetPanel: string) => {
    e.preventDefault();
    const tabId = e.dataTransfer.getData("text/plain");
    moveTabToPanel(tabId, targetPanel);
    setDraggedTabId(null);
  };

  // Create new tab
  const handleNewTab = (url: string, panel: string) => {
    const id = `tab-${Date.now()}`;
    const title = new URL(url).hostname;
    const newTab = { id, title, url };

    setAllTabs([...allTabs, newTab]);

    if (panel === "top") {
      setTopPanelTabs([...topPanelTabs, { ...newTab, pinned: true }]);
      setActiveTopTab(id);
    } else if (panel === "panel1") {
      setPanel1Tabs([...panel1Tabs, newTab]);
      setActivePanel1Tab(id);
    } else if (panel === "panel2") {
      setPanel2Tabs([...panel2Tabs, newTab]);
      setActivePanel2Tab(id);
    } else if (panel === "panel3") {
      setPanel3Tabs([...panel3Tabs, newTab]);
      setActivePanel3Tab(id);
    }
  };

  // Close tab
  const handleCloseTab = (tabId: string, panel: string) => {
    if (panel === "top") {
      setTopPanelTabs((top) => {
        const newTabs = top.filter((t) => t.id !== tabId);
        if (activeTopTab === tabId) {
          setActiveTopTab(newTabs[0]?.id || null);
        }
        return newTabs;
      });
    } else if (panel === "panel1") {
      setPanel1Tabs((p1) => {
        const newTabs = p1.filter((t) => t.id !== tabId);
        if (activePanel1Tab === tabId) {
          setActivePanel1Tab(newTabs[0]?.id || null);
        }
        return newTabs;
      });
    } else if (panel === "panel2") {
      setPanel2Tabs((p2) => {
        const newTabs = p2.filter((t) => t.id !== tabId);
        if (activePanel2Tab === tabId) {
          setActivePanel2Tab(newTabs[0]?.id || null);
        }
        return newTabs;
      });
    } else if (panel === "panel3") {
      setPanel3Tabs((p3) => {
        const newTabs = p3.filter((t) => t.id !== tabId);
        if (activePanel3Tab === tabId) {
          setActivePanel3Tab(newTabs[0]?.id || null);
        }
        return newTabs;
      });
    }
  };

  // Pin/unpin tab
  const handlePinTab = (tabId: string) => {
    const currentPanel = findTabPanel(tabId);
    if (!currentPanel) return;

    if (currentPanel === "top") {
      // Unpin - move to first available bottom panel
      const targetPanel =
        panel1Tabs.length < 5
          ? "panel1"
          : panel2Tabs.length < 5
          ? "panel2"
          : "panel3";
      moveTabToPanel(tabId, targetPanel);
    } else {
      // Pin - move to top panel
      moveTabToPanel(tabId, "top");
    }
  };

  // Resize handlers
  const startResize = (
    type: "top" | "panel1" | "panel2",
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    setIsResizing(type);
    initialMousePosition.current = { x: e.clientX, y: e.clientY };
    initialSizes.current = {
      top: topPanelHeight,
      panel1: panel1Width,
      panel2: panel2Width,
      panel3: panel3Width,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      if (isResizing === "top") {
        // Resize top panel height
        const mouseYDelta = e.clientY - initialMousePosition.current.y;
        const heightDelta = (mouseYDelta / containerHeight) * 100;
        const newHeight = Math.min(
          Math.max(20, initialSizes.current.top + heightDelta),
          70
        );
        setTopPanelHeight(newHeight);
      } else {
        // Resize bottom panels
        const mouseXDelta = e.clientX - initialMousePosition.current.x;
        const widthDelta = (mouseXDelta / containerWidth) * 100;

        if (isResizing === "panel1") {
          // Resize between panel1 and panel2
          const newPanel1 = Math.min(
            Math.max(20, initialSizes.current.panel1 + widthDelta),
            60
          );
          const newPanel2 = Math.min(
            Math.max(20, initialSizes.current.panel2 - widthDelta),
            60
          );
          const remaining = 100 - newPanel1 - newPanel2;

          setPanel1Width(newPanel1);
          setPanel2Width(newPanel2);
          setPanel3Width(remaining);
        } else if (isResizing === "panel2") {
          // Resize between panel2 and panel3
          const newPanel2 = Math.min(
            Math.max(20, initialSizes.current.panel2 + widthDelta),
            60
          );
          const newPanel3 = Math.min(
            Math.max(20, initialSizes.current.panel3 - widthDelta),
            60
          );
          const remaining = 100 - newPanel2 - newPanel3;

          setPanel2Width(newPanel2);
          setPanel3Width(newPanel3);
          setPanel1Width(remaining);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("mouseleave", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [isResizing]);

  // Calculate heights based on whether top panel is visible
  const bottomPanelsHeight =
    topPanelTabs.length > 0 || draggedTabId
      ? `${100 - topPanelHeight}%`
      : "100%";

  // Clean up drag state when component unmounts
  useEffect(() => {
    return () => {
      setDraggedTabId(null);
    };
  }, []);

  return (
    <div
      id="developer-container"
      className="h-screen w-screen p-4 overflow-hidden flex flex-col"
      ref={containerRef}
      style={{ backgroundColor: "var(--color-background)" }}
    >
      <div className="flex justify-between items-center mb-4">
        <h1
          className="text-3xl font-bold flex items-center gap-2"
          style={{ color: "var(--color-foreground)" }}
        >
          <a
            href="/"
            className="cursor-pointer transition-transform active:scale-95 rounded-md p-1 flex-shrink-0 inline-flex"
            style={{
              width: "40px",
              height: "40px",
              position: "relative",
              backgroundColor: "var(--color-secondary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 32,
                height: 32,
                transform: "translate(-50%, -50%)",
                WebkitMaskSize: "cover",
                maskSize: "cover",
                WebkitMaskImage: 'url("./gitgptlogo.svg")',
                maskImage: 'url("./gitgptlogo.svg")',
                backgroundColor: "var(--color-foreground)",
              }}
            />
          </a>
          Game Development Workspace
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={saveLayout}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-background)",
            }}
          >
            Load Layout
          </button>
          <button
            onClick={saveLayout}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: "var(--color-success)",
              color: "var(--color-background)",
            }}
          >
            Save Layout
          </button>
        </div>
      </div>

      {/* Shortcut Popup */}
      {showShortcutPopup && (
        <div
          className="fixed bottom-4 right-4 p-4 rounded-lg z-50 shadow-lg"
          style={{
            backgroundColor: "var(--color-footer)",
            color: "var(--color-footer-text)",
          }}
        >
          <p className="font-semibold">Keyboard Shortcuts:</p>
          <p>Ctrl+Esc: Exit Full screen</p>
          <p>Ctrl+M: Exit Maximum window</p>
        </div>
      )}

      {/* Top Panel - only visible when tabs are pinned OR during drag */}
      {(topPanelTabs.length > 0 || draggedTabId) && !maximizedPanel && (
        <div
          style={{
            height: `${topPanelHeight}%`,
            transition: isResizing ? "none" : "height 0.3s ease",
          }}
          className="mb-4 relative"
        >
          <Panel
            tabs={topPanelTabs}
            activeTab={activeTopTab}
            onTabClick={setActiveTopTab}
            onTabClose={(id) => handleCloseTab(id, "top")}
            onTabPin={handlePinTab}
            onNewTab={(url) => handleNewTab(url, "top")}
            onTabDragStart={handleTabDragStart}
            onTabDragEnd={handleTabDragEnd}
            onTabDrop={(e) => handleTabDrop(e, "top")}
            isTopPanel={true}
            isDragging={!!draggedTabId}
            onMaximize={() => setMaximizedPanel("top")}
            onFullscreen={toggleFullscreen}
            isMaximized={maximizedPanel === "top"}
          />
          {/* Top panel resize handle */}
          <div
            className="absolute bottom-0 left-0 right-0 h-1 z-10 transition-opacity"
            onMouseDown={(e) => startResize("top", e)}
            style={{
              background:
                "linear-gradient(to right, transparent, var(--color-primary), transparent)",
              opacity: 0.3,
              cursor: "row-resize",
            }}
          />
        </div>
      )}

      {/* Bottom Panels */}
      {!maximizedPanel && (
        <div
          style={{
            height: bottomPanelsHeight,
            transition: isResizing ? "none" : "height 0.3s ease",
          }}
          className="flex min-h-0 relative"
        >
          {/* Panel 1 */}
          <div
            className="h-full"
            style={{
              width: `${panel1Width}%`,
              transition: isResizing ? "none" : "width 0.3s ease",
            }}
          >
            <Panel
              tabs={panel1Tabs}
              activeTab={activePanel1Tab}
              onTabClick={setActivePanel1Tab}
              onTabClose={(id) => handleCloseTab(id, "panel1")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "panel1")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "panel1")}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel("panel1")}
              onFullscreen={toggleFullscreen}
            />
          </div>

          {/* Panel 1-2 resize handle */}
          <div
            className="w-1 z-10 transition-opacity"
            onMouseDown={(e) => startResize("panel1", e)}
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--color-primary), transparent)",
              opacity: 0.3,
              cursor: "col-resize",
            }}
          />

          {/* Panel 2 */}
          <div
            className="h-full"
            style={{
              width: `${panel2Width}%`,
              transition: isResizing ? "none" : "width 0.3s ease",
            }}
          >
            <Panel
              tabs={panel2Tabs}
              activeTab={activePanel2Tab}
              onTabClick={setActivePanel2Tab}
              onTabClose={(id) => handleCloseTab(id, "panel2")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "panel2")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "panel2")}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel("panel2")}
              onFullscreen={toggleFullscreen}
            />
          </div>

          {/* Panel 2-3 resize handle */}
          <div
            className="w-1 z-10 transition-opacity"
            onMouseDown={(e) => startResize("panel2", e)}
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--color-primary), transparent)",
              opacity: 0.3,
              cursor: "col-resize",
            }}
          />

          {/* Panel 3 */}
          <div
            className="h-full"
            style={{
              width: `${panel3Width}%`,
              transition: isResizing ? "none" : "width 0.3s ease",
            }}
          >
            <Panel
              tabs={panel3Tabs}
              activeTab={activePanel3Tab}
              onTabClick={setActivePanel3Tab}
              onTabClose={(id) => handleCloseTab(id, "panel3")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "panel3")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "panel3")}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel("panel3")}
              onFullscreen={toggleFullscreen}
            />
          </div>
        </div>
      )}

      {/* Maximized Panel View */}
      {maximizedPanel && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "var(--color-background)" }}
        >
          {maximizedPanel === "top" && (
            <Panel
              tabs={topPanelTabs}
              activeTab={activeTopTab}
              onTabClick={setActiveTopTab}
              onTabClose={(id) => handleCloseTab(id, "top")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "top")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "top")}
              isTopPanel={true}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel(null)}
              onFullscreen={toggleFullscreen}
              isMaximized={true}
              style={{ height: "100vh" }}
            />
          )}
          {maximizedPanel === "panel1" && (
            <Panel
              tabs={panel1Tabs}
              activeTab={activePanel1Tab}
              onTabClick={setActivePanel1Tab}
              onTabClose={(id) => handleCloseTab(id, "panel1")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "panel1")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "panel1")}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel(null)}
              onFullscreen={toggleFullscreen}
              isMaximized={true}
              style={{ height: "100vh" }}
            />
          )}
          {maximizedPanel === "panel2" && (
            <Panel
              tabs={panel2Tabs}
              activeTab={activePanel2Tab}
              onTabClick={setActivePanel2Tab}
              onTabClose={(id) => handleCloseTab(id, "panel2")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "panel2")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "panel2")}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel(null)}
              onFullscreen={toggleFullscreen}
              isMaximized={true}
              style={{ height: "100vh" }}
            />
          )}
          {maximizedPanel === "panel3" && (
            <Panel
              tabs={panel3Tabs}
              activeTab={activePanel3Tab}
              onTabClick={setActivePanel3Tab}
              onTabClose={(id) => handleCloseTab(id, "panel3")}
              onTabPin={handlePinTab}
              onNewTab={(url) => handleNewTab(url, "panel3")}
              onTabDragStart={handleTabDragStart}
              onTabDragEnd={handleTabDragEnd}
              onTabDrop={(e) => handleTabDrop(e, "panel3")}
              isDragging={!!draggedTabId}
              onMaximize={() => setMaximizedPanel(null)}
              onFullscreen={toggleFullscreen}
              isMaximized={true}
              style={{ height: "100vh" }}
            />
          )}
        </div>
      )}

      {/* Drop Indicator */}
      {draggedTabId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="p-4 rounded-lg shadow-lg"
            style={{
              backgroundColor: "var(--color-background)",
              border: "1px solid var(--color-border)",
              color: "var(--color-foreground)",
            }}
          >
            <p>Drag tab to move between panels</p>
            <p>Drop on top panel to pin</p>
            <p>Pin to top using 📍 icon</p>
            <button
              className="mt-2 px-3 py-1 text-white rounded"
              onClick={() => setDraggedTabId(null)}
              style={{ backgroundColor: "var(--color-error)" }}
            >
              Cancel Drag
            </button>
          </div>
        </div>
      )}

      {/* Resize Indicator */}
      {isResizing && <div className="fixed inset-0 z-40 pointer-events-none" />}
    </div>
  );
};

export default Developer;
