const { createProxyMiddleware } = require("http-proxy-middleware");

// Read WDS_SOCKET_PORT env var, fallback to 8000 if not set
const wdsPort = process.env.WDS_SOCKET_PORT || "8000";

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: `http://localhost:${wdsPort}`,
      changeOrigin: true,
      ws: true,
    })
  );

  app.use(
    "/ws",
    createProxyMiddleware({
      target: `http://localhost:${wdsPort}`,
      changeOrigin: true,
      ws: true,
    })
  );

  app.use(
    "/upload",
    createProxyMiddleware({
      target: `http://localhost:${wdsPort}`,
      changeOrigin: true,
      ws: true,
    })
  );

  app.use(
    "/chat",
    createProxyMiddleware({
      target: `http://localhost:${wdsPort}`,
      changeOrigin: true,
      ws: true,
    })
  );
};
