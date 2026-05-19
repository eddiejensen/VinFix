import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./context/AuthContext";
import { VehicleProvider } from "./context/VehicleContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <VehicleProvider>
        <App />
      </VehicleProvider>
    </AuthProvider>
  </React.StrictMode>
);
