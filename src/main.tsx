import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./styles/index.css";
import { ErrorBoundary } from "./app/ErrorBoundary";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found!");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
