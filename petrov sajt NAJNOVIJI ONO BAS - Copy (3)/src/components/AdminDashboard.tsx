import { useEffect, useState } from "react";
import { pb, Appointment } from "../lib/pocketbase";
import { LogOut, Calendar, Trash2, CheckCircle } from "lucide-react";

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "booked" | "completed">("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      setCheckingAdmin(true);
      setError("");

      const user = pb.authStore.model;
      if (!user) {
        setError("Nema aktivne sesije. Molimo prijavite se.");
        setCheckingAdmin(false);
        setLoading(false);
        return;
      }

      // Provera is_admin polja iz PocketBase (NE hardkodirani emailovi)
      if (!user.is_admin) {
        setError("Pristup odbijen. Nemate admin ovlašćenja.");
        setIsAdmin(false);
        setCheckingAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setCheckingAdmin(false);
      await fetchAppointments();

      try {
        unsubscribe = await pb.collection("appointments").subscribe("*", () => {
          fetchAppointments();
        });
      } catch (err) {
        console.error("Realtime subscription failed:", err);
      }
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const records = await pb.collection("appointments").getFullList({
        sort: "+appointment_date,+appointment_time",
      });
      setAppointments(records as unknown as Appointment[]);
    } catch {
      setError("Greška pri učitavanju termina.");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm("Da li ste sigurni da želite da obrišete ovaj termin?")) return;
    try {
      await pb.collection("appointments").delete(id);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(`Greška pri brisanju: ${err.message}`);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!isAdmin) return;
    try {
      await pb.collection("appointments").update(id, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch (err: any) {
      alert(`Greška pri ažuriranju: ${err.message}`);
    }
  };

  const handleLogout = () => {
    pb.authStore.clear();
    onLogout();
  };

  const filteredAppointments = appointments.filter((apt) => {
    if (filter === "all") return true;
    return apt.status === filter;
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Provera admin pristupa...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Pristup odbijen</h2>
          <p className="text-neutral-400 mb-6">{error || "Niste admin."}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-white text-black font-bold hover:bg-neutral-200 transition"
          >
            Nazad / Odjavi se
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ADMIN DASHBOARD</h1>
            <p className="text-neutral-400 mt-1">
              {pb.authStore.model?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 transition-colors border border-neutral-700"
          >
            <LogOut className="w-4 h-4" />
            ODJAVI SE
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex gap-4 mb-8">
          {(["all", "booked", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-3 font-semibold transition-colors ${
                filter === f
                  ? "bg-white text-black"
                  : "bg-neutral-900 text-white border border-neutral-800"
              }`}
            >
              {f === "all" && `SVI (${appointments.length})`}
              {f === "booked" &&
                `ZAKAZANI (${appointments.filter((a) => a.status === "booked").length})`}
              {f === "completed" &&
                `ZAVRŠENI (${appointments.filter((a) => a.status === "completed").length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-neutral-400">
            Učitavanje termina...
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-neutral-600" />
            <p className="text-neutral-400 text-lg">Nema termina</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-neutral-950 border border-neutral-800 p-6 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold">
                        {appointment.first_name} {appointment.last_name}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs font-semibold ${
                          appointment.status === "booked"
                            ? "bg-green-900 text-green-100"
                            : "bg-neutral-800 text-neutral-300"
                        }`}
                      >
                        {appointment.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-4 gap-4 text-neutral-400">
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1">Telefon</p>
                        <p className="text-white">{appointment.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1">Email</p>
                        <p className="text-white text-sm">
                          {appointment.user_email || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1">Datum</p>
                        <p className="text-white">
                          {new Date(
                            appointment.appointment_date + "T00:00:00"
                          ).toLocaleDateString("sr-RS", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1">Vreme</p>
                        <p className="text-white">{appointment.appointment_time}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {appointment.status === "booked" && (
                      <button
                        onClick={() => handleStatusChange(appointment.id, "completed")}
                        className="p-3 bg-green-900 hover:bg-green-800 transition-colors"
                        title="Označi kao završeno"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(appointment.id)}
                      className="p-3 bg-red-900 hover:bg-red-800 transition-colors"
                      title="Obriši termin"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
