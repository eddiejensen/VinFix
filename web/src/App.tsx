import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { HomePage } from "./pages/HomePage";
import { DiagnosePage } from "./pages/DiagnosePage";
import { DiagnosticFlowsPage } from "./pages/DiagnosticFlowsPage";
import { CodeLookupPage } from "./pages/CodeLookupPage";
import { VinLookupPage } from "./pages/VinLookupPage";
import { CommonIssuesPage } from "./pages/CommonIssuesPage";
import { RecallsPage } from "./pages/RecallsPage";
import { PartsPage } from "./pages/PartsPage";
import { ShopsPage } from "./pages/ShopsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PartIdentifierPage } from "./pages/PartIdentifierPage";
import { ProfilePage } from "./pages/ProfilePage";

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
    { path: "parts", element: <PartsPage /> },
    { path: "shops", element: <ShopsPage /> },
    { path: "history", element: <HistoryPage /> },
    { path: "profile", element: <ProfilePage /> },
  ] }
]);

export function App() { return <RouterProvider router={router} />; }
