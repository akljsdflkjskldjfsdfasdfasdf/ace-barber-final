// Jedina lista frizera — koristi je i javni booking i admin dashboard.
// Redosled u nizu = redosled prikaza (Petar je šef, stoji u sredini).
// VAŽNO: id-jevi ("barber-1"...) su upisani u postojeće rezervacije u PocketBase
// i u `barber_id` polje na user nalozima — NE menjati ih, menjaj samo imena.
export interface Barber {
  id: string;
  name: string;
  role: string;
  img: string;
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
];

// Šef — podrazumevano izabran u rezervaciji
export const DEFAULT_BARBER =
  BARBERS.find((b) => b.id === "barber-3") || BARBERS[0];

export function barberName(id?: string) {
  return BARBERS.find((b) => b.id === id)?.name || id || "—";
}
