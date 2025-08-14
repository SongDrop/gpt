// App.tsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
//
import App from "./App";
import Developer from "./Developer";
import TextureDeveloper from "./TextureDeveloper";

function ChatApp() {
  return (
    <Router>
      <Routes>
        {/* Redirect root (/) to a new session ID */}
        <Route path="/" element={<App />} />
        {/* Session route */}
        <Route path="/:sessionId" element={<App />} />
        {/* Developer tools */}
        <Route path="/developer" element={<Developer />} />
        <Route path="/textures" element={<TextureDeveloper />} />
      </Routes>
    </Router>
  );
}
//  <Routes>
//    {/* Redirect root (/) to a new session ID */}
//    <Route path="/" element={<App />} />
//    {/* Session route */}
//    <Route path="/:sessionId" element={<App />} />
//  </Routes>;
export default ChatApp;
