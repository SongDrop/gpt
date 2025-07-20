import React, { useEffect, useState } from "react";

interface BuyMeACoffeeWidgetProps {
  id: string;
  color: string; // e.g. "#FF813F"
  position: "left" | "right";
  xMargin: number; // in px
  yMargin: number; // in px
  description?: string;
  message?: string;
  onClose?: () => void; // callback when widget closes
}

const BuyMeACoffeeWidget: React.FC<BuyMeACoffeeWidgetProps> = ({
  id,
  color,
  position,
  xMargin,
  yMargin,
  description = "",
  message = "",
  onClose,
}) => {
  const [iframeVisible, setIframeVisible] = useState(true);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);

    const font = new FontFace(
      "Avenir Book",
      "url(https://cdn.buymeacoffee.com/bmc_widget/font/710789a0-1557-48a1-8cec-03d52d663d74.eot)"
    );
    font
      .load()
      .then(() => {
        document.fonts.add(font);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const iframeHeight = windowHeight - 120;

  const minMargin = 16;
  const isWide = windowWidth >= 480;

  const maxAllowedWidth = windowWidth - minMargin * 2;
  const maxAllowedHeight = windowHeight - minMargin * 2;

  const iframeWidth = isWide ? Math.min(420, maxAllowedWidth) : maxAllowedWidth;
  const iframeHeightAdjusted = isWide
    ? Math.min(iframeHeight, maxAllowedHeight)
    : maxAllowedHeight;

  const closeWidget = () => {
    setIframeVisible(false);
    if (onClose) onClose();
  };

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 9999999,
    backgroundColor: "rgba(0,0,0,0.3)",
    display: iframeVisible ? "flex" : "none",
    alignItems: "flex-end",
    justifyContent: isWide
      ? position === "left"
        ? "flex-start"
        : "flex-end"
      : "center",
    pointerEvents: iframeVisible ? "auto" : "none",
  };

  // New wrapper style around iframe and close button
  const iframeWrapperStyle: React.CSSProperties = {
    position: "fixed",
    bottom: isWide ? yMargin + 72 : minMargin,
    width: iframeWidth,
    height: iframeHeightAdjusted,
    borderRadius: 10,
    boxShadow: "-6px 0px 30px rgba(13, 12, 34, 0.1)",
    background: "#fff",
    overflow: "hidden",
    userSelect: "none",
    zIndex: 999999,
    ...(isWide
      ? position === "left"
        ? { left: xMargin }
        : { right: xMargin }
      : {
          left: "50%",
          transform: "translateX(-50%)",
        }),
  };

  const iframeStyle: React.CSSProperties = {
    border: "0",
    width: "100%",
    height: "100%",
    backgroundImage:
      "url(https://cdn.buymeacoffee.com/assets/img/widget/loader.svg)",
    backgroundPosition: "center",
    backgroundSize: 64,
    backgroundRepeat: "no-repeat",
  };

  const closeBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: "100px",
    background: "white",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    zIndex: 10000000,
  };

  const [showMessage, setShowMessage] = useState(!!message);

  useEffect(() => {
    if (!message) return;
    const hideTimeout = setTimeout(() => setShowMessage(false), 5000);
    return () => clearTimeout(hideTimeout);
  }, [message]);

  const messageStyle: React.CSSProperties = {
    position: "fixed",
    bottom: yMargin - 2,
    background: "#ffffff",
    zIndex: 9999,
    padding: "16px 16px",
    borderRadius: 4,
    fontSize: 18,
    color: "#0D0C22",
    maxWidth: 260,
    lineHeight: 1.5,
    fontFamily: '"Avenir Book", sans-serif',
    boxShadow:
      "0px 2px 5px rgba(0, 0, 0, 0.05), 0px 8px 40px rgba(0, 0, 0, 0.04), 0px 0px 2px rgba(0, 0, 0, 0.15)",
    opacity: showMessage ? 1 : 0,
    visibility: showMessage ? "visible" : "hidden",
    transition: "opacity 0.25s ease",
    ...(position === "left"
      ? {
          left: xMargin + 84,
          transformOrigin: "right bottom",
          transform: showMessage ? "scale(1)" : "scale(0.7)",
        }
      : {
          right: xMargin + 84,
          transformOrigin: "right bottom",
          transform: showMessage ? "scale(1)" : "scale(0.7)",
        }),
  };

  return (
    <>
      {iframeVisible && (
        <div
          style={containerStyle}
          onClick={closeWidget}
          aria-label="Close Buy Me a Coffee widget overlay"
        >
          <div
            style={iframeWrapperStyle}
            onClick={(e) => e.stopPropagation()} // prevent overlay close when clicking iframe or close button
          >
            <iframe
              id="bmc-iframe"
              title="Buy Me a Coffee"
              allow="payment"
              src={`https://www.buymeacoffee.com/widget/page/${id}?description=${encodeURIComponent(
                description
              )}&color=${encodeURIComponent(color)}`}
              style={iframeStyle}
            />
            <div
              style={closeBtnStyle}
              onClick={closeWidget}
              aria-label="Close Buy Me a Coffee widget"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  closeWidget();
                }
              }}
            >
              <svg
                style={{ width: 16, height: 16 }}
                width="16"
                height="16"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M2.45156 27.6516L0.351562 25.5516L11.9016 14.0016L0.351562 2.45156L2.45156 0.351562L14.0016 11.9016L25.5516 0.351562L27.6516 2.45156L16.1016 14.0016L27.6516 25.5516L25.5516 27.6516L14.0016 16.1016L2.45156 27.6516Z"
                  fill="#666"
                />
              </svg>
            </div>
          </div>
          {message && <div style={messageStyle}>{message}</div>}
        </div>
      )}
    </>
  );
};

export default BuyMeACoffeeWidget;
