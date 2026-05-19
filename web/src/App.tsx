import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { HomePage } from "./pages/HomePage";
import { DiagnosePage } from "./pages/DiagnosePage";
import { DiagnosticFlowsPage } from "./pages/DiagnosticFlowsPage";
import { CodeLookupPage } from "./pages/CodeLookupPage";
import { VinLookupPage } from "./pages/VinLookupPage";
import { CommonIssuesPage } from "./pages/CommonIssuesPage";
import { RecallsPage } from "./pages/RecallsPage";
import { TsbsPage } from "./pages/TsbsPage";
import { PartsPage } from "./pages/PartsPage";
import { ShopsPage } from "./pages/ShopsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PartIdentifierPage } from "./pages/PartIdentifierPage";
import { ProfilePage } from "./pages/ProfilePage";
import { GaragePage } from "./pages/GaragePage";
import { TodosPage } from "./pages/TodosPage";
import { CostsPage } from "./pages/CostsPage";
import { LoginPage } from "./pages/LoginPage";

const router = createBrowserRouter([
  { path: "/", element: <AppLayout />, children: [
    { index: true, element: <HomePage /> },
    { path: "diagnose", element: <DiagnosePage /> },
    { path: "diagnose/flows", element: <DiagnosticFlowsPage /> },
    { path: "diagnose/code", element: <CodeLookupPage /> },
    { path: "diagnose/part-identifier", element: <PartIdentifierPage /> },
    { path: "vin", element: <VinLookupPage /> },
    { path: "issues", element: <CommonIssuesPage /> },
    { path: "recalls", element: <RecallsPage /> },
    { path: "tsbs", element: <TsbsPage /> },
    { path: "parts", element: <PartsPage /> },
    { path: "shops", element: <ShopsPage /> },
    { path: "history", element: <HistoryPage /> },
    { path: "garage", element: <GaragePage /> },
    { path: "todos", element: <TodosPage /> },
    { path: "costs", element: <CostsPage /> },
    { path: "profile", element: <ProfilePage /> },
    { path: "login", element: <LoginPage /> },
  ] }
]);

export function App() { return <RouterProvider router={router} />; }
