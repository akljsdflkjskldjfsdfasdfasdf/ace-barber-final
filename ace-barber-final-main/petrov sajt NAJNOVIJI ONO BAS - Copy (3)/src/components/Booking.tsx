import { useState, useEffect } from "react";
import { pb } from "../lib/pocketbase";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  Clock,
  Scissors,
  Droplets,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Reveal from "./Reveal";

const allTimeSlots = [
  "11:00",
  "11:45",
  "12:30",
  "13:15",
  "14:00",
  "14:45",
  "15:30",
  "16:15",
  "17:00",
  "17:45",
  "18:30",
  "19:15",
];

export default function Booking() {
  // ─── Booking states ────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [tempTime, setTempTime] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hasBeard, setHasBeard] = useState(false);
  const [hasWash, setHasWash] = useState(false);
  const [bookedSlots, setBookedSlots] = useState(new Set<string>());
  const [loading, setLoading] = useState(false);

  // ─── Booking helpers ───────────────────────────────────────────
  const formatDateISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getAvailableSlotsForDate = (dateString: string) => {
    if (!dateString) return [];
    const date = new Date(dateString);
    const isSunday = date.getDay() === 0;
    return isSunday
      ? allTimeSlots.filter((slot) => parseInt(slot.split(":")[0]) < 16)
      : allTimeSlots;
  };

  const currentSlots = getAvailableSlotsForDate(selectedDate);

  const isTimeInPast = (timeSlot: string) => {
    const now = new Date();
    const todayStr = formatDateISO(now);
    if (selectedDate !== todayStr) return false;
    const [slotHours, slotMinutes] = timeSlot.split(":").map(Number);
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    if (slotHours < currentHours) return true;
    if (slotHours === currentHours && slotMinutes <= currentMinutes)
      return true;
    return false;
  };

  const checkSlotAvailability = (time: string) => {
    if (bookedSlots.has(time)) return { disabled: true };
    if (isTimeInPast(time)) return { disabled: true };
    if (hasBeard) {
      const index = currentSlots.indexOf(time);
      const nextSlot = currentSlots[index + 1];
      if (!nextSlot || bookedSlots.has(nextSlot) || isTimeInPast(nextSlot)) {
        return { disabled: true };
      }
    }
    return { disabled: false };
  };

  // ─── Fetch zauzeti termini (PocketBase) ────────────────────────
  useEffect(() => {
    if (selectedDate) {
      const fetchBookedSlots = async () => {
        try {
          const records = await pb.collection("appointments").getFullList({
            filter: `appointment_date = "${selectedDate}" && (status = "booked" || status = "blocked")`,
            fields: "appointment_time",
          });
          setBookedSlots(new Set(records.map((r: any) => r.appointment_time)));
        } catch {
          setBookedSlots(new Set());
        }
      };
      fetchBookedSlots();
    } else {
      setSelectedTime("");
      setBookedSlots(new Set());
    }
  }, [selectedDate]);

  const isDateDisabled = (date: Date | null) => {
    if (!date) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);
    return date < today || date > maxDate;
  };

  const handleConfirmTime = () => {
    if (tempTime) {
      setSelectedTime(tempTime);
      setShowTimePicker(false);
    }
  };

  // ─── Submit (PocketBase) – bez prijave ─────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !selectedDate ||
      !selectedTime
    ) {
      toast.error("Popunite sva obavezna polja!");
      return;
    }
    setLoading(true);
    const serviceNote =
      (hasBeard ? " + Beard" : "") + (hasWash ? " + Wash" : "");
    try {
      await pb.collection("appointments").create({
        first_name: firstName,
        last_name: lastName + serviceNote,
        phone_number: phoneNumber,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        status: "booked",
        user_email: email.trim(),
      });
      toast.success("Termin uspešno zakazan!", {
        description: `${selectedTime} · ${new Date(
          selectedDate,
        ).toLocaleDateString("sr-RS", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}`,
      });
      setFirstName("");
      setLastName("");
      setPhoneNumber("");
      setEmail("");
      setSelectedTime("");
      setSelectedDate("");
      setHasBeard(false);
      setHasWash(false);
    } catch (err: any) {
      console.error("Booking error:", err?.status, err?.response ?? err);
      if (err?.status === 400) {
        toast.error("Ovaj termin je već zauzet!");
      } else if (err?.status === 403) {
        toast.error("Zakazivanje trenutno nije dozvoljeno.", {
          description:
            "U PocketBase otključaj 'Create rule' za kolekciju appointments.",
        });
      } else if (!err?.status) {
        toast.error("Nema veze sa serverom.", {
          description: "Proveri internet konekciju ili VITE_POCKETBASE_URL.",
        });
      } else {
        toast.error("Greška pri zakazivanju. Pokušajte ponovo.");
      }
    }
    setLoading(false);
  };

  // ─── Calendar grid ─────────────────────────────────────────────
  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  ).getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++)
    days.push(null);
  for (
    let i = 1;
    i <= getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
    i++
  ) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  }

  return (
    <section id="booking" className="relative z-10 bg-background px-6 py-24">
      {/* CALENDAR MODAL */}
      {showCalendar && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <button
              onClick={() => setShowCalendar(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="mb-8 flex items-center justify-between">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)),
                  )
                }
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <span className="text-lg font-black uppercase tracking-widest">
                {currentMonth.toLocaleString("sr-RS", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)),
                  )
                }
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4 grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-muted-foreground">
              {["PON", "UTO", "SRE", "ČET", "PET", "SUB", "NED"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-3">
              {days.map((date, i) => {
                if (!date) return <div key={i} />;
                const dateISO = formatDateISO(date);
                const disabled = isDateDisabled(date);
                const isSelected = selectedDate === dateISO;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSelectedDate(dateISO);
                      setSelectedTime("");
                      setTempTime("");
                      setShowCalendar(false);
                      setShowTimePicker(true);
                    }}
                    className={`flex aspect-square items-center justify-center rounded-xl text-sm transition-all ${
                      disabled
                        ? "text-muted-foreground opacity-20"
                        : "text-foreground hover:bg-muted"
                    } ${
                      isSelected
                        ? "scale-110 bg-foreground font-black text-background"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TIME PICKER MODAL */}
      {showTimePicker && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <button
              onClick={() => {
                setShowTimePicker(false);
                setTempTime("");
              }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-6 w-6" />
            </button>
            <h3 className="mb-2 text-center text-xl font-black uppercase tracking-widest">
              Izaberite Vreme
            </h3>
            <p className="mb-8 text-center text-sm text-muted-foreground">
              {new Date(selectedDate).toLocaleDateString("sr-RS", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <div className="mb-8 grid grid-cols-3 gap-4">
              {currentSlots.map((time) => {
                const { disabled } = checkSlotAvailability(time);
                const isSelected = tempTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setTempTime(time)}
                    className={`rounded-2xl border-2 py-5 text-lg font-black transition-all ${
                      isSelected
                        ? "scale-105 border-foreground bg-foreground text-background shadow-xl"
                        : disabled
                          ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/40"
                          : "border-border bg-muted text-foreground hover:border-accent"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
            {hasBeard && (
              <p className="mb-6 text-center text-xs uppercase tracking-wider text-muted-foreground">
                * Brada zahteva dva uzastopna termina
              </p>
            )}
            <button
              onClick={handleConfirmTime}
              disabled={!tempTime}
              className="w-full rounded-2xl bg-foreground py-5 text-lg font-black uppercase tracking-tight text-background transition-all hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Potvrdi Vreme
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl">
        <Reveal className="mb-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-accent">
            Rezervacija
          </p>
          <h2 className="font-serif text-5xl font-bold tracking-tight text-foreground">
            Booking
          </h2>
          <p className="mt-4 text-muted-foreground">
            Zakažite termin za par sekundi — bez registracije.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Ime"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card p-5 outline-none transition-all focus:border-accent"
              />
              <input
                type="text"
                placeholder="Prezime"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card p-5 outline-none transition-all focus:border-accent"
              />
            </div>
            <input
              type="tel"
              placeholder="Broj Telefona"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card p-5 outline-none transition-all focus:border-accent"
            />
            <input
              type="email"
              placeholder="Email (opciono)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card p-5 outline-none transition-all focus:border-accent"
            />

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setHasBeard(!hasBeard);
                  setSelectedTime("");
                  setTempTime("");
                }}
                className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                  hasBeard
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:border-accent"
                }`}
              >
                <Scissors className="h-8 w-8" />
                <div className="text-sm font-black uppercase tracking-wider">
                  Brijanje Brade
                </div>
              </button>
              <button
                type="button"
                onClick={() => setHasWash(!hasWash)}
                className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                  hasWash
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:border-accent"
                }`}
              >
                <Droplets className="h-8 w-8" />
                <div className="text-sm font-black uppercase tracking-wider">
                  Pranje Kose
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendar(true)}
              className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:border-accent"
            >
              <div className="flex flex-col text-left">
                <span className="mb-1 text-[10px] font-black uppercase text-muted-foreground group-hover:text-accent">
                  Datum
                </span>
                <span
                  className={
                    selectedDate ? "font-bold text-foreground" : "text-muted-foreground"
                  }
                >
                  {selectedDate
                    ? new Date(selectedDate).toLocaleDateString("sr-RS", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                    : "Izaberi datum"}
                </span>
              </div>
              <CalendarIcon className="h-6 w-6 text-muted-foreground group-hover:text-accent" />
            </button>

            <div className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col text-left">
                <span className="mb-1 text-[10px] font-black uppercase text-muted-foreground">
                  Vreme
                </span>
                <span
                  className={
                    selectedTime ? "font-bold text-foreground" : "text-muted-foreground"
                  }
                >
                  {selectedTime || "Izaberi vreme nakon datuma"}
                </span>
              </div>
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedTime}
              className="mt-10 w-full rounded-2xl bg-foreground py-6 text-xl font-black uppercase tracking-tight text-background shadow-xl transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Slanje..." : "Potvrdi Termin"}
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
