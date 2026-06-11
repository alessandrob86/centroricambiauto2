import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles/fonts.css";
import "./styles/colors.css";
import "./styles/typography.css";
import "./styles/spacing.css";
import "./styles/site.css";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("cra-root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
