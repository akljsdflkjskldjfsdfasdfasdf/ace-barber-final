import { useState, useEffect } from "react";
import { pb } from "./lib/pocketbase";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Services from "./components/Services";
import About from "./components/About";
import Booking from "./components/Booking";
import Footer from "./components/Footer";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import ImageCarousel from "./components/ImageCarousel";

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Proveri trenutno stanje pri učitavanju
    const user = pb.authStore.model;
    setIsAdmin(pb.authStore.isValid && !!user?.is_admin);
    setLoading(false);

    // Slušaj promene auth stanja (login/logout)
    const unsub = pb.authStore.onChange(() => {
      const u = pb.authStore.model;
      setIsAdmin(pb.authStore.isValid && !!u?.is_admin);
    });

    return () => unsub();
  }, []);

  // Tajni shortcut za admin login (Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "Z") {
        setShowAdminLogin(true);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-xl">Loading...</div>
      </div>
    );
  }

  if (showAdminLogin && !isAdmin) {
    return (
      <AdminLogin
        onLoginSuccess={() => {
          setIsAdmin(true);
          setShowAdminLogin(false);
        }}
      />
    );
  }

  if (isAdmin) {
    return (
      <AdminDashboard
        onLogout={() => {
          setIsAdmin(false);
          setShowAdminLogin(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <ImageCarousel />
      <Services />
      <About />
      <Booking />
      <Footer />
    </div>
  );
}

export default App;