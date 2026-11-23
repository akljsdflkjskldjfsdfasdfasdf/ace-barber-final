import { pb } from "./pocketbase";

// Jedina lista frizera — koristi je i javni booking i admin dashboard.
// Redosled u nizu = redosled prikaza.
// VAŽNO: id-jevi ("barber-1"...) su upisani u postojeće rezervacije u PocketBase
// i u `barber_id` polje na user nalozima — NE menjati ih, menjaj samo imena.
export interface Barber {
  id: string;
  name: string;
  role: string;
  img: string;
  // Frizer-zamena: radi SAMO u terminima koje je ovaj frizer blokirao.
  // Gde taj frizer NIJE blokirao termin, zamena je automatski zauzeta.
  coversFor?: string;
}

export const BARBERS: Barber[] = [
  {
    id: "barber-1",
    name: "Marić",
    role: "Barber",
    img: "/slike/slika%20barbera%201.jpeg",
  },
  {
    id: "barber-3",
    name: "Petar",
    role: "Owner",
    img: "/slike/slika%20barbera%203.jpeg",
  },
  {
    id: "barber-2",
    name: "Nanić",
    role: "Barber",
    img: "/slike/slika%20barbera%202.jpeg",
  },
  {
    // Gavrilo menja Marića: Marić blokira termin → Gavrilo ga ima.
    id: "barber-4",
    name: "Gavrilo",
    role: "Barber",
    img: "/slike/slika%20barbera%204.jpeg",
    coversFor: "barber-1",
  },
];

// Šef — podrazumevano izabran u rezervaciji
export const DEFAULT_BARBER =
  BARBERS.find((b) => b.id === "barber-3") || BARBERS[0];

// Broj stolica u studiju: zamena sedi na stolici frizera koga menja,
// pa se ne računa kao dodatni kapacitet (statistika popunjenosti).
export const CHAIR_COUNT = BARBERS.filter((b) => !b.coversFor).length;

export function barberName(id?: string) {
  return BARBERS.find((b) => b.id === id)?.name || id || "—";
}

// Zauzeti termini jednog frizera za jedan dan — JEDINO mesto gde se to
// računa (javni booking + admin blokiranje / ručna rezervacija / odmor).
//  • obični frizer: njegovi zakazani + blokirani termini
//  • zamena (Gavrilo): isto to, PLUS svaki termin u kom frizer koga menja
//    (Marić) NIJE blokiran — tamo radi Marić, pa Gavrilo nema termin.
// `slots` = svi termini dana; potreban samo da bi se zameni zatvorilo
// sve što nije otvoreno Marićevom blokadom.
export async function fetchTakenSlots(
  date: string,
  barberId: string,
  slots: string[],
): Promise<Set<string>> {
  const own = await pb.collection("appointments").getFullList({
    filter: `appointment_date = "${date}" && barber = "${barberId}" && (status = "booked" || status = "blocked")`,
    fields: "appointment_time",
  });
  const taken = new Set<string>(own.map((r: any) => r.appointment_time));

  const host = BARBERS.find((b) => b.id === barberId)?.coversFor;
  if (host) {
    const hostBlocks = await pb.collection("appointments").getFullList({
      filter: `appointment_date = "${date}" && barber = "${host}" && status = "blocked"`,
      fields: "appointment_time",
    });
    const open = new Set<string>(hostBlocks.map((r: any) => r.appointment_time));
    for (const t of slots) if (!open.has(t)) taken.add(t);
  }
  return taken;
}
