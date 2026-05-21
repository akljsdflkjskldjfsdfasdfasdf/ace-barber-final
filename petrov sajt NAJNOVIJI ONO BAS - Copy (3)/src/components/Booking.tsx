import { useState, useEffect } from "react";
import { pb } from "../lib/pocketbase";
import {
  Calendar as CalendarIcon,
  Clock,
  Scissors,
  Droplets,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Mail,
  LogOut,
} from "lucide-react";

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
  // ─── Auth states ───────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(pb.authStore.model);
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  // ─── Booking states ────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
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
  const [message, setMessage] = useState({ type: "", text: "" });

  // Prati promene auth stanja (login/logout)
  useEffect(() => {
    const unsub = pb.authStore.onChange(() => {
      setCurrentUser(pb.authStore.model);
    });
    return () => unsub();
  }, []);

  // ─── Auth handlers ─────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      await pb.collection("users").authWithPassword(authEmail, authPassword);
      setAuthEmail("");
      setAuthPassword("");
    } catch {
      setAuthError("Pogrešan email ili lozinka.");
    }
    setAuthLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authPassword !== authPasswordConfirm) {
      setAuthError("Lozinke se ne poklapaju.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      await pb.collection("users").create({
        email: authEmail,
        password: authPassword,
        passwordConfirm: authPasswordConfirm,
        emailVisibility: true,
      });
      await pb.collection("users").requestVerification(authEmail);
      setRegisteredEmail(authEmail);
      setAuthEmail("");
      setAuthPassword("");
      setAuthPasswordConfirm("");
    } catch (err: any) {
      const msg =
        err?.data?.data?.email?.message ||
        err?.message ||
        "Registracija neuspešna.";
      setAuthError(msg);
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    pb.authStore.clear();
  };

  // ─── Booking helpers (isti kao pre) ───────────────────────────
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
            filter: `appointment_date = "${selectedDate}" && status = "booked"`,
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

  // ─── Submit (PocketBase) ───────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !selectedDate ||
      !selectedTime
    ) {
      setMessage({ type: "error", text: "Popunite sva polja!" });
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
        user_email: currentUser?.email || "",
      });
      setMessage({ type: "success", text: "Termin uspešno zakazan!" });
      setFirstName("");
      setLastName("");
      setPhoneNumber("");
      setSelectedTime("");
      setSelectedDate("");
      setHasBeard(false);
      setHasWash(false);
    } catch (err: any) {
      if (err?.status === 400) {
        setMessage({ type: "error", text: "Ovaj termin je već zauzet!" });
      } else {
        setMessage({
          type: "error",
          text: "Greška pri zakazivanju. Pokušajte ponovo.",
        });
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

  // ══════════════════════════════════════════════════════════════
  // PRIKAZ: Poruka "Proverite email" nakon registracije
  // ══════════════════════════════════════════════════════════════
  if (registeredEmail) {
    return (
      <section
        id="booking"
        className="py-24 px-6 bg-black text-white relative z-50"
      >
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center mx-auto mb-8">
            <Mail className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-black uppercase mb-4">
            Proverite Email
          </h2>
          <p className="text-neutral-400 mb-2">
            Poslali smo verifikacioni link na:
          </p>
          <p className="text-white font-bold mb-8">{registeredEmail}</p>
          <p className="text-neutral-500 text-sm mb-10">
            Kliknite na link u emailu, pa se prijavite.
          </p>
          <button
            onClick={() => {
              setRegisteredEmail("");
              setAuthView("login");
            }}
            className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase"
          >
            Prijavi se
          </button>
        </div>
      </section>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PRIKAZ: Login / Registracija (nije prijavljen)
  // ══════════════════════════════════════════════════════════════
  if (!currentUser) {
    return (
      <section
        id="booking"
        className="py-24 px-6 bg-black text-white relative z-50"
      >
        <div className="max-w-md mx-auto">
          <h2 className="text-5xl font-black text-center mb-16 tracking-tighter italic uppercase underline decoration-white/10 underline-offset-[15px]">
            {authView === "login" ? "Prijavi se" : "Registracija"}
          </h2>

          {authError && (
            <div className="bg-red-500/10 border border-red-500 rounded-2xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-400 text-sm">{authError}</p>
            </div>
          )}

          <form
            onSubmit={authView === "login" ? handleLogin : handleRegister}
            className="space-y-4"
          >
            <input
              type="email"
              placeholder="Email adresa"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
              className="bg-neutral-900 border border-neutral-800 p-5 w-full outline-none focus:border-white rounded-2xl transition-all"
            />
            <input
              type="password"
              placeholder="Lozinka"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              className="bg-neutral-900 border border-neutral-800 p-5 w-full outline-none focus:border-white rounded-2xl transition-all"
            />
            {authView === "register" && (
              <input
                type="password"
                placeholder="Potvrdi lozinku"
                value={authPasswordConfirm}
                onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                required
                className="bg-neutral-900 border border-neutral-800 p-5 w-full outline-none focus:border-white rounded-2xl transition-all"
              />
            )}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-5 bg-white text-black font-black text-lg rounded-2xl uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200 transition-all"
            >
              {authLoading
                ? "Učitavanje..."
                : authView === "login"
                  ? "Prijavi se"
                  : "Napravi nalog"}
            </button>
          </form>

          <p className="text-center text-neutral-500 mt-8 text-sm">
            {authView === "login" ? "Nemaš nalog? " : "Već imaš nalog? "}
            <button
              onClick={() => {
                setAuthView(authView === "login" ? "register" : "login");
                setAuthError("");
              }}
              className="text-white underline underline-offset-4"
            >
              {authView === "login" ? "Registruj se" : "Prijavi se"}
            </button>
          </p>
        </div>
      </section>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PRIKAZ: Email nije verifikovan
  // ══════════════════════════════════════════════════════════════
  if (!currentUser.verified) {
    return (
      <section
        id="booking"
        className="py-24 px-6 bg-black text-white relative z-50"
      >
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/10 border-2 border-yellow-500 flex items-center justify-center mx-auto mb-8">
            <Mail className="w-10 h-10 text-yellow-500" />
          </div>
          <h2 className="text-3xl font-black uppercase mb-4">
            Verifikujte Email
          </h2>
          <p className="text-neutral-400 mb-2">
            Da biste zakazali termin, verifikujte email:
          </p>
          <p className="text-white font-bold mb-10">{currentUser.email}</p>
          <div className="flex gap-4">
            <button
              onClick={async () => {
                try {
                  await pb
                    .collection("users")
                    .requestVerification(currentUser.email);
                  setMessage({ type: "success", text: "Email ponovo poslat!" });
                } catch {
                  setMessage({
                    type: "error",
                    text: "Greška pri slanju emaila.",
                  });
                }
              }}
              className="flex-1 py-4 bg-neutral-900 border border-neutral-700 text-white font-black rounded-2xl uppercase text-sm hover:border-white transition-all"
            >
              Pošalji ponovo
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-4 bg-white text-black font-black rounded-2xl uppercase text-sm flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Odjavi se
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // PRIKAZ: Glavni booking form (prijavljen + verifikovan)
  // ══════════════════════════════════════════════════════════════
  return (
    <section
      id="booking"
      className="py-24 px-6 bg-black text-white relative z-50"
    >
      {/* SUCCESS / ERROR MODAL */}
      {message.text && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 bg-black/90 backdrop-blur-md">
          <div
            className={`relative max-w-sm w-full p-10 rounded-3xl border-2 text-center bg-neutral-900 ${
              message.type === "success" ? "border-green-500" : "border-red-500"
            }`}
          >
            <div className="flex justify-center mb-6">
              {message.type === "success" ? (
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              ) : (
                <AlertCircle className="w-16 h-16 text-red-500" />
              )}
            </div>
            <h3 className="text-xl font-black uppercase mb-4">
              {message.type === "success" ? "Uspešno" : "Greška"}
            </h3>
            <p className="text-neutral-400 mb-8">{message.text}</p>
            <button
              onClick={() => setMessage({ type: "", text: "" })}
              className="w-full py-4 bg-white text-black font-black rounded-xl uppercase"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL */}
      {showCalendar && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-md w-full bg-neutral-950 border border-neutral-800 p-8 rounded-3xl shadow-2xl">
            <button
              onClick={() => setShowCalendar(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.setMonth(currentMonth.getMonth() - 1),
                    ),
                  )
                }
              >
                <ChevronLeft className="w-6 h-6" />
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
                    new Date(
                      currentMonth.setMonth(currentMonth.getMonth() + 1),
                    ),
                  )
                }
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-[10px] text-neutral-600 font-bold mb-4 text-center">
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
                    className={`aspect-square flex items-center justify-center text-sm rounded-xl transition-all ${
                      disabled
                        ? "text-neutral-800 opacity-20"
                        : "hover:bg-neutral-800 text-white"
                    } ${
                      isSelected
                        ? "bg-white text-black font-black scale-110"
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
        <div className="fixed inset-0 z-[900] flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
          <div className="relative max-w-md w-full bg-neutral-950 border border-neutral-800 p-8 rounded-3xl shadow-2xl">
            <button
              onClick={() => {
                setShowTimePicker(false);
                setTempTime("");
              }}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-xl font-black uppercase tracking-widest mb-2 text-center">
              Izaberite Vreme
            </h3>
            <p className="text-sm text-neutral-400 text-center mb-8">
              {new Date(selectedDate).toLocaleDateString("sr-RS", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {currentSlots.map((time) => {
                const { disabled } = checkSlotAvailability(time);
                const isSelected = tempTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && setTempTime(time)}
                    className={`py-5 rounded-2xl font-black text-lg transition-all border-2 ${
                      isSelected
                        ? "bg-white text-black border-white shadow-xl scale-105"
                        : disabled
                          ? "bg-neutral-900/30 text-neutral-800 border-neutral-900 cursor-not-allowed opacity-40"
                          : "bg-neutral-900 text-white border-neutral-700 hover:border-white hover:bg-neutral-800"
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
            {hasBeard && (
              <p className="text-xs text-neutral-500 uppercase tracking-wider text-center mb-6">
                * Brada zahteva dva uzastopna termina
              </p>
            )}
            <button
              onClick={handleConfirmTime}
              disabled={!tempTime}
              className="w-full py-5 bg-white text-black font-black text-lg rounded-2xl uppercase tracking-tight disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-200 transition-all"
            >
              Potvrdi Vreme
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Header sa info o korisniku */}
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-5xl font-black tracking-tighter italic uppercase underline decoration-white/10 underline-offset-[15px]">
            Booking
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-neutral-500 text-xs hidden sm:block">
              {currentUser.email}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-white transition-all"
              title="Odjavi se"
            >
              <LogOut className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Ime"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 p-5 outline-none focus:border-white w-full rounded-2xl transition-all"
            />
            <input
              type="text"
              placeholder="Prezime"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 p-5 outline-none focus:border-white w-full rounded-2xl transition-all"
            />
          </div>
          <input
            type="tel"
            placeholder="Broj Telefona"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 p-5 w-full outline-none focus:border-white rounded-2xl transition-all"
          />

          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setHasBeard(!hasBeard);
                setSelectedTime("");
                setTempTime("");
              }}
              className={`p-6 border-2 flex flex-col items-center gap-3 transition-all rounded-2xl ${
                hasBeard
                  ? "bg-white text-black border-white"
                  : "bg-neutral-900 border-neutral-700 text-white"
              }`}
            >
              <Scissors className="w-8 h-8" />
              <div className="font-black uppercase tracking-wider text-sm">
                Brijanje Brade
              </div>
            </button>
            <button
              type="button"
              onClick={() => setHasWash(!hasWash)}
              className={`p-6 border-2 flex flex-col items-center gap-3 transition-all rounded-2xl ${
                hasWash
                  ? "bg-white text-black border-white"
                  : "bg-neutral-900 border-neutral-700 text-white"
              }`}
            >
              <Droplets className="w-8 h-8" />
              <div className="font-black uppercase tracking-wider text-sm">
                Pranje Kose
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCalendar(true)}
            className="w-full bg-neutral-900 border border-neutral-800 p-5 flex items-center justify-between hover:border-neutral-500 transition-all rounded-2xl group"
          >
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-neutral-500 uppercase font-black mb-1 group-hover:text-white">
                Datum
              </span>
              <span
                className={
                  selectedDate ? "text-white font-bold" : "text-neutral-400"
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
            <CalendarIcon className="w-6 h-6 text-neutral-500 group-hover:text-white" />
          </button>

          <div className="w-full bg-neutral-900 border border-neutral-800 p-5 flex items-center justify-between rounded-2xl">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-neutral-500 uppercase font-black mb-1">
                Vreme
              </span>
              <span
                className={
                  selectedTime ? "text-white font-bold" : "text-neutral-400"
                }
              >
                {selectedTime || "Izaberi vreme nakon datuma"}
              </span>
            </div>
            <Clock className="w-6 h-6 text-neutral-500" />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedTime}
            className="w-full py-6 bg-white text-black font-black text-xl hover:bg-neutral-200 transition-all active:scale-[0.98] rounded-2xl shadow-xl mt-10 uppercase tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Slanje..." : "Potvrdi Termin"}
          </button>
        </form>
      </div>
    </section>
  );
}
