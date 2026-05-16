import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { VehicleProvider } from "./context/VehicleContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <VehicleProvider>
      <App />
    </VehicleProvider>
  </React.StrictMode>
);
