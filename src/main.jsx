import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles/fonts.css";
import "./styles/colors.css";
import "./styles/typography.css";
import "./styles/spacing.css";
import "./styles/site.css";
import "./styles/iubenda.css";
import "./styles/ecom.css";
import "./styles/admin.css";
import "./styles/interno.css";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import { CartProvider } from "./lib/cart.jsx";

ReactDOM.createRoot(document.getElementById("cra-root")).render(
  <ErrorBoundary>
    <AuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </AuthProvider>
  </ErrorBoundary>
);
