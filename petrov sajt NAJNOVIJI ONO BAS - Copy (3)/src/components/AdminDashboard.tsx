import { useEffect, useState } from "react";
import { pb, Appointment } from "../lib/pocketbase";
import {
  LogOut,
  Calendar,
  Trash2,
  CheckCircle,
  Ban,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
} from "lucide-react";

interface AdminDashboardProps {
  onLogout: () => void;
}

const allTimeSlots = [
  "11:00","11:45","12:30","13:15","14:00",
  "14:45","15:30","16:15","17:00","17:45","18:30","19:15",
];

function formatDateDisplay(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("sr-RS", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("sr-RS", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ═══════════════════════════════════════════════════════════════
// BLOCKING TAB
// ═══════════════════════════════════════════════════════════════
function BlockingTab() {
  const [blockDate, setBlockDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [bookedOnDate, setBookedOnDate] = useState<Set<string>>(new Set());
  const [blockingLoading, setBlockingLoading] = useState(false);
  const [vacFrom, setVacFrom] = useState("");
  const [vacTo, setVacTo] = useState("");
  const [vacLoading, setVacLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!blockDate) return;
    const fetchTaken = async () => {
      try {
        const records = await pb.collection("appointments").getFullList({
          filter: `appointment_date = "${blockDate}" && (status = "booked" || status = "blocked")`,
          fields: "appointment_time",
        });
        setBookedOnDate(new Set(records.map((r: any) => r.appointment_time)));
        setSelectedSlots(new Set());
      } catch {
        setBookedOnDate(new Set());
      }
    };
    fetchTaken();
  }, [blockDate]);

  const toggleSlot = (time: string) => {
    if (bookedOnDate.has(time)) return;
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      next.has(time) ? next.delete(time) : next.add(time);
      return next;
    });
  };

  const selectQuick = (type: "all" | "morning" | "afternoon" | "none") => {
    if (type === "none") { setSelectedSlots(new Set()); return; }
    const filtered = allTimeSlots.filter((t) => {
      if (bookedOnDate.has(t)) return false;
      const h = parseInt(t.split(":")[0]);
      if (type === "morning") return h < 14;
      if (type === "afternoon") return h >= 14;
      return true;
    });
    setSelectedSlots(new Set(filtered));
  };

  const handleBlockSlots = async () => {
    if (!blockDate || selectedSlots.size === 0) return;
    setBlockingLoading(true);
    setMsg({ type: "", text: "" });
    try {
      for (const time of [...selectedSlots]) {
        await pb.collection("appointments").create({
          first_name: "BLOKIRANO",
          last_name: "",
          phone_number: "—",
          appointment_date: blockDate,
          appointment_time: time,
          status: "blocked",
          user_email: pb.authStore.model?.email || "",
        });
        await new Promise((r) => setTimeout(r, 60));
      }
      setMsg({ type: "success", text: `Blokirano ${selectedSlots.size} termina.` });
      setSelectedSlots(new Set());
      const records = await pb.collection("appointments").getFullList({
        filter: `appointment_date = "${blockDate}" && (status = "booked" || status = "blocked")`,
        fields: "appointment_time",
      });
      setBookedOnDate(new Set(records.map((r: any) => r.appointment_time)));
    } catch {
      setMsg({ type: "error", text: "Greška pri blokiranju." });
    }
    setBlockingLoading(false);
  };

  const handleBlockVacation = async () => {
    if (!vacFrom || !vacTo || vacFrom > vacTo) {
      setMsg({ type: "error", text: "Unesi ispravan opseg datuma." });
      return;
    }
    setVacLoading(true);
    setMsg({ type: "", text: "" });
    const dates = getDatesInRange(vacFrom, vacTo);
    let created = 0;
    let skipped = 0;
    try {
      for (const date of dates) {
        const records = await pb.collection("appointments").getFullList({
          filter: `appointment_date = "${date}" && (status = "booked" || status = "blocked")`,
          fields: "appointment_time",
        });
        const takenTimes = new Set(records.map((r: any) => r.appointment_time));
        const freeSlots = allTimeSlots.filter((t) => !takenTimes.has(t));
        for (const time of freeSlots) {
          await pb.collection("appointments").create({
            first_name: "BLOKIRANO",
            last_name: "ODMOR",
            phone_number: "—",
            appointment_date: date,
            appointment_time: time,
            status: "blocked",
            user_email: pb.authStore.model?.email || "",
          });
          await new Promise((r) => setTimeout(r, 60));
        }
        created += freeSlots.length;
        skipped += takenTimes.size;
      }
      setMsg({
        type: "success",
        text: `Blokirano ${dates.length} dana, ${created} termina. Preskočeno ${skipped} (već zauzeti).`,
      });
      setVacFrom("");
      setVacTo("");
    } catch {
      setMsg({ type: "error", text: "Greška pri blokiranju odmora." });
    }
    setVacLoading(false);
  };

  return (
    <div className="space-y-6">
      {msg.text && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            msg.type === "success"
              ? "bg-green-900/30 border-green-700 text-green-300"
              : "bg-red-900/30 border-red-700 text-red-300"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* ODMOR */}
        <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl">
          <h3 className="font-black uppercase tracking-widest text-sm mb-1">
            Slobodan dan / Odmor
          </h3>
          <p className="text-neutral-500 text-xs mb-6">
            Blokiraj sve slobodne termine za izabrani opseg datuma jednim klikom.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">Od</label>
              <input
                type="date"
                value={vacFrom}
                onChange={(e) => setVacFrom(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">Do</label>
              <input
                type="date"
                value={vacTo}
                onChange={(e) => setVacTo(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm"
              />
            </div>
          </div>
          {vacFrom && vacTo && vacFrom <= vacTo && (
            <p className="text-xs text-neutral-500 mb-4">
              {getDatesInRange(vacFrom, vacTo).length} dana ·{" "}
              {getDatesInRange(vacFrom, vacTo).length * allTimeSlots.length} termina maks.
            </p>
          )}
          <button
            onClick={handleBlockVacation}
            disabled={vacLoading || !vacFrom || !vacTo || vacFrom > vacTo}
            className="w-full py-4 bg-red-900 hover:bg-red-800 text-white font-black rounded-xl uppercase text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Ban className="w-4 h-4" />
            {vacLoading ? "Blokiranje..." : "Blokiraj odmor"}
          </button>
        </div>

        {/* PO TERMINU */}
        <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl">
          <h3 className="font-black uppercase tracking-widest text-sm mb-1">
            Blokiranje po terminu
          </h3>
          <p className="text-neutral-500 text-xs mb-4">
            Izaberi datum i klikni na termine koje želiš da blokiraš.
          </p>
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm mb-4"
          />
          {blockDate && (
            <>
              <div className="flex gap-2 flex-wrap mb-4">
                {[
                  { label: "Ceo dan", action: () => selectQuick("all") },
                  { label: "Jutro (< 14h)", action: () => selectQuick("morning") },
                  { label: "Popodne (≥ 14h)", action: () => selectQuick("afternoon") },
                  { label: "Obriši izbor", action: () => selectQuick("none") },
                ].map(({ label, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="px-3 py-1.5 text-xs font-bold uppercase bg-neutral-900 border border-neutral-700 hover:border-white rounded-lg transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {allTimeSlots.map((time) => {
                  const isTaken = bookedOnDate.has(time);
                  const isSelected = selectedSlots.has(time);
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={isTaken}
                      onClick={() => toggleSlot(time)}
                      className={`py-3 text-sm font-bold rounded-xl border-2 transition-all ${
                        isTaken
                          ? "bg-neutral-900 border-neutral-800 text-neutral-700 cursor-not-allowed"
                          : isSelected
                          ? "bg-red-900 border-red-500 text-red-200"
                          : "bg-neutral-900 border-neutral-700 text-white hover:border-white"
                      }`}
                    >
                      {isTaken ? "×" : time}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleBlockSlots}
                disabled={blockingLoading || selectedSlots.size === 0}
                className="w-full py-4 bg-red-900 hover:bg-red-800 text-white font-black rounded-xl uppercase text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Ban className="w-4 h-4" />
                {blockingLoading ? "Blokiranje..." : `Blokiraj ${selectedSlots.size} termina`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DAY VIEW TAB
// ═══════════════════════════════════════════════════════════════
function DayViewTab({
  appointments,
  onDelete,
  onStatusChange,
  onRefresh,
}: {
  appointments: Appointment[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onRefresh: () => void;
}) {
  const today = getTodayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingDay, setDeletingDay] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const grouped: Record<string, Appointment[]> = {};
  appointments.forEach((a) => {
    if (!grouped[a.appointment_date]) grouped[a.appointment_date] = [];
    grouped[a.appointment_date].push(a);
  });
  const sortedDates = Object.keys(grouped).sort();

  const dayAppointments = (grouped[selectedDate] || []).sort((a, b) =>
    a.appointment_time.localeCompare(b.appointment_time)
  );

  const currentIdx = sortedDates.indexOf(selectedDate);
  const prevDate = sortedDates[currentIdx - 1] || null;
  const nextDate = sortedDates[currentIdx + 1] || null;

  const goToDate = (dir: "prev" | "next") => {
    if (dir === "prev" && prevDate) setSelectedDate(prevDate);
    if (dir === "next" && nextDate) setSelectedDate(nextDate);
  };

  const handleDeleteDay = async () => {
    const ids = dayAppointments.map((a) => a.id);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Obrisati sve termine za ${formatDateDisplay(selectedDate)}?\n\n${ids.length} termin(a) će biti obrisano.`
      )
    )
      return;
    setDeletingDay(true);
    try {
      await Promise.all(ids.map((id) => pb.collection("appointments").delete(id)));
      ids.forEach((id) => onDelete(id));
      if (nextDate) setSelectedDate(nextDate);
      else if (prevDate) setSelectedDate(prevDate);
      else setSelectedDate(today);
    } catch (err: any) {
      alert(`Greška: ${err.message}`);
    }
    setDeletingDay(false);
  };

  const handleDeleteSingle = async (id: string) => {
    setDeletingId(id);
    try {
      await pb.collection("appointments").delete(id);
      onDelete(id);
    } catch (err: any) {
      alert(`Greška: ${err.message}`);
    }
    setDeletingId(null);
  };

  const isToday = selectedDate === today;
  const isPast = selectedDate < today;

  const statusColor = (status: string) => {
    if (status === "booked") return "bg-green-900/50 text-green-300 border border-green-800";
    if (status === "completed") return "bg-neutral-800 text-neutral-400";
    if (status === "blocked") return "bg-red-900/50 text-red-400 border border-red-900";
    return "bg-neutral-800 text-neutral-400";
  };

  const bookedCount = dayAppointments.filter((a) => a.status === "booked").length;
  const completedCount = dayAppointments.filter((a) => a.status === "completed").length;
  const blockedCount = dayAppointments.filter((a) => a.status === "blocked").length;

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-6 items-start">
      {/* ── LEVA KOLONA: lista datuma ── */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800">
          <p className="text-xs text-neutral-500 uppercase font-black tracking-widest">
            Dani sa terminima
          </p>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          {sortedDates.length === 0 ? (
            <p className="text-neutral-600 text-sm p-4">Nema termina.</p>
          ) : (
            sortedDates.map((date) => {
              const dayApts = grouped[date];
              const bookedN = dayApts.filter((a) => a.status === "booked").length;
              const blockedN = dayApts.filter((a) => a.status === "blocked").length;
              const isPastDay = date < today;
              const isTodayDay = date === today;
              const isSelected = date === selectedDate;

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`w-full text-left px-4 py-3 border-b border-neutral-900 transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? "bg-white text-black"
                      : isPastDay
                      ? "hover:bg-neutral-900 text-neutral-500"
                      : "hover:bg-neutral-900 text-white"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-black ${isSelected ? "text-black" : ""}`}>
                      {isTodayDay ? "Danas" : formatDateShort(date)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? "text-neutral-600" : "text-neutral-600"}`}>
                      {bookedN > 0 && `${bookedN} zak.`}
                      {bookedN > 0 && blockedN > 0 && " · "}
                      {blockedN > 0 && `${blockedN} blok.`}
                      {bookedN === 0 && blockedN === 0 && `${dayApts.length} završenih`}
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    isSelected ? "bg-black" :
                    bookedN > 0 ? "bg-green-500" :
                    blockedN > 0 ? "bg-red-700" :
                    "bg-neutral-700"
                  }`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── DESNA KOLONA: termini za dan ── */}
      <div>
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => goToDate("prev")}
                  disabled={!prevDate}
                  className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h3 className="font-black text-lg capitalize">
                  {isToday ? "Danas" : formatDateDisplay(selectedDate)}
                </h3>
                <button
                  onClick={() => goToDate("next")}
                  disabled={!nextDate}
                  className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4 mt-2 flex-wrap">
                {bookedCount > 0 && (
                  <span className="text-xs text-green-400 font-bold">
                    ● {bookedCount} zakazanih
                  </span>
                )}
                {completedCount > 0 && (
                  <span className="text-xs text-neutral-500 font-bold">
                    ● {completedCount} završenih
                  </span>
                )}
                {blockedCount > 0 && (
                  <span className="text-xs text-red-500 font-bold">
                    ● {blockedCount} blokiranih
                  </span>
                )}
                {dayAppointments.length === 0 && (
                  <span className="text-xs text-neutral-600">Nema termina za ovaj dan</span>
                )}
              </div>
            </div>

            {dayAppointments.length > 0 && (
              <button
                onClick={handleDeleteDay}
                disabled={deletingDay}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black uppercase text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed border ${
                  isPast
                    ? "bg-red-900 hover:bg-red-800 border-red-700 text-white"
                    : "bg-neutral-900 hover:bg-red-900 border-neutral-700 hover:border-red-700 text-white"
                }`}
              >
                <Trash2 className="w-4 h-4" />
                {deletingDay ? "Brisanje..." : `Obriši sve (${dayAppointments.length})`}
              </button>
            )}
          </div>
        </div>

        {dayAppointments.length === 0 ? (
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-neutral-700" />
            <p className="text-neutral-500">Nema termina za ovaj dan</p>
            {sortedDates.length === 0 && (
              <p className="text-neutral-700 text-sm mt-2">Izaberi drugi dan sa leve strane</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {dayAppointments.map((apt) => {
              const isExpanded = expandedId === apt.id;
              const isBlocked = apt.status === "blocked";
              const isDeleting = deletingId === apt.id;

              return (
                <div
                  key={apt.id}
                  className={`bg-neutral-950 border rounded-2xl overflow-hidden transition-all ${
                    isBlocked
                      ? "border-red-900/50 opacity-60"
                      : "border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-14 shrink-0 text-center">
                      <span className="text-xl font-black tabular-nums leading-none block">
                        {apt.appointment_time.split(":")[0]}
                      </span>
                      <span className="text-xs text-neutral-500">
                        :{apt.appointment_time.split(":")[1]}
                      </span>
                    </div>

                    <div className="w-px self-stretch bg-neutral-800 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-base truncate">
                          {isBlocked ? "— Blokirano —" : `${apt.first_name} ${apt.last_name}`}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                      {!isBlocked && (
                        <p className="text-sm text-neutral-500 mt-0.5 truncate">
                          {apt.phone_number}
                          {apt.user_email && ` · ${apt.user_email}`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isBlocked && apt.status === "booked" && (
                        <button
                          onClick={() => onStatusChange(apt.id, "completed")}
                          title="Završi"
                          className="p-2 rounded-xl bg-green-900/30 hover:bg-green-900 border border-green-900/50 hover:border-green-700 transition-all"
                        >
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </button>
                      )}
                      {!isBlocked && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                          className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-white transition-all"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteSingle(apt.id)}
                        disabled={isDeleting}
                        title="Obriši"
                        className="p-2 rounded-xl bg-red-900/30 hover:bg-red-900 border border-red-900/50 hover:border-red-700 transition-all disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && !isBlocked && (
                    <div className="border-t border-neutral-800 bg-neutral-900/50 px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Ime</p>
                        <p className="text-sm text-white">{apt.first_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Prezime</p>
                        <p className="text-sm text-white">{apt.last_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Telefon</p>
                        <p className="text-sm text-white">{apt.phone_number}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Email</p>
                        <p className="text-sm text-white truncate">{apt.user_email || "—"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"days" | "list" | "blocking">("days");
  const [listFilter, setListFilter] = useState<"all" | "booked" | "completed" | "blocked">("all");
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
    return () => { if (unsubscribe) unsubscribe(); };
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

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleStatusChange = async (id: string, status: string) => {
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

  const bookedCount = appointments.filter((a) => a.status === "booked").length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const blockedCount = appointments.filter((a) => a.status === "blocked").length;
  const todayCount = appointments.filter(
    (a) => a.appointment_date === getTodayISO() && a.status === "booked"
  ).length;

  const filteredAppointments = appointments.filter((apt) => {
    if (listFilter === "all") return true;
    return apt.status === listFilter;
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="flex items-center gap-3 text-neutral-400">
          <div className="w-5 h-5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
          Provera pristupa...
        </div>
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
            className="px-6 py-3 bg-white text-black font-bold hover:bg-neutral-200 transition rounded-xl"
          >
            Nazad / Odjavi se
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── HEADER ── */}
      <header className="border-b border-neutral-800 bg-neutral-950 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Admin Dashboard</h1>
            <p className="text-neutral-600 text-xs mt-0.5">{pb.authStore.model?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* ── REFRESH DUGME ── */}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              title="Osveži podatke"
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 transition-colors border border-neutral-800 hover:border-neutral-600 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 transition-colors border border-neutral-800 hover:border-neutral-600 rounded-xl text-sm font-bold"
            >
              <LogOut className="w-4 h-4" />
              Odjavi se
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* ── STAT KARTICE ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Danas", value: todayCount, color: "text-white" },
            { label: "Zakazani ukupno", value: bookedCount, color: "text-green-400" },
            { label: "Završeni", value: completedCount, color: "text-neutral-400" },
            { label: "Blokirani", value: blockedCount, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5"
            >
              <p className="text-xs text-neutral-600 uppercase font-black tracking-widest mb-2">
                {label}
              </p>
              <p className={`text-3xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── TABOVI ── */}
        <div className="flex gap-3 mb-8 flex-wrap">
          <button
            onClick={() => setActiveTab("days")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-sm transition-all ${
              activeTab === "days"
                ? "bg-white text-black"
                : "bg-neutral-900 text-white border border-neutral-800 hover:border-neutral-600"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Po danima
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-sm transition-all ${
              activeTab === "list"
                ? "bg-white text-black"
                : "bg-neutral-900 text-white border border-neutral-800 hover:border-neutral-600"
            }`}
          >
            Lista svih
          </button>
          <button
            onClick={() => setActiveTab("blocking")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase text-sm transition-all ${
              activeTab === "blocking"
                ? "bg-red-900 text-white border border-red-700"
                : "bg-neutral-900 text-white border border-neutral-800 hover:border-red-800"
            }`}
          >
            <Ban className="w-4 h-4" />
            Blokiranje
          </button>
        </div>

        {/* ── SADRŽAJ ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-neutral-500 gap-3">
            <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
            Učitavanje...
          </div>
        ) : activeTab === "days" ? (
          <DayViewTab
            appointments={appointments}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onRefresh={fetchAppointments}
          />
        ) : activeTab === "blocking" ? (
          <BlockingTab />
        ) : (
          <>
            <div className="flex gap-3 mb-6 flex-wrap">
              {(["all", "booked", "completed", "blocked"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setListFilter(f)}
                  className={`px-5 py-2 rounded-xl font-black uppercase text-sm transition-all ${
                    listFilter === f
                      ? "bg-white text-black"
                      : "bg-neutral-900 text-white border border-neutral-800"
                  }`}
                >
                  {f === "all" && `Svi (${appointments.length})`}
                  {f === "booked" && `Zakazani (${bookedCount})`}
                  {f === "completed" && `Završeni (${completedCount})`}
                  {f === "blocked" && `Blokirani (${blockedCount})`}
                </button>
              ))}
            </div>

            {filteredAppointments.length === 0 ? (
              <div className="text-center py-20">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-neutral-700" />
                <p className="text-neutral-500 text-lg">Nema termina</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="bg-neutral-950 border border-neutral-800 p-5 rounded-2xl hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <h3 className="text-lg font-black">
                            {appointment.first_name} {appointment.last_name}
                          </h3>
                          <span
                            className={`px-3 py-1 text-[10px] font-black rounded-full uppercase ${
                              appointment.status === "booked"
                                ? "bg-green-900/50 text-green-300 border border-green-800"
                                : appointment.status === "blocked"
                                ? "bg-red-900/50 text-red-400 border border-red-900"
                                : "bg-neutral-800 text-neutral-400"
                            }`}
                          >
                            {appointment.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Telefon</p>
                            <p className="text-white">{appointment.phone_number}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Email</p>
                            <p className="text-white truncate">{appointment.user_email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Datum</p>
                            <p className="text-white">
                              {new Date(appointment.appointment_date + "T00:00:00").toLocaleDateString("sr-RS", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Vreme</p>
                            <p className="text-white">{appointment.appointment_time}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {appointment.status === "booked" && (
                          <button
                            onClick={() => handleStatusChange(appointment.id, "completed")}
                            className="p-2.5 bg-green-900/30 hover:bg-green-900 border border-green-900/50 hover:border-green-700 rounded-xl transition-all"
                            title="Završi"
                          >
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("Obrisati ovaj termin?")) return;
                            await pb.collection("appointments").delete(appointment.id);
                            handleDelete(appointment.id);
                          }}
                          className="p-2.5 bg-red-900/30 hover:bg-red-900 border border-red-900/50 hover:border-red-700 rounded-xl transition-all"
                          title="Obriši"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
