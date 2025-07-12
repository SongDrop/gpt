// App.tsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import App from "./App";

function ChatApp() {
  return (
    <Router>
      <Routes>
        {/* Redirect root (/) to a new session ID */}
        <Route path="/" element={<App />} />
        {/* Session route */}
        <Route path="/:sessionId" element={<App />} />
      </Routes>
    </Router>
  );
}

export default ChatApp;
