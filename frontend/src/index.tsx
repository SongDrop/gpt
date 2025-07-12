import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import ChatApp from "./ChatApp";
import ErrorBoundary from "./components/ErrorBoundary";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ChatApp />
    </ErrorBoundary>
  </React.StrictMode>
);
