import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { pb, isNativeApp } from "./lib/pocketbase";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Services from "./components/Services";
import About from "./components/About";
import Footer from "./components/Footer";
import ImageCarousel from "./components/ImageCarousel";
import ScrollProgress from "./components/ScrollProgress";
import MarqueeBanner from "./components/MarqueeBanner";
import CustomCursor from "./components/CustomCursor";
import Preloader from "./components/Preloader";

// Lazy-učitani delovi — ne ulaze u početni bundle (brži prvi load za posetioce)
const AdminLogin = lazy(() => import("./components/AdminLogin"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard"));
const BookingBeta = lazy(() => import("./components/BookingBeta"));

function LazyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

// Isti sajt; /beta verzija ima izbor frizera u rezervaciji.
function PublicSite() {
  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />
      <CustomCursor />
      <Navbar />
      <Hero />
      <ImageCarousel />
      <Services />
      <MarqueeBanner />
      <About />
      <Suspense fallback={null}>
        <BookingBeta />
      </Suspense>
      <Footer />
    </div>
  );
}

// U aplikaciji nema adresne linije (pa ni tajne rute /petarnikola) ni
// tastature (pa ni Ctrl+Shift+Z). Zato se admin prijava tamo otvara sa
// 5 brzih dodira u donjem levom uglu — nevidljivo polje 44×44, taman
// koliko treba prstu, a gost na njega neće naleteti slučajno.
function AdminTapZone({ onUnlock }: { onUnlock: () => void }) {
  const taps = useRef<number[]>([]);
  const handleTap = () => {
    const now = Date.now();
    // Broje se samo dodiri u poslednje 3 sekunde — inače bi se slučajni
    // dodiri tokom celog dana sabrali i sami otvorili prijavu.
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      onUnlock();
    }
  };
  return (
    <div
      onClick={handleTap}
      aria-hidden="true"
      className="fixed bottom-0 left-0 z-[200] h-11 w-11"
    />
  );
}

// Putanja sajta bez završnih kosih crta (npr. "/petarnikola")
const cleanPath = window.location.pathname.replace(/\/+$/, "");

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  // Admin login se otvara i preko tajne rute /petarnikola (radi i na telefonu),
  // pored postojeće Ctrl+Shift+Z prečice.
  const [showAdminLogin, setShowAdminLogin] = useState(
    cleanPath.endsWith("/petarnikola")
  );
  const [loading, setLoading] = useState(true);
  // Preloader — sajt se prikazuje tek kad je sve učitano
  const [booted, setBooted] = useState(false);

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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (showAdminLogin && !isAdmin) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <AdminLogin
          onLoginSuccess={() => {
            setIsAdmin(true);
            setShowAdminLogin(false);
            // Skloni tajnu putanju iz adrese nakon prijave
            window.history.replaceState(null, "", "/");
          }}
        />
      </Suspense>
    );
  }

  if (isAdmin) {
    return (
      <Suspense fallback={<LazyFallback />}>
        <AdminDashboard
          onLogout={() => {
            setIsAdmin(false);
            setShowAdminLogin(false);
            window.history.replaceState(null, "", "/");
          }}
        />
      </Suspense>
    );
  }

  // Preloader stoji preko sajta; sajt se montira tek kad je sve spremno,
  // pa se ulazne animacije vide tačno u trenutku otkrivanja.
  return (
    <>
      {booted && <PublicSite />}
      {isNativeApp && <AdminTapZone onUnlock={() => setShowAdminLogin(true)} />}
      <AnimatePresence>
        {!booted && <Preloader onFinish={() => setBooted(true)} />}
      </AnimatePresence>
    </>
  );
}

export default App;
