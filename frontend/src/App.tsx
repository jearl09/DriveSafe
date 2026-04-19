import { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google"; 
import HomePage from "./pages/HomePage";
import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import BackupHistoryPage from "./pages/BackupHistoryPage";
import SubmitProjectPage from "./pages/SubmitProjectPage";
import TeacherReviewPage from "./pages/TeacherReviewPage";
import "./App.css";

// Use environment variable or fallback to string (Best Practice)
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
      } else if (hash === "upload") {
        setCurrentPage("upload");
      } else if (hash === "review") {
        setCurrentPage("review");
      } else {
        setCurrentPage("home");
      }
    };

    // Set initial page based on hash
    handleHashChange();

    // Listen for hash changes
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
      case "upload":
        return <SubmitProjectPage />;
      case "review":
        return <TeacherReviewPage />;
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
