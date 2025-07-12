import React, { useEffect, useState, useCallback, useRef } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import { marked } from "marked";

interface MessageContentProps {
  content: string;
  role: "user" | "assistant" | "system";
  isTruncated?: boolean;
  isHtmlEmail?: boolean; // add prop to detect html email
  fullHtml?: boolean; // add prop to detect fullHtml mode
  iframeWidth?: string | number;
  iframeHeight?: string | number;
}

const MessageContent: React.FC<MessageContentProps> = ({
  content = "",
  role,
  isTruncated = false,
  isHtmlEmail = false,
  fullHtml = false,
  iframeWidth = "100%",
  iframeHeight = 400,
}) => {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedCodeBlocks, setCopiedCodeBlocks] = useState<Set<number>>(
    new Set()
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    Prism.highlightAll();
  }, [content]);

  const copyMessageToClipboard = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    });
  }, [content]);

  const copyCodeBlockToClipboard = useCallback(
    (code: string, index: number) => {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedCodeBlocks((prev) => new Set(prev).add(index));
        setTimeout(() => {
          setCopiedCodeBlocks((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 2000);
      });
    },
    []
  );

  // Custom marked renderer to include copy buttons on code blocks
  const renderer = new marked.Renderer();

  renderer.code = function (code: string, language?: string) {
    if (!language) {
      const yamlIndicators = [": ", "name:", "template:", "network:", "roles:"];
      if (yamlIndicators.some((indicator) => code.includes(indicator))) {
        language = "yaml";
      }
    }

    const validLanguage = Prism.languages[language || ""]
      ? language
      : "plaintext";
    const highlighted = Prism.highlight(
      code,
      Prism.languages[validLanguage || "plaintext"],
      validLanguage || "plaintext"
    );

    return `
  <div class="code-block-wrapper relative rounded-lg my-3 group">
    <div class="absolute right-2 top-2 flex gap-2">
      <button 
        type="button" 
        class="copy-code-button bg-gray-700 text-gray-300 px-2 py-1 text-xs rounded select-none"
        aria-label="Copy code"
        data-copy-code="true"
      >
        Copy
      </button>
      ${
        language
          ? `<div class="code-language text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 select-none">${language}</div>`
          : ""
      }
    </div>
    <pre class="!bg-gray-900 !p-4 !m-0 overflow-x-auto rounded"><code class="language-${validLanguage} !bg-transparent">${highlighted}</code></pre>
      <div class="absolute right-2 bottom-2 flex gap-2">
      <button 
        type="button" 
        class="copy-code-button bg-gray-700 text-gray-300 px-2 py-1 text-xs rounded select-none"
        aria-label="Copy code"
        data-copy-code="true"
      >
        Copy
      </button>
      ${
        language
          ? `<div class="code-language text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 select-none">${language}</div>`
          : ""
      }
    </div>
  </div>
`;
  };

  renderer.codespan = function (text: string) {
    text = text.replace(/^`|`$/g, "");
    return `<code class="inline-code">${text}</code>`;
  };

  renderer.link = function (href, title, text) {
    if (!href) {
      // If href is null or undefined, render just the text without link
      return text;
    }

    const youtubeMatch = href.match(
      /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/
    );

    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return `
        <iframe
          width="560"
          height="315"
          src="https://www.youtube.com/embed/${videoId}?loop=1&mute=0&playlist=${videoId}"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          style="margin:6px 0px; border:none;"
          title="YouTube video player"
        ></iframe>
      `;
    }

    const titleAttr = title ? ` title="${title}"` : "";
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  marked.use({ renderer });

  const safeContent = content || "";
  const htmlContent = safeContent ? marked.parse(safeContent) : "";

  // Special effect for HTML email to sanitize and isolate styles
  useEffect(() => {
    if (isHtmlEmail && containerRef.current) {
      const container = containerRef.current;

      // Isolate the email styles by prefixing them
      const styleElements = container.querySelectorAll("style");
      styleElements.forEach((style) => {
        const originalCss = style.innerHTML;
        const prefixedCss = originalCss.replace(
          /([^{}]+)\{/g,
          (match, selector) => {
            // Don't prefix @ rules
            if (selector.trim().startsWith("@")) return match;
            return `.email-container ${selector}{`;
          }
        );
        style.innerHTML = prefixedCss;
      });

      // Remove any potentially conflicting elements
      const headElements = container.querySelectorAll(
        "head, title, meta, link"
      );
      headElements.forEach((el) => el.remove());

      // Fix iframe sources to ensure they're secure
      const iframes = container.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        const src = iframe.getAttribute("src") || "";
        if (src.startsWith("//")) {
          iframe.setAttribute("src", `https:${src}`);
        } else if (src.startsWith("http://")) {
          iframe.setAttribute("src", src.replace("http://", "https://"));
        }
      });
    }
  }, [isHtmlEmail]);

  // If fullHtml is true, render inside iframe
  useEffect(() => {
    if (fullHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
      }
    }
  }, [fullHtml, content]);

  // Copy code button click handlers inside container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const copyButtons = container.querySelectorAll<HTMLButtonElement>(
      "button.copy-code-button"
    );

    const handleClick = (event: MouseEvent) => {
      const button = event.currentTarget as HTMLButtonElement;
      const wrapper = button.closest(".code-block-wrapper");
      const codeElement = wrapper?.querySelector("pre code");

      if (!codeElement) return;

      const codeText = codeElement.textContent || "";

      navigator.clipboard.writeText(codeText).then(() => {
        button.classList.add("copied");
        const originalText = button.textContent;
        button.textContent = "Copied!";

        setTimeout(() => {
          button.classList.remove("copied");
          button.textContent = originalText || "Copy";
        }, 2000);
      });
    };

    copyButtons.forEach((button) => {
      button.addEventListener("click", handleClick);
    });

    return () => {
      copyButtons.forEach((button) => {
        button.removeEventListener("click", handleClick);
      });
    };
  }, [htmlContent]);

  // Container classes for non-html-email rendering
  const containerClasses = `message-content ${
    isTruncated ? "message-truncated" : ""
  } ${role === "user" ? "user-message" : "assistant-message"}`;

  // If user sends just plain text or youtube iframe, render normal markdown/html content
  // If isHtmlEmail is true, render sanitized email container
  if (fullHtml) {
    return (
      <iframe
        ref={iframeRef}
        title="Full HTML content"
        style={{
          width: iframeWidth,
          height: iframeHeight,
          border: "none",
          borderRadius: 8,
          boxShadow: "0 0 10px rgba(0,0,0,0.3)",
        }}
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    );
  }

  if (isHtmlEmail) {
    return (
      <div
        ref={containerRef}
        className="email-container"
        style={{
          maxWidth: "100%",
          overflow: "auto",
          border: "1px solid #444",
          borderRadius: "8px",
          padding: "16px",
          backgroundColor: "#121212",
          color: "#f0f0f0",
          margin: "16px 0",
          position: "relative",
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    );
  }

  return (
    <div className={containerClasses}>
      <div
        ref={containerRef}
        className={`prose max-w-none relative ${
          role === "user"
            ? "prose-p:text-gray-900 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-900"
            : "prose-p:text-gray-900 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-900"
        }`}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {isTruncated && (
        <div className="absolute bottom-0 left-0 right-0 text-center py-1 text-xs text-gray-500">
          Message truncated - click "Continue" to see more
        </div>
      )}
      <style>{`
        .copy-code-button.copied {
          background-color: #10b981;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default MessageContent;
