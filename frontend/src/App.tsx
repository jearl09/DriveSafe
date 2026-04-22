import { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google"; 
import HomePage from "./pages/HomePage";
import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BackupHistoryPage from "./pages/BackupHistoryPage";
import RegistryDashboard from "./pages/RegistryDashboard";
import "./App.css";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "314972685252-t6v2r7ok3d41n91jp9vpboo83bg9cgk1.apps.googleusercontent.com";

function App() {
  const [currentPage, setCurrentPage] = useState("home");

  // Handle hash-based navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1); // Remove #
      if (hash === "features") {
        setCurrentPage("features");
      } else if (hash === "about") {
        setCurrentPage("about");
      } else if (hash === "signin") {
        setCurrentPage("signin");
      } else if (hash === "dashboard") {
        setCurrentPage("dashboard");
      } else if (hash === "backup-history") {
        setCurrentPage("backup-history");
      } else if (hash === "registry-dashboard") {
        setCurrentPage("registry-dashboard");
      } else {
        setCurrentPage("home");
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case "features":
        return <FeaturesPage />;
      case "about":
        return <AboutPage />;
      case "signin":
        return <LoginPage />;
      case "dashboard":
        return <DashboardPage />;
      case "backup-history":
        return <BackupHistoryPage />;
      case "registry-dashboard":
        return <RegistryDashboard />;
      default:
        return <HomePage />;
    }
  };

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div style={{ width: "100vw", height: "100vh", overflow: "auto" }}>
        {renderPage()}
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
