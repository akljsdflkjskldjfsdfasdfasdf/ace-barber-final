import { useState } from "react";
import { pb } from "../lib/pocketbase";
import { LogIn } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const authData = await pb
        .collection("users")
        .authWithPassword(email, password);

      // Provera is_admin polja iz PocketBase — nema emailova u kodu
      if (!authData.record.is_admin) {
        pb.authStore.clear();
        setError("Pristup odbijen. Nemate admin ovlašćenja.");
        setLoading(false);
        return;
      }

      onLoginSuccess();
    } catch {
      setError("Pogrešan email ili lozinka.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <LogIn
            className="w-16 h-16 mx-auto mb-4 text-neutral-300"
            strokeWidth={1.5}
          />
          <h1 className="text-4xl font-bold text-white mb-2">ADMIN LOGIN</h1>
          <p className="text-neutral-400">Pristup samo za ovlašćeno osoblje</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-neutral-400 mb-3 text-sm uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 px-6 py-4 text-white focus:outline-none focus:border-neutral-600 transition-colors"
              placeholder="admin@barbershop.com"
              required
            />
          </div>
          <div>
            <label className="block text-neutral-400 mb-3 text-sm uppercase tracking-wide">
              Lozinka
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 px-6 py-4 text-white focus:outline-none focus:border-neutral-600 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 px-6 py-4 text-center text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-white text-black font-bold text-lg hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed transition-all duration-300"
          >
            {loading ? "PRIJAVLJIVANJE..." : "PRIJAVI SE"}
          </button>
        </form>
      </div>
    </div>
  );
}