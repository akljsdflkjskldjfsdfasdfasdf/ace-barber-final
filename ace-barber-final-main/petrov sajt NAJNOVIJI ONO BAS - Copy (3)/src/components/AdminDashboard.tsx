import { useEffect, useState, useCallback, useRef } from "react";
import { pb, Appointment, isNativeApp } from "../lib/pocketbase";
import { onAppResume } from "../lib/native";
import { BARBERS, barberName } from "../lib/barbers";
import {
  BlockedClient,
  normPhone,
  normEmail,
  cleanName,
  deviceCount,
} from "../lib/blocked";
import {
  LogOut,
  Calendar,
  Trash2,
  CheckCircle,
  Ban,
  UserPlus,
  UserX,
  Smartphone,
  List,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  BarChart3,
  Repeat,
  TrendingUp,
  Banknote,
  CalendarDays,
} from "lucide-react";

interface AdminDashboardProps {
  onLogout: () => void;
}

// Jedan fiksni termin, sabran iz svih nedeljnih zapisa iste serije.
interface FixedSeries {
  id: string; // recurring_id
  name: string;
  phone: string;
  time: string;
  weekday: number;
  nextDate: string;
  lastDate: string;
  count: number;
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

// Redosled kao u kalendaru — ponedeljak prvi, nedelja poslednja.
// value = ono što vraća Date.getDay() (0 = nedelja).
const WEEKDAYS = [
  { value: 1, short: "Pon", long: "ponedeljak" },
  { value: 2, short: "Uto", long: "utorak" },
  { value: 3, short: "Sre", long: "sreda" },
  { value: 4, short: "Čet", long: "četvrtak" },
  { value: 5, short: "Pet", long: "petak" },
  { value: 6, short: "Sub", long: "subota" },
  { value: 0, short: "Ned", long: "nedelja" },
];

// U nativnoj aplikaciji nema realtime-a (vidi ispod), pa se server
// anketira na ovoliko milisekundi.
const NATIVE_POLL_MS = 30000;

// ── CENE (iz Services.tsx) ──
// Pranje kose je besplatno uz šišanje, pa ne ulazi u račun.
const PRICE_CUT = 1500;
const PRICE_BEARD = 700;

// Cena jednog termina. Booking dopisuje usluge na prezime
// ("Petrović + Beard + Wash"), pa se brada čita odatle — zato zarada
// nije prosto broj termina × 1500.
function appointmentPrice(apt: { last_name?: string }): number {
  const note = String(apt.last_name || "").toLowerCase();
  return PRICE_CUT + (note.includes("+ beard") ? PRICE_BEARD : 0);
}

// Koliko termina dan ima u rasporedu. Nedeljom se radi do 16h
// (isto pravilo kao u BookingBeta), pa je kapacitet manji.
function slotsForDate(iso: string): number {
  const isSunday = new Date(iso + "T00:00:00").getDay() === 0;
  return isSunday
    ? allTimeSlots.filter((s) => parseInt(s.split(":")[0], 10) < 16).length
    : allTimeSlots.length;
}

// Koliko nedelja unazad se gleda da bi se izračunao prosek mušterija po danu.
const HISTORY_WEEKS = 12;

// ── TABOVI ──
// Na jednom mestu, da se navigacija ne piše pet puta. `short` je oznaka za
// telefon, gde za pune nazive nema mesta. `danger` su tabovi koji nekoga
// blokiraju — stoje poslednji i crveni su, da se ne kliknu slučajno.
type TabId = "days" | "list" | "stats" | "blocking" | "blacklist";

const TABS: {
  id: TabId;
  label: string;
  short: string;
  icon: typeof Calendar;
  danger?: boolean;
}[] = [
  { id: "days", label: "Po danima", short: "Dani", icon: Calendar },
  { id: "list", label: "Lista svih", short: "Lista", icon: List },
  { id: "stats", label: "Statistika", short: "Zarada", icon: BarChart3 },
  { id: "blocking", label: "Blokiranje", short: "Termini", icon: Ban, danger: true },
  { id: "blacklist", label: "Crna lista", short: "Crna", icon: UserX, danger: true },
];

const fmtMoney = (n: number) => `${Math.round(n).toLocaleString("sr-RS")} RSD`;

// Kraći zapis za uske ekrane: 42.000 RSD → 42k
const fmtMoneyShort = (n: number) =>
  n >= 10000 ? `${Math.round(n / 1000)}k` : String(Math.round(n));

// Pomeranje ISO datuma ("2026-08-04") za n dana, bez vremenske zone.
function shiftISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 0 = ponedeljak ... 6 = nedelja (Date.getDay() vraća 0 za nedelju).
function weekdayIndex(iso: string) {
  return (new Date(iso + "T00:00:00").getDay() + 6) % 7;
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
// Blokiranje i ručna rezervacija važe SAMO za jednog frizera (barberId) —
// svaki frizer ima svoj raspored, pa se i zauzeti termini gledaju po frizeru.
function BlockingTab({ barberId }: { barberId: string }) {
  const barberLabel = barberName(barberId);
  const [blockDate, setBlockDate] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [bookedOnDate, setBookedOnDate] = useState<Set<string>>(new Set());
  const [blockingLoading, setBlockingLoading] = useState(false);
  const [vacFrom, setVacFrom] = useState("");
  const [vacTo, setVacTo] = useState("");
  const [vacLoading, setVacLoading] = useState(false);
  const [vacProgress, setVacProgress] = useState({ current: 0, total: 0 });
  const [msg, setMsg] = useState({ type: "", text: "" });

  // ── Ručna rezervacija (na ime) ──
  const [resDate, setResDate] = useState("");
  const [resName, setResName] = useState("");
  const [resPhone, setResPhone] = useState("");
  const [resSlot, setResSlot] = useState("");
  const [resTaken, setResTaken] = useState<Set<string>>(new Set());
  const [resLoading, setResLoading] = useState(false);

  // ── Fiksni termin (npr. svaki ponedeljak u 11h) ──
  const [fixName, setFixName] = useState("");
  const [fixPhone, setFixPhone] = useState("");
  const [fixEmail, setFixEmail] = useState("");
  const [fixWeekday, setFixWeekday] = useState(1);
  const [fixSlot, setFixSlot] = useState("");
  const [fixWeeks, setFixWeeks] = useState(12);
  const [fixLoading, setFixLoading] = useState(false);
  const [series, setSeries] = useState<FixedSeries[]>([]);
  const [seriesBusy, setSeriesBusy] = useState("");

  useEffect(() => {
    if (!blockDate) return;
    const fetchTaken = async () => {
      try {
        const records = await pb.collection("appointments").getFullList({
          filter: `appointment_date = "${blockDate}" && barber = "${barberId}" && (status = "booked" || status = "blocked")`,
          fields: "appointment_time",
        });
        setBookedOnDate(new Set(records.map((r: any) => r.appointment_time)));
        setSelectedSlots(new Set());
      } catch {
        setBookedOnDate(new Set());
      }
    };
    fetchTaken();
  }, [blockDate, barberId]);

  // ── Učitaj zauzete termine za datum ručne rezervacije ──
  useEffect(() => {
    if (!resDate) {
      setResTaken(new Set());
      setResSlot("");
      return;
    }
    const fetchTaken = async () => {
      try {
        const records = await pb.collection("appointments").getFullList({
          filter: `appointment_date = "${resDate}" && barber = "${barberId}" && (status = "booked" || status = "blocked")`,
          fields: "appointment_time",
        });
        setResTaken(new Set(records.map((r: any) => r.appointment_time)));
        setResSlot("");
      } catch {
        setResTaken(new Set());
      }
    };
    fetchTaken();
  }, [resDate, barberId]);

  const handleManualReserve = async () => {
    if (!resDate || !resSlot || !resName.trim()) {
      setMsg({ type: "error", text: "Izaberi datum, termin i upiši ime." });
      return;
    }
    setResLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const parts = resName.trim().split(/\s+/);
      const firstName = parts.shift() || resName.trim();
      const lastName = parts.join(" ");
      await pb.collection("appointments").create({
        first_name: firstName,
        last_name: lastName,
        phone_number: resPhone.trim() || "—",
        appointment_date: resDate,
        appointment_time: resSlot,
        status: "booked",
        user_email: pb.authStore.model?.email || "",
        barber: barberId,
        barber_name: barberLabel,
      });
      setMsg({
        type: "success",
        text: `Termin rezervisan na ime: ${resName.trim()} (${resSlot}) — ${barberLabel}.`,
      });
      setResName("");
      setResPhone("");
      setResSlot("");
      const records = await pb.collection("appointments").getFullList({
        filter: `appointment_date = "${resDate}" && barber = "${barberId}" && (status = "booked" || status = "blocked")`,
        fields: "appointment_time",
      });
      setResTaken(new Set(records.map((r: any) => r.appointment_time)));
    } catch (err: any) {
      if (err?.status === 400) {
        setMsg({ type: "error", text: "Ovaj termin je već zauzet." });
      } else {
        setMsg({ type: "error", text: "Greška pri rezervaciji." });
      }
    }
    setResLoading(false);
  };

  // ── Fiksni termini: učitavanje postojećih serija ──
  const loadSeries = useCallback(async () => {
    try {
      const records = await pb.collection("appointments").getFullList({
        filter: `barber = "${barberId}" && recurring_id != "" && appointment_date >= "${getTodayISO()}"`,
        sort: "appointment_date",
      });

      const grouped = new Map<string, FixedSeries>();
      for (const r of records as unknown as Appointment[]) {
        const key = r.recurring_id as string;
        const existing = grouped.get(key);
        if (existing) {
          existing.count++;
          if (r.appointment_date > existing.lastDate) {
            existing.lastDate = r.appointment_date;
          }
        } else {
          grouped.set(key, {
            id: key,
            name: `${r.first_name} ${r.last_name}`.trim(),
            phone: r.phone_number,
            time: r.appointment_time,
            // Zapisi su sortirani po datumu, pa je prvi ujedno i sledeći termin.
            weekday: new Date(r.appointment_date + "T12:00:00").getDay(),
            nextDate: r.appointment_date,
            lastDate: r.appointment_date,
            count: 1,
          });
        }
      }
      setSeries([...grouped.values()]);
    } catch {
      setSeries([]);
    }
  }, [barberId]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const handleCreateFixed = async () => {
    if (!fixName.trim() || !fixSlot) {
      setMsg({ type: "error", text: "Upiši ime i izaberi termin." });
      return;
    }
    setFixLoading(true);
    setMsg({ type: "", text: "" });

    const parts = fixName.trim().split(/\s+/);
    const firstName = parts.shift() || fixName.trim();
    const lastName = parts.join(" ");

    try {
      // Ceo posao ide JEDNIM zahtevom — server upiše svih N nedelja odjednom.
      // Ranije je ovo bila petlja sa frontenda, pa je posle ~20 zahteva
      // udaralo u nginx rate limit (30/min) i pucalo na pola.
      const res = await pb.send<{ created: number; skipped: number }>(
        "/api/recurring/create",
        {
          method: "POST",
          body: {
            barber: barberId,
            barberName: barberLabel,
            firstName,
            lastName,
            phone: fixPhone.trim(),
            email: fixEmail.trim(),
            weekday: fixWeekday,
            time: fixSlot,
            weeks: fixWeeks,
          },
        },
      );

      const dayLabel = WEEKDAYS.find((w) => w.value === fixWeekday)?.long ?? "";
      setMsg({
        type: "success",
        text:
          `Fiksni termin napravljen: ${fixName.trim()} — svaki ${dayLabel} u ${fixSlot} (${res.created} nedelja).` +
          (res.skipped > 0
            ? ` Preskočeno ${res.skipped} — ti termini su već bili zauzeti.`
            : ""),
      });
      setFixName("");
      setFixPhone("");
      setFixEmail("");
      setFixSlot("");
      await loadSeries();
    } catch (err) {
      const detail = (err as { response?: { error?: string } })?.response?.error;
      setMsg({
        type: "error",
        text: detail || "Greška pri pravljenju fiksnog termina.",
      });
    }
    setFixLoading(false);
  };

  // Briše samo BUDUĆE termine serije — istorija ostaje netaknuta.
  const handleCancelSeries = async (s: FixedSeries) => {
    if (
      !confirm(
        `Otkazati fiksni termin za ${s.name} (${s.time})?\n\nObrisaće se ${s.count} budućih termina. Već odrađeni ostaju u istoriji.`,
      )
    ) {
      return;
    }
    setSeriesBusy(s.id);
    setMsg({ type: "", text: "" });
    try {
      // Takođe jednim zahtevom — brisanje u petlji je udaralo u rate limit.
      const res = await pb.send<{ deleted: number }>("/api/recurring/cancel", {
        method: "POST",
        body: { recurringId: s.id },
      });
      setMsg({
        type: "success",
        text: `Fiksni termin za ${s.name} je otkazan (${res.deleted} termina oslobođeno).`,
      });
      await loadSeries();
    } catch (err) {
      const detail = (err as { response?: { error?: string } })?.response?.error;
      setMsg({ type: "error", text: detail || "Greška pri otkazivanju serije." });
    }
    setSeriesBusy("");
  };

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
          barber: barberId,
          barber_name: barberLabel,
        });
        // 300ms pauza između zahteva – sprečava blokiranje IP-a
        await new Promise((r) => setTimeout(r, 300));
      }
      setMsg({ type: "success", text: `Blokirano ${selectedSlots.size} termina (${barberLabel}).` });
      setSelectedSlots(new Set());
      const records = await pb.collection("appointments").getFullList({
        filter: `appointment_date = "${blockDate}" && barber = "${barberId}" && (status = "booked" || status = "blocked")`,
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

    // Ukupan broj termina za progress bar
    const totalSlots = dates.length * allTimeSlots.length;
    setVacProgress({ current: 0, total: totalSlots });

    try {
      for (const date of dates) {
        const records = await pb.collection("appointments").getFullList({
          filter: `appointment_date = "${date}" && barber = "${barberId}" && (status = "booked" || status = "blocked")`,
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
            barber: barberId,
            barber_name: barberLabel,
          });
          created++;
          // 300ms između zahteva – KRITIČNO da ne blokira IP
          await new Promise((r) => setTimeout(r, 300));
          setVacProgress((p) => ({ ...p, current: p.current + 1 }));
        }
        skipped += takenTimes.size;

        // Dodatna pauza između dana (500ms)
        await new Promise((r) => setTimeout(r, 500));
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
    setVacProgress({ current: 0, total: 0 });
  };

  const vacProgressPct =
    vacProgress.total > 0
      ? Math.round((vacProgress.current / vacProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Za kog frizera važi blokiranje/rezervacija */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl px-5 py-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-neutral-600 uppercase font-black tracking-widest">
          Radiš raspored za:
        </span>
        <span className="font-black text-white uppercase">{barberLabel}</span>
      </div>

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
                disabled={vacLoading}
                className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">Do</label>
              <input
                type="date"
                value={vacTo}
                onChange={(e) => setVacTo(e.target.value)}
                disabled={vacLoading}
                className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
              />
            </div>
          </div>
          {vacFrom && vacTo && vacFrom <= vacTo && (
            <p className="text-xs text-neutral-500 mb-4">
              {getDatesInRange(vacFrom, vacTo).length} dana ·{" "}
              {getDatesInRange(vacFrom, vacTo).length * allTimeSlots.length} termina maks.
            </p>
          )}

          {/* Progress bar tokom blokiranja odmora */}
          {vacLoading && vacProgress.total > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-neutral-500 mb-1">
                <span>Blokiranje u toku...</span>
                <span>{vacProgress.current} / {vacProgress.total} ({vacProgressPct}%)</span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${vacProgressPct}%` }}
                />
              </div>
              <p className="text-xs text-neutral-600 mt-2">
                ⚠️ Ne zatvaraj stranicu – blokiranje traje duže zbog zaštite od blokade IP-a.
              </p>
            </div>
          )}

          <button
            onClick={handleBlockVacation}
            disabled={vacLoading || !vacFrom || !vacTo || vacFrom > vacTo}
            className="w-full py-4 bg-red-900 hover:bg-red-800 text-white font-black rounded-xl uppercase text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Ban className="w-4 h-4" />
            {vacLoading ? `Blokiranje... ${vacProgressPct}%` : "Blokiraj odmor"}
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

      {/* RUČNA REZERVACIJA NA IME */}
      <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl">
        <h3 className="font-black uppercase tracking-widest text-sm mb-1 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Ručna rezervacija (na ime)
        </h3>
        <p className="text-neutral-500 text-xs mb-6">
          Sam rezerviši termin za mušteriju i upiši ime — pojaviće se kao zakazan
          termin u pregledu, da znaš za koga je.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-neutral-500 uppercase block mb-2">Datum</label>
            <input
              type="date"
              value={resDate}
              onChange={(e) => setResDate(e.target.value)}
              disabled={resLoading}
              className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 uppercase block mb-2">Ime i prezime</label>
            <input
              type="text"
              placeholder="npr. Marko Marković"
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              disabled={resLoading}
              className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-neutral-500 uppercase block mb-2">Telefon (opciono)</label>
          <input
            type="tel"
            placeholder="npr. 060 123 4567"
            value={resPhone}
            onChange={(e) => setResPhone(e.target.value)}
            disabled={resLoading}
            className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
          />
        </div>

        {resDate && (
          <>
            <label className="text-xs text-neutral-500 uppercase block mb-2">
              Slobodni termini
            </label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {allTimeSlots.map((time) => {
                const isTaken = resTaken.has(time);
                const isSelected = resSlot === time;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={isTaken || resLoading}
                    onClick={() => setResSlot(isSelected ? "" : time)}
                    className={`py-3 text-sm font-bold rounded-xl border-2 transition-all ${
                      isTaken
                        ? "bg-neutral-900 border-neutral-800 text-neutral-700 cursor-not-allowed"
                        : isSelected
                        ? "bg-green-900 border-green-500 text-green-200"
                        : "bg-neutral-900 border-neutral-700 text-white hover:border-white"
                    }`}
                  >
                    {isTaken ? "×" : time}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={handleManualReserve}
          disabled={resLoading || !resDate || !resSlot || !resName.trim()}
          className="w-full py-4 bg-green-900 hover:bg-green-800 text-white font-black rounded-xl uppercase text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          {resLoading ? "Rezervacija..." : "Rezerviši termin"}
        </button>
      </div>

      {/* FIKSNI TERMIN — stalna mušterija, isti dan i sat svake nedelje */}
      <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl">
        <h3 className="font-black uppercase tracking-widest text-sm mb-1 flex items-center gap-2">
          <Repeat className="w-4 h-4" />
          Fiksni termin (stalna mušterija)
        </h3>
        <p className="text-neutral-500 text-xs mb-6">
          Zaključaj isti termin svake nedelje — npr. <em>svaki ponedeljak u 11:00</em>.
          Termini se odmah upisuju u raspored i niko drugi ne može da ih zauzme.
          Kreće od prvog sledećeg tog dana i sam se produžava, tako da nikad ne istekne.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-neutral-500 uppercase block mb-2">Ime i prezime</label>
            <input
              type="text"
              placeholder="npr. Marko Marković"
              value={fixName}
              onChange={(e) => setFixName(e.target.value)}
              disabled={fixLoading}
              className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 uppercase block mb-2">Telefon (opciono)</label>
            <input
              type="tel"
              placeholder="npr. 060 123 4567"
              value={fixPhone}
              onChange={(e) => setFixPhone(e.target.value)}
              disabled={fixLoading}
              className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-neutral-500 uppercase block mb-2">
            Email (opciono — samo za podsetnik 4h ranije)
          </label>
          <input
            type="email"
            placeholder="npr. marko@gmail.com"
            value={fixEmail}
            onChange={(e) => setFixEmail(e.target.value)}
            disabled={fixLoading}
            className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
          />
        </div>

        <label className="text-xs text-neutral-500 uppercase block mb-2">Dan u nedelji</label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              disabled={fixLoading}
              onClick={() => setFixWeekday(d.value)}
              className={`py-3 text-sm font-bold rounded-xl border-2 transition-all disabled:opacity-40 ${
                fixWeekday === d.value
                  ? "bg-blue-900 border-blue-500 text-blue-200"
                  : "bg-neutral-900 border-neutral-700 text-white hover:border-white"
              }`}
            >
              {d.short}
            </button>
          ))}
        </div>

        <label className="text-xs text-neutral-500 uppercase block mb-2">Termin</label>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {allTimeSlots.map((time) => (
            <button
              key={time}
              type="button"
              disabled={fixLoading}
              onClick={() => setFixSlot(fixSlot === time ? "" : time)}
              className={`py-3 text-sm font-bold rounded-xl border-2 transition-all disabled:opacity-40 ${
                fixSlot === time
                  ? "bg-blue-900 border-blue-500 text-blue-200"
                  : "bg-neutral-900 border-neutral-700 text-white hover:border-white"
              }`}
            >
              {time}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="text-xs text-neutral-500 uppercase block mb-2">Koliko nedelja unapred</label>
          <select
            value={fixWeeks}
            onChange={(e) => setFixWeeks(Number(e.target.value))}
            disabled={fixLoading}
            className="bg-neutral-900 border border-neutral-800 p-3 w-full outline-none focus:border-white rounded-xl text-white text-sm disabled:opacity-50"
          >
            <option value={4}>4 nedelje (mesec dana)</option>
            <option value={8}>8 nedelja (2 meseca)</option>
            <option value={12}>12 nedelja (3 meseca)</option>
            <option value={26}>26 nedelja (pola godine)</option>
            <option value={52}>52 nedelje (godinu dana)</option>
          </select>
        </div>

        <button
          onClick={handleCreateFixed}
          disabled={fixLoading || !fixName.trim() || !fixSlot}
          className="w-full py-4 bg-blue-900 hover:bg-blue-800 text-white font-black rounded-xl uppercase text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Repeat className="w-4 h-4" />
          {fixLoading
            ? "Pravljenje..."
            : `Napravi fiksni termin${fixSlot ? ` — ${WEEKDAYS.find((w) => w.value === fixWeekday)?.short} ${fixSlot}` : ""}`}
        </button>

        {/* Aktivni fiksni termini */}
        <div className="mt-8 pt-6 border-t border-neutral-800">
          <h4 className="text-xs text-neutral-500 uppercase font-black tracking-widest mb-4">
            Aktivni fiksni termini — {barberLabel}
          </h4>
          {series.length === 0 ? (
            <p className="text-neutral-600 text-sm">Nema fiksnih termina.</p>
          ) : (
            <div className="space-y-2">
              {series.map((s) => (
                <div
                  key={s.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{s.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      svaki {WEEKDAYS.find((w) => w.value === s.weekday)?.long} u{" "}
                      <span className="text-neutral-300 font-bold">{s.time}</span>
                      {s.phone && s.phone !== "—" && ` · ${s.phone}`}
                    </p>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      sledeći: {formatDateShort(s.nextDate)} · još {s.count} termina
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelSeries(s)}
                    disabled={seriesBusy === s.id}
                    className="px-4 py-2 text-xs font-black uppercase bg-red-900/40 border border-red-900 text-red-300 hover:bg-red-900 hover:text-white rounded-lg transition-all disabled:opacity-40 flex items-center gap-2 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {seriesBusy === s.id ? "Otkazivanje..." : "Otkaži"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATS TAB — zarada i prognoza
// ═══════════════════════════════════════════════════════════════
// barberId: "" = ceo studio, inače jedan frizer. Prop stoji u
// zavisnostima efekta, pa se podaci sami preuzmu kad šef promeni frizera —
// bez ručnog osvežavanja i bez prikaza tuđih brojeva u međuvremenu.
//
// KAKO SE RAČUNA ZARADA (i zašto ovako):
// Status termina govori različite stvari, pa se novac deli u četiri korpe
// umesto da se sve sabere u jedan broj:
//
//   naplaćeno    status "completed"              → sigurno obavljeno
//   nepotvrđeno  prošao datum, još "booked"      → frizer nije označio;
//                                                  možda došao, možda ne
//   zakazano     budući datum, "booked"          → stoji u knjizi
//   prognoza     slobodni termini × prosek dana  → procena
//
// Staro ponašanje je sve prošle termine računalo kao zarađene, pa je
// zarada bila naduvana svaki put kad neko ne dođe ili frizer ne klikne
// "završi". Zato su sada "naplaćeno" i "nepotvrđeno" razdvojeni.
//
// Prognoza ne može da pređe broj slobodnih termina tog dana — pre je
// umela da predvidi više mušterija nego što dan fizički ima mesta.
function StatsTab({ barberId }: { barberId: string }) {
  const today = getTodayISO();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const barberLabel = barberId ? barberName(barberId) : "ceo studio";

  // "2026-10" — i filter i oznaka meseca
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${monthKey}-01`;
  const lastDayNum = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthEnd = `${monthKey}-${String(lastDayNum).padStart(2, "0")}`;

  const histFrom = shiftISO(today, -HISTORY_WEEKS * 7);
  const weekTo = shiftISO(today, 6);

  // ── JEDAN zahtev za sve ──
  // Ranije su išla dva (mesec + istorija), svaki sa svojim loading-om, pa je
  // ekran dvaput poskočio i lakše se udaralo u nginx rate limit (30/min).
  // Sada se povuče jedan opseg koji pokriva i istoriju i izabrani mesec.
  const from = histFrom < monthStart ? histFrom : monthStart;
  const to = weekTo > monthEnd ? weekTo : monthEnd;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filter = [
        `appointment_date >= "${from}"`,
        `appointment_date <= "${to}"`,
        `(status = "booked" || status = "completed")`,
        ...(barberId ? [`barber = "${barberId}"`] : []),
      ].join(" && ");

      const res = await pb.collection("appointments").getFullList({
        filter,
        sort: "+appointment_date,+appointment_time",
        fields:
          "appointment_date,appointment_time,barber,status,first_name,last_name",
      });
      // "BLOKIRANO" su blokirani slotovi i odmor — nisu mušterije.
      setRows(
        (res as unknown as Appointment[]).filter(
          (r) => r.first_name !== "BLOKIRANO",
        ),
      );
    } catch (err) {
      const e = err as PbError;
      setRows([]);
      setError(
        e?.status === 429
          ? "Server je privremeno odbio zahtev (previše poziva). Pokušaj za nekoliko sekundi."
          : "Nije moguće učitati statistiku.",
      );
    }
    setLoading(false);
  }, [from, to, barberId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Novac ──
  const money = (list: Appointment[]) =>
    list.reduce((s, r) => s + appointmentPrice(r), 0);

  const monthRows = rows.filter(
    (r) => r.appointment_date >= monthStart && r.appointment_date <= monthEnd,
  );

  const paidRows = monthRows.filter((r) => r.status === "completed");
  const unconfirmedRows = monthRows.filter(
    (r) => r.status === "booked" && r.appointment_date < today,
  );
  const upcomingRows = monthRows.filter(
    (r) => r.status === "booked" && r.appointment_date >= today,
  );

  const paidMoney = money(paidRows);
  const unconfirmedMoney = money(unconfirmedRows);
  const upcomingMoney = money(upcomingRows);

  // Ostvareno = sve što je prošlo, potvrđeno ili ne.
  //
  // Zašto ne samo "completed": u praksi dva od tri frizera nikad ne kliknu
  // "završi", pa bi im naplaćeno stajalo na nuli i panel ne bi vredeo ništa.
  // Zato je glavni broj ostvareno, a potvrđenost je detalj ispod njega —
  // vidi se i koliko tog novca nije potvrđeno, da broj ima pokriće.
  const realizedMoney = paidMoney + unconfirmedMoney;
  const realizedCount = paidRows.length + unconfirmedRows.length;

  // ── Prosek iz istorije ──
  const histRows = rows.filter((r) => r.appointment_date < today);
  // Prosečan račun — nosi i bradu, pa prognoza ne mora da je pogađa posebno.
  const avgTicket = histRows.length ? money(histRows) / histRows.length : PRICE_CUT;

  const histByDate: Record<string, number> = {};
  histRows.forEach((r) => {
    histByDate[r.appointment_date] = (histByDate[r.appointment_date] || 0) + 1;
  });

  // Ako studio nema termina od početka prozora, prosek se računa tek od prvog
  // termina — inače bi prazne nedelje pre otvaranja lažno obarale prosek.
  const histDates = Object.keys(histByDate).sort();
  const windowStart =
    histDates.length && histDates[0] > histFrom ? histDates[0] : histFrom;

  const wdSum = new Array(7).fill(0) as number[];
  const wdDays = new Array(7).fill(0) as number[];
  for (let d = windowStart; d < today; d = shiftISO(d, 1)) {
    const i = weekdayIndex(d);
    wdDays[i]++;
    wdSum[i] += histByDate[d] || 0;
  }
  const wdAvg = wdSum.map((s, i) => (wdDays[i] ? s / wdDays[i] : 0));
  const hasHistory = histRows.length > 0;

  // Kapacitet dana: nedeljom kraće, a za jednog frizera tri puta manji.
  const capacityFor = (iso: string) =>
    slotsForDate(iso) * (barberId ? 1 : BARBERS.length);

  // Koliko se JOŠ mušterija očekuje tog dana, preko već zakazanih.
  // Ograničeno brojem slobodnih termina — dan ne može da primi više.
  const extraFor = (iso: string, booked: number) => {
    const avg = Math.round(wdAvg[weekdayIndex(iso)]);
    const free = Math.max(0, capacityFor(iso) - booked);
    return Math.min(Math.max(0, avg - booked), free);
  };

  const monthCountByDate: Record<string, number> = {};
  monthRows.forEach((r) => {
    monthCountByDate[r.appointment_date] =
      (monthCountByDate[r.appointment_date] || 0) + 1;
  });

  // ── Nedelje meseca (pon–ned, isečeno na mesec) ──
  const weeks: {
    from: string;
    to: string;
    paid: number;
    unconfirmed: number;
    upcoming: number;
    forecast: number;
    isCurrent: boolean;
  }[] = [];

  let cursor = monthStart;
  while (cursor <= monthEnd) {
    let weekEnd = shiftISO(cursor, 6 - weekdayIndex(cursor));
    if (weekEnd > monthEnd) weekEnd = monthEnd;

    const inWeek = (r: Appointment) =>
      r.appointment_date >= cursor && r.appointment_date <= weekEnd;

    let forecast = 0;
    for (let d = cursor; d <= weekEnd; d = shiftISO(d, 1)) {
      if (d < today) continue;
      forecast += extraFor(d, monthCountByDate[d] || 0) * avgTicket;
    }

    weeks.push({
      from: cursor,
      to: weekEnd,
      paid: money(paidRows.filter(inWeek)),
      unconfirmed: money(unconfirmedRows.filter(inWeek)),
      upcoming: money(upcomingRows.filter(inWeek)),
      forecast,
      isCurrent: cursor <= today && today <= weekEnd,
    });
    cursor = shiftISO(weekEnd, 1);
  }

  const forecastMoney = weeks.reduce((s, w) => s + w.forecast, 0);
  const forecastCuts = avgTicket > 0 ? Math.round(forecastMoney / avgTicket) : 0;
  const projected = paidMoney + unconfirmedMoney + upcomingMoney + forecastMoney;
  const maxWeekMoney = Math.max(
    1,
    ...weeks.map((w) => w.paid + w.unconfirmed + w.upcoming + w.forecast),
  );

  // ── Ko koliko zarađuje (samo kad se gleda ceo studio) ──
  const perBarber = BARBERS.map((b) => {
    const list = monthRows.filter((r) => r.barber === b.id);
    return {
      id: b.id,
      name: b.name,
      count: list.length,
      paid: money(list.filter((r) => r.status === "completed")),
      total: money(list),
    };
  }).sort((a, b) => b.total - a.total);
  const maxBarberMoney = Math.max(1, ...perBarber.map((p) => p.total));
  const studioTotal = perBarber.reduce((s, p) => s + p.total, 0);

  // ── Rang dana u nedelji ──
  const dayRanking = WEEKDAYS.map((w, i) => ({
    short: w.short,
    long: w.long,
    avg: wdAvg[i],
    days: wdDays[i],
  })).sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(0.001, ...dayRanking.map((d) => d.avg));

  // ── Narednih 7 dana ──
  const nextWeek = Array.from({ length: 7 }, (_, i) => shiftISO(today, i)).map(
    (iso) => {
      const items = rows.filter((r) => r.appointment_date === iso);
      return {
        iso,
        items,
        booked: items.length,
        capacity: capacityFor(iso),
        extra: extraFor(iso, items.length),
        money: money(items),
      };
    },
  );
  const weekBooked = nextWeek.reduce((s, d) => s + d.booked, 0);
  const weekMoney = nextWeek.reduce((s, d) => s + d.money, 0);
  const weekExtraMoney = nextWeek.reduce((s, d) => s + d.extra * avgTicket, 0);

  const monthLabel = month.toLocaleDateString("sr-RS", {
    month: "long",
    year: "numeric",
  });
  const changeMonth = (dir: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + dir, 1));
  const isThisMonth = monthKey === today.slice(0, 7);

  const Bar = ({
    value,
    max,
    color = "bg-white",
  }: {
    value: number;
    max: number;
    color?: string;
  }) => (
    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
  );

  const Card = ({
    label,
    value,
    sub,
    icon,
    tone = "",
    strong = false,
  }: {
    label: string;
    value: string;
    sub: string;
    icon?: React.ReactNode;
    tone?: string;
    strong?: boolean;
  }) => (
    <div
      className={`rounded-2xl border bg-neutral-950 p-4 sm:p-5 ${
        strong ? "border-white/25" : "border-neutral-800"
      }`}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </p>
      <p className={`text-xl font-black leading-tight sm:text-2xl ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-neutral-500">{sub}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Mesec + za koga ── */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Prethodni mesec"
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 transition-all hover:border-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 text-center">
            <h3 className="truncate text-base font-black capitalize sm:text-lg">
              {monthLabel}
            </h3>
            <p className="truncate text-[11px] text-neutral-500">
              {barberLabel}
              {!isThisMonth && " · prošli/budući mesec"}
            </p>
          </div>

          <button
            onClick={() => changeMonth(1)}
            aria-label="Sledeći mesec"
            className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 transition-all hover:border-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {!isThisMonth && (
          <button
            onClick={() =>
              setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
            }
            className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900 py-2 text-xs font-black uppercase tracking-wider transition-all hover:border-white"
          >
            Vrati na ovaj mesec
          </button>
        )}
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-900 bg-red-900/30 px-5 py-4 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            onClick={load}
            className="rounded-lg border border-red-700 bg-red-900/60 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all hover:bg-red-900"
          >
            Pokušaj ponovo
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-neutral-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
          Učitavanje statistike...
        </div>
      ) : (
        <>
          {/* ── NOVAC ── */}
          {/* lg (1024px), ne xl: laptop od 1280px sa scrollbar-om ima viewport
              ~1265 i nikad ne bi dobio četiri kolone. */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Card
              label="Ostvareno"
              value={fmtMoney(realizedMoney)}
              sub={
                unconfirmedMoney > 0
                  ? `${realizedCount} prošlih · potvrđeno ${fmtMoney(paidMoney)}`
                  : `${realizedCount} prošlih · sve potvrđeno`
              }
              icon={<Banknote className="h-3.5 w-3.5" />}
              tone="text-green-400"
            />
            <Card
              label="Zakazano"
              value={fmtMoney(upcomingMoney)}
              sub={`${upcomingRows.length} termina u knjizi`}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              tone="text-blue-400"
            />
            <Card
              label="Prognoza"
              value={fmtMoney(forecastMoney)}
              sub={
                hasHistory
                  ? `~${forecastCuts} mušterija na slobodne termine`
                  : "nema istorije za procenu"
              }
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              tone="text-neutral-300"
            />
            <Card
              label="Projekcija meseca"
              value={fmtMoney(projected)}
              sub="ostvareno + zakazano + prognoza"
              strong
            />
          </div>

          {unconfirmedRows.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-yellow-900/60 bg-yellow-900/20 p-4 text-sm text-yellow-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{unconfirmedRows.length}</strong> prošlih termina (
                {fmtMoney(unconfirmedMoney)}) nije označeno kao završeno. Novac
                je uračunat u ostvareno, ali se ne može potvrditi da je mušterija
                došla. Klikni zeleno ✓ na terminu da postane potvrđen.
              </span>
            </div>
          )}

          {!hasHistory && (
            <div className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Nema istorije za prognozu — prikazuje se samo ono što je već
                zakazano. Prosek se računa iz poslednjih {HISTORY_WEEKS} nedelja.
              </span>
            </div>
          )}

          {/* ── KO KOLIKO ZARAĐUJE (samo za ceo studio) ── */}
          {!barberId && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
              <h3 className="text-sm font-black uppercase tracking-widest">
                Ko koliko zarađuje
              </h3>
              <p className="mb-5 mt-1 text-xs text-neutral-600">
                {monthLabel} · ostvareno + zakazano, bez prognoze
              </p>
              <div className="space-y-4">
                {perBarber.map((p, idx) => {
                  const share = studioTotal
                    ? Math.round((p.total / studioTotal) * 100)
                    : 0;
                  return (
                    <div key={p.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`text-xs font-black ${
                              idx === 0 ? "text-green-400" : "text-neutral-600"
                            }`}
                          >
                            {idx + 1}.
                          </span>
                          <span className="truncate text-sm font-bold">{p.name}</span>
                          <span className="shrink-0 text-[11px] text-neutral-600">
                            {p.count} muš. · {share}%
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-black tabular-nums">
                          {fmtMoney(p.total)}
                        </span>
                      </div>
                      <Bar value={p.total} max={maxBarberMoney} color="bg-green-500" />
                      <p className="mt-1 text-[11px] text-neutral-600">
                        potvrđeno {fmtMoney(p.paid)}
                        {p.total > p.paid &&
                          ` · nepotvrđeno ${fmtMoney(p.total - p.paid)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ZARADA PO NEDELJAMA ── */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-widest">
              Zarada po nedeljama
            </h3>
            <div className="mb-5 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-green-500" /> naplaćeno
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-yellow-500" /> nepotvrđeno
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-blue-500" /> zakazano
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-2 rounded-full bg-neutral-600" /> prognoza
              </span>
            </div>

            <div className="space-y-4">
              {weeks.map((w, i) => {
                const total = w.paid + w.unconfirmed + w.upcoming + w.forecast;
                const pct = (v: number) => (v / maxWeekMoney) * 100;
                return (
                  <div key={w.from}>
                    {/* Na telefonu datum ide u drugi red (block), inače bi
                        oznaka "sad" prelomila red na ružnom mestu. */}
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="min-w-0">
                        <span
                          className={`text-sm font-bold ${
                            w.isCurrent ? "text-white" : "text-neutral-400"
                          }`}
                        >
                          {i + 1}. ned.
                        </span>
                        {w.isCurrent && (
                          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-black">
                            sad
                          </span>
                        )}
                        <span className="block truncate text-[11px] capitalize text-neutral-600 sm:ml-2 sm:inline">
                          {formatDateShort(w.from)} – {formatDateShort(w.to)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-black tabular-nums">
                        {fmtMoney(total)}
                      </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${pct(w.paid)}%` }}
                      />
                      <div
                        className="h-full bg-yellow-500 transition-all duration-500"
                        style={{ width: `${pct(w.unconfirmed)}%` }}
                      />
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${pct(w.upcoming)}%` }}
                      />
                      <div
                        className="h-full bg-neutral-600 transition-all duration-500"
                        style={{ width: `${pct(w.forecast)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── NAREDNIH 7 DANA ── */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                  <CalendarDays className="h-4 w-4" />
                  Narednih 7 dana
                </h3>
                <p className="mt-1 text-xs capitalize text-neutral-600">
                  {formatDateShort(today)} – {formatDateShort(weekTo)}
                </p>
              </div>
              {/* Pri prelamanju na telefonu blok uzme ceo red — bez
                  text-left bi iznos ostao centriran i izgledao odlomljeno. */}
              <div className="w-full text-left sm:w-auto sm:text-right">
                <p className="text-xl font-black sm:text-2xl">{fmtMoney(weekMoney)}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {weekBooked} zakazanih
                  {weekExtraMoney > 0 && ` · prognoza +${fmtMoney(weekExtraMoney)}`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {nextWeek.map((d, i) => {
                const pct = Math.min(100, (d.booked / Math.max(1, d.capacity)) * 100);
                const perB = BARBERS.map((b) => ({
                  name: b.name,
                  n: d.items.filter((r) => r.barber === b.id).length,
                }));
                return (
                  <div
                    key={d.iso}
                    className={`rounded-xl border p-3 sm:p-4 ${
                      i === 0
                        ? "border-white/25 bg-neutral-900"
                        : "border-neutral-800 bg-neutral-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-black capitalize">
                          {formatDateShort(d.iso)}
                        </span>
                        {i === 0 && (
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase text-black">
                            danas
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-black tabular-nums">
                          {d.booked}
                          <span className="text-xs font-bold text-neutral-600">
                            /{d.capacity}
                          </span>
                        </span>
                        <span className="text-sm font-black tabular-nums text-green-400">
                          {fmtMoney(d.money)}
                        </span>
                      </span>
                    </div>

                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {!barberId && (
                      <p className="mt-2 truncate text-[11px] text-neutral-600">
                        {perB.map((p) => `${p.name} ${p.n}`).join(" · ")}
                      </p>
                    )}

                    {d.items.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {d.items.map((r, k) => (
                          <span
                            key={`${r.appointment_time}-${r.barber}-${k}`}
                            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] font-bold"
                          >
                            {r.appointment_time}
                            <span className="ml-1 font-normal text-neutral-400">
                              {r.first_name}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2.5 text-[11px] text-neutral-600">
                        Nema zakazanih
                        {d.extra > 0 && ` · prognoza ~${d.extra}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PROGNOZA DANA ── */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <TrendingUp className="h-4 w-4" />
              Koji dan najbolje radi
            </h3>
            <p className="mb-5 mt-1 text-xs text-neutral-600">
              Prosek mušterija po danu iz poslednjih {HISTORY_WEEKS} nedelja ·
              prosečan račun {fmtMoney(avgTicket)}
            </p>
            <div className="space-y-3">
              {dayRanking.map((d, idx) => (
                <div key={d.short} className="flex items-center gap-2 sm:gap-3">
                  <span
                    className={`w-5 shrink-0 text-center text-xs font-black ${
                      idx === 0 ? "text-green-400" : "text-neutral-600"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  {/* "Ponedeljak" se na telefonu sekao — tamo ide skraćeno */}
                  <span className="w-9 shrink-0 text-sm font-bold capitalize sm:w-24">
                    <span className="sm:hidden">{d.short}</span>
                    <span className="hidden sm:inline">{d.long}</span>
                  </span>
                  <Bar value={d.avg} max={maxAvg} />
                  <span className="w-12 shrink-0 text-right text-xs font-black tabular-nums sm:w-16 sm:text-sm">
                    ~{d.avg.toFixed(1)}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs font-black tabular-nums text-green-400 sm:w-24 sm:text-sm">
                    <span className="sm:hidden">
                      {fmtMoneyShort(d.avg * avgTicket)}
                    </span>
                    <span className="hidden sm:inline">
                      {fmtMoney(d.avg * avgTicket)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DAY VIEW TAB
// ═══════════════════════════════════════════════════════════════
function DayViewTab({
  appointments,
  selectedDate,
  onSelectDate,
  onDelete,
  onStatusChange,
  onBlockClient,
}: {
  appointments: Appointment[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onBlockClient: (apt: Appointment) => void;
}) {
  const today = getTodayISO();
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
    if (dir === "prev" && prevDate) onSelectDate(prevDate);
    if (dir === "next" && nextDate) onSelectDate(nextDate);
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
      if (nextDate) onSelectDate(nextDate);
      else if (prevDate) onSelectDate(prevDate);
      else onSelectDate(today);
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
                  onClick={() => onSelectDate(date)}
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
                        <div className="text-sm text-neutral-500 mt-0.5">
                          <p className="truncate">
                            {apt.phone_number}
                            {apt.user_email && ` · ${apt.user_email}`}
                          </p>
                          <p className="text-xs text-accent mt-0.5">
                            Frizer: {apt.barber_name || apt.barber || "—"}
                          </p>
                        </div>
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
                      {/* Crna lista — termin ostaje, klijent više ne može sam da zakaže */}
                      {!isBlocked && (
                        <button
                          onClick={() => onBlockClient(apt)}
                          title="Blokiraj klijenta za online zakazivanje"
                          className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-700 hover:bg-red-900/30 transition-all"
                        >
                          <UserX className="w-4 h-4 text-red-400" />
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
// CRNA LISTA — zajedničke funkcije
// ═══════════════════════════════════════════════════════════════
// PAZI na razliku u imenima:
//   tab "Blokiranje"  → blokira slobodne TERMINE u rasporedu
//   tab "Crna lista"  → blokira KLIJENTA da sam zakazuje online
//
// Crna lista važi za ceo studio, ne po frizeru — klijent sam bira
// frizera, pa bi blokada kod jednog samo preselila problem kod drugog.
// Server (pb_hooks/blocked.pb.js) je taj koji odbija rezervaciju;
// ovde se lista samo održava.

// PocketBase greška — samo polja koja nam trebaju.
// status 404 na kolekciji = kolekcija ne postoji (migracija nije puštena).
type PbError = { status?: number; message?: string };

// Da li je ovaj telefon/mejl već na listi. Vraća zapis ili null.
async function findOnBlacklist(phoneNorm: string, emailNorm: string) {
  const parts: string[] = [];
  if (phoneNorm) parts.push(pb.filter("phone_norm = {:p}", { p: phoneNorm }));
  if (emailNorm) parts.push(pb.filter("email = {:e}", { e: emailNorm }));
  if (parts.length === 0) return null;

  const found = await pb.collection("blocked_clients").getFullList({
    filter: parts.join(" || "),
  });
  return (found[0] as unknown as BlockedClient) || null;
}

// Blokiranje direktno iz liste termina. Jedan prompt služi i kao potvrda:
// Cancel prekida, OK upisuje (razlog sme da ostane prazan).
// Postojeći termini klijenta se NE diraju — blokada važi za nove.
async function blockClientFromAppointment(apt: Appointment) {
  const name = cleanName(apt.first_name, apt.last_name);
  const phone = apt.phone_number || "";
  const email = apt.user_email || "";
  const phoneNorm = normPhone(phone);
  const emailNorm = normEmail(email);

  if (!phoneNorm && !emailNorm) {
    alert("Ovaj termin nema ni telefon ni email — klijent se ne može prepoznati.");
    return;
  }

  const reason = prompt(
    `Blokirati ${name} za online zakazivanje?\n\n` +
      `Telefon: ${phone || "—"}\n` +
      `Email: ${email || "—"}\n\n` +
      `Postojeći termini ostaju. Razlog (opciono):`,
    "",
  );
  if (reason === null) return; // Cancel

  try {
    const existing = await findOnBlacklist(phoneNorm, emailNorm);
    if (existing) {
      alert(`${name} je već na crnoj listi.`);
      return;
    }
    await pb.collection("blocked_clients").create({
      name,
      phone,
      phone_norm: phoneNorm,
      email: emailNorm,
      reason: reason.trim(),
    });
    alert(`${name} je blokiran za online zakazivanje.`);
  } catch (err) {
    const e = err as PbError;
    alert(
      e?.status === 404
        ? "Kolekcija 'blocked_clients' ne postoji na serveru — migracija nije puštena."
        : `Greška pri blokiranju: ${e?.message || err}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// CRNA LISTA TAB
// ═══════════════════════════════════════════════════════════════
function BlacklistTab() {
  const [list, setList] = useState<BlockedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("blocked_clients").getFullList({
        sort: "-created",
      });
      setList(records as unknown as BlockedClient[]);
      setError("");
    } catch (err) {
      setError(
        (err as PbError)?.status === 404
          ? "Kolekcija 'blocked_clients' ne postoji na serveru. Pusti migraciju iz pb_migrations/."
          : "Greška pri učitavanju crne liste.",
      );
      setList([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneNorm = normPhone(phone);
    const emailNorm = normEmail(email);

    // Ime je samo oznaka za tebe — prepoznavanje ide po telefonu/mejlu.
    if (!phoneNorm && !emailNorm) {
      alert("Unesi broj telefona ili email — po tome server prepoznaje klijenta.");
      return;
    }

    setSaving(true);
    try {
      const existing = await findOnBlacklist(phoneNorm, emailNorm);
      if (existing) {
        alert(`Već na listi: ${existing.name || existing.phone || existing.email}`);
        setSaving(false);
        return;
      }
      await pb.collection("blocked_clients").create({
        name: name.trim(),
        phone: phone.trim(),
        phone_norm: phoneNorm,
        email: emailNorm,
        reason: reason.trim(),
      });
      setName("");
      setPhone("");
      setEmail("");
      setReason("");
      await load();
    } catch (err) {
      alert(`Greška pri upisu: ${(err as PbError)?.message || err}`);
    }
    setSaving(false);
  };

  const handleRemove = async (item: BlockedClient) => {
    const label = item.name || item.phone || item.email;
    if (!confirm(`Ukloniti ${label} sa crne liste?\n\nMoći će ponovo da zakazuje online.`))
      return;
    try {
      await pb.collection("blocked_clients").delete(item.id);
      setList((prev) => prev.filter((b) => b.id !== item.id));
    } catch (err) {
      alert(`Greška pri brisanju: ${(err as PbError)?.message || err}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── OBJAŠNJENJE ── */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex gap-3">
        <AlertCircle className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
        <p className="text-sm text-neutral-400 leading-relaxed">
          Klijent sa ove liste ne može sam da zakaže termin — ni sa sajta, ni iz
          aplikacije. Prepoznaje se po <strong className="text-white">broju telefona</strong> ili{" "}
          <strong className="text-white">email adresi</strong>. Kad ga server odbije, zapamti mu i{" "}
          <strong className="text-white">uređaj</strong>, pa ne prođe ni ako se vrati sa novim
          brojem — dok ne obriše podatke sajta ili ne reinstalira aplikaciju. Postojeći termini
          mu ostaju, a ti i dalje možeš ručno da mu upišeš termin preko taba „Blokiranje".
        </p>
      </div>

      {/* ── DODAVANJE ── */}
      <div className="bg-neutral-950 border border-red-900/40 rounded-2xl p-6">
        <h3 className="font-black uppercase tracking-widest text-sm mb-5 flex items-center gap-2">
          <UserX className="w-4 h-4 text-red-500" />
          Blokiraj klijenta
        </h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">
                Ime i prezime (opciono)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dragan Tegeltija"
                className="w-full bg-black border border-neutral-800 px-4 py-3 rounded-xl text-white focus:outline-none focus:border-neutral-600"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">
                Telefon
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+381 64 243 7639"
                className="w-full bg-black border border-neutral-800 px-4 py-3 rounded-xl text-white focus:outline-none focus:border-neutral-600"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ime@gmail.com"
                className="w-full bg-black border border-neutral-800 px-4 py-3 rounded-xl text-white focus:outline-none focus:border-neutral-600"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 uppercase block mb-2">
                Razlog (opciono)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ne dolazi na zakazane termine"
                className="w-full bg-black border border-neutral-800 px-4 py-3 rounded-xl text-white focus:outline-none focus:border-neutral-600"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-600">
            Dovoljan je telefon ILI email. Ako upišeš oba, blokira ga bilo koji od njih.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-red-900 hover:bg-red-800 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <UserX className="w-4 h-4" />
            {saving ? "Blokiranje..." : "Blokiraj"}
          </button>
        </form>
      </div>

      {/* ── LISTA ── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black uppercase tracking-widest text-sm">
            Blokirani klijenti ({list.length})
          </h3>
          <button
            onClick={load}
            className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-white transition-all"
            title="Osveži"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-900 text-red-200 px-5 py-4 rounded-2xl text-sm mb-5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500 gap-3">
            <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
            Učitavanje...
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16">
            <UserX className="w-14 h-14 mx-auto mb-4 text-neutral-700" />
            <p className="text-neutral-500">Nema blokiranih klijenata</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((item) => (
              <div
                key={item.id}
                className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-black text-base truncate">
                    {item.name || "Bez imena"}
                  </p>
                  <p className="text-sm text-neutral-500 mt-1 truncate">
                    {item.phone || "—"}
                    {item.email && ` · ${item.email}`}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-neutral-600 mt-1.5 italic">{item.reason}</p>
                  )}
                  {/* Uređaje server sam pamti kad odbije pokušaj zakazivanja */}
                  {deviceCount(item) > 0 && (
                    <p className="text-xs text-red-400/80 mt-1.5 flex items-center gap-1.5">
                      <Smartphone className="w-3 h-3" />
                      {deviceCount(item) === 1
                        ? "zapamćen 1 uređaj"
                        : `zapamćena ${deviceCount(item)} uređaja`}
                      <span className="text-neutral-600">
                        — ne prođe ni sa drugim brojem
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(item)}
                  title="Ukloni sa liste"
                  className="p-2.5 shrink-0 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-green-700 hover:bg-green-900/30 transition-all"
                >
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </button>
              </div>
            ))}
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
  const [activeTab, setActiveTab] = useState<TabId>("days");
  // Raste na svaki klik "osveži" — StatsTab ga ima u zavisnostima.
  const [reloadKey, setReloadKey] = useState(0);
  const [listFilter, setListFilter] = useState<"all" | "booked" | "completed" | "blocked">("all");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [error, setError] = useState("");

  // ── selectedDate je ovde u parentu, ne u DayViewTab ──
  // Tako se ne resetuje kada se appointments osvežavaju
  const [selectedDate, setSelectedDate] = useState(getTodayISO());

  // ── PRISTUP PO FRIZERU ──
  // Na user nalogu u PocketBase: barber_id ("barber-1/2/3") = čije termine vidi,
  // is_boss = true (Petar) vidi sve frizere i bira koga gleda.
  // Nalog BEZ barber_id i BEZ is_boss ne vidi nijedan termin (ekran za podešavanje).
  const [me, setMe] = useState(pb.authStore.model);
  const isBoss = !!me?.is_boss;
  const myBarberId: string = me?.barber_id || "";
  const hasBarberAccess = isBoss || !!myBarberId;
  const [barberView, setBarberView] = useState<string>("all"); // koristi samo šef
  const activeBarberId = isBoss ? (barberView === "all" ? "" : barberView) : myBarberId;
  // Blokiranje/ručna rezervacija uvek ide na KONKRETNOG frizera:
  // šef mora da izabere frizera (ili radi za sebe), ostali rade samo za sebe.
  const blockingBarberId = activeBarberId || myBarberId || "barber-3";

  // ── TIHO osvežavanje (bez loading spinnera, bez unmount-a DayViewTab) ──
  const silentFetch = useCallback(async () => {
    try {
      const records = await pb.collection("appointments").getFullList({
        sort: "+appointment_date,+appointment_time",
        ...(activeBarberId ? { filter: `barber = "${activeBarberId}"` } : {}),
      });
      setAppointments(records as unknown as Appointment[]);
    } catch {
      // Tihi fail – ne prikazuje grešku korisniku
    }
  }, [activeBarberId]);

  // ── Sabijanje realtime osvežavanja ──
  // Realtime šalje po JEDAN događaj za SVAKI izmenjen zapis. Kod fiksnog
  // termina to je 12 događaja odjednom, kod blokiranja odmora i preko 80 —
  // a svaki je ranije pokretao preuzimanje kompletne liste termina.
  // Pošto privacy hook radi po zapisu, to je značilo desetine hiljada
  // izvršavanja u par sekundi i server bi ostao bez memorije.
  // Zato se sve to sabija u JEDNO osvežavanje, 800ms posle poslednjeg događaja.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSilentFetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      silentFetch();
    }, 800);
  }, [silentFetch]);

  // ── Inicijalno učitavanje (sa loading spinnerom) ──
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const records = await pb.collection("appointments").getFullList({
        sort: "+appointment_date,+appointment_time",
        ...(activeBarberId ? { filter: `barber = "${activeBarberId}"` } : {}),
      });
      setAppointments(records as unknown as Appointment[]);
    } catch {
      setError("Greška pri učitavanju termina.");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [activeBarberId]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      setCheckingAdmin(true);
      setError("");
      let user = pb.authStore.model;
      if (!user) {
        setError("Nema aktivne sesije. Molimo prijavite se.");
        setCheckingAdmin(false);
        setLoading(false);
        return;
      }
      // Osveži nalog sa servera — povlači nova polja (barber_id, is_boss)
      // i kad su dodata POSLE poslednjeg logina, bez ponovne prijave.
      try {
        const refreshed = await pb.collection("users").authRefresh();
        user = refreshed.record;
        setMe(user);
      } catch {
        // Nema mreže ili istekla sesija — nastavi sa keširanim nalogom
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
      // Bez dodeljenog frizera (i bez is_boss) NE učitavaj ničije termine
      if (!user.is_boss && !user.barber_id) {
        setLoading(false);
        return;
      }
      await fetchAppointments();

      // ── Osvežavanje: realtime na webu, anketiranje u aplikaciji ──
      // Realtime ide preko EventSource (SSE), a njega CapacitorHttp NE
      // presreće — ostaje na WebView origin-u "https://localhost", koji
      // PocketBase nema u listi dozvoljenih, pa veza padne na CORS-u.
      // Zato u aplikaciji obično anketiranje; podaci kasne najviše 30s.
      if (isNativeApp) {
        pollTimer = setInterval(() => {
          silentFetch();
        }, NATIVE_POLL_MS);
      } else {
        try {
          // ── Realtime koristi silentFetch – ne resetuje selectedDate ──
          // Kroz scheduleSilentFetch, da nalet događaja ne obori server.
          unsubscribe = await pb.collection("appointments").subscribe("*", () => {
            scheduleSilentFetch();
          });
        } catch (err) {
          console.error("Realtime subscription failed:", err);
        }
      }
    };

    init();
    return () => {
      if (unsubscribe) unsubscribe();
      if (pollTimer) clearInterval(pollTimer);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [fetchAppointments, scheduleSilentFetch, silentFetch]);

  // Povratak iz pozadine u aplikaciji = odmah povuci sveže termine,
  // da šef ne gleda stanje od pre pola sata dok ne istekne anketiranje.
  useEffect(() => onAppResume(() => silentFetch()), [silentFetch]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    // ── Refresh dugme isto koristi silentFetch ──
    await silentFetch();
    // Statistika ima svoj zahtev (drugi opseg datuma), pa je silentFetch ne
    // dotiče — ovaj brojač je u njenim zavisnostima i tera je da se osveži.
    setReloadKey((k) => k + 1);
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

  // ── Admin jeste, ali nalog nije povezan ni sa jednim frizerom ──
  // Ne prikazujemo NIČIJE termine dok se u PocketBase ne upiše barber_id / is_boss.
  if (!hasBarberAccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-4">Nalog nije povezan sa frizerom</h2>
          <p className="text-neutral-400 mb-2">
            Nalog <span className="text-white font-bold">{me?.email}</span> je admin,
            ali mu nije dodeljen frizer, pa ne može da vidi termine.
          </p>
          <p className="text-neutral-400 mb-6 text-sm">
            U PocketBase → kolekcija <b className="text-white">users</b> → ovaj nalog, upiši{" "}
            <b className="text-white">barber_id</b>: <code>barber-1</code> (Marić),{" "}
            <code>barber-2</code> (Nanić) ili <code>barber-3</code> (Petar).
            Šefu uključi i <b className="text-white">is_boss</b>. Zatim osveži ovu stranicu.
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-white text-black font-bold hover:bg-neutral-200 transition rounded-xl"
          >
            Odjavi se
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── HEADER ── */}
      {/* Namerno NIJE lepljivo: lepljivi su tabovi ispod, a dva elementa na
          "top-0" bi se preklopila. Pri dugoj listi termina je važnija
          navigacija nego dugme za odjavu. */}
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4 sm:py-5">
          {/* min-w-0 + truncate: dugi mejl na telefonu gura dugmad iz ekrana */}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black uppercase tracking-tighter sm:text-2xl">
              Admin Dashboard
            </h1>
            <p className="truncate text-[11px] text-neutral-600 sm:text-xs">
              {me?.email}
              {myBarberId && ` · ${barberName(myBarberId)}`}
              {isBoss && " · ŠEF"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              title="Osveži podatke"
              aria-label="Osveži podatke"
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-sm font-bold transition-colors hover:border-neutral-600 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              title="Odjavi se"
              aria-label="Odjavi se"
              className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 text-sm font-bold transition-colors hover:border-neutral-600 hover:bg-neutral-800 sm:px-4"
            >
              <LogOut className="h-4 w-4" />
              {/* Tekst samo na širim ekranima — na telefonu ikona govori sve */}
              <span className="hidden sm:inline">Odjavi se</span>
            </button>
          </div>
        </div>
      </header>

      {/* Uži bočni prostor na telefonu — px-6 je tamo trošio ekran.
          Lepljivi tabovi ispod ponavljaju iste vrednosti u -mx/px. */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">

        {/* ── ŠEF: izbor frizera čiji se raspored gleda ── */}
        {/* Mreža od 4 kolone na telefonu, red na širim ekranima — da sva
            četiri dugmeta stanu odjednom, bez vodoravnog skrolovanja. */}
        {isBoss && (
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-neutral-600">
              Gledaš raspored
            </p>
            <div className="grid grid-cols-4 gap-2 sm:flex">
              {[{ id: "all", name: "Svi" }, ...BARBERS].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBarberView(b.id)}
                  className={`truncate rounded-xl px-2 py-2 text-xs font-black uppercase transition-all sm:px-4 sm:text-sm ${
                    barberView === b.id
                      ? "bg-white text-black"
                      : "border border-neutral-800 bg-neutral-900 text-white hover:border-neutral-600"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STAT KARTICE ── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: "Danas", value: todayCount, color: "text-white" },
            { label: "Zakazani", value: bookedCount, color: "text-green-400" },
            { label: "Završeni", value: completedCount, color: "text-neutral-400" },
            { label: "Blokirani", value: blockedCount, color: "text-red-500" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5"
            >
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-600 sm:text-xs">
                {label}
              </p>
              <p className={`text-2xl font-black sm:text-3xl ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── TABOVI ── */}
        {/* Lepljivi na vrhu, da se pri dugoj listi termina ne mora skrolovati
            nazad do navigacije.
            Na telefonu: mreža od 5 kolona, ikona iznad kratke oznake — svih
            pet tabova stane u jedan ekran. Ranije je red bio vodoravno
            skrolujuć, pa se peti tab uopšte nije video.
            Od sm naviše: običan red sa punim nazivima. */}
        <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-neutral-900 bg-black/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="grid grid-cols-5 gap-1.5 sm:flex sm:gap-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  title={t.label}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-black uppercase leading-none transition-all sm:flex-row sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm ${
                    active
                      ? t.danger
                        ? "border border-red-700 bg-red-900 text-white"
                        : "bg-white text-black"
                      : `border border-neutral-800 bg-neutral-900 text-white ${
                          t.danger ? "hover:border-red-800" : "hover:border-neutral-600"
                        }`
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SADRŽAJ ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-neutral-500 gap-3">
            <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
            Učitavanje...
          </div>
        ) : activeTab === "days" ? (
          // ── selectedDate i onSelectDate dolaze iz parenta – ne resetuju se ──
          <DayViewTab
            appointments={appointments}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onBlockClient={blockClientFromAppointment}
          />
        ) : activeTab === "stats" ? (
          // Svaki frizer vidi svoju zaradu; šef vidi onoga koga je izabrao
          // gore ("Svi frizeri" = ceo studio). barberId je prop, pa promena
          // izbora sama pokreće novo preuzimanje podataka.
          // `key` nosi i reloadKey: klik na "osveži" u zaglavlju montira
          // komponentu iznova, pa se podaci povuku ponovo (statistika ima
          // svoj zahtev, drugi opseg datuma, koji silentFetch ne dotiče).
          <StatsTab
            key={`${activeBarberId}-${reloadKey}`}
            barberId={activeBarberId}
          />
        ) : activeTab === "blocking" ? (
          <BlockingTab barberId={blockingBarberId} />
        ) : activeTab === "blacklist" ? (
          <BlacklistTab />
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Telefon</p>
                            <p className="text-white">{appointment.phone_number}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Email</p>
                            <p className="text-white truncate">{appointment.user_email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-neutral-600 font-black mb-1">Frizer</p>
                            <p className="text-white truncate">{appointment.barber_name || appointment.barber || "—"}</p>
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
                        {appointment.status !== "blocked" && (
                          <button
                            onClick={() => blockClientFromAppointment(appointment)}
                            className="p-2.5 bg-neutral-900 hover:bg-red-900/30 border border-neutral-800 hover:border-red-700 rounded-xl transition-all"
                            title="Blokiraj klijenta za online zakazivanje"
                          >
                            <UserX className="w-4 h-4 text-red-400" />
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
