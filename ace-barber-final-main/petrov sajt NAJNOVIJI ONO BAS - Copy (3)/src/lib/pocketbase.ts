import PocketBase from 'pocketbase';
import { Capacitor } from '@capacitor/core';

// Pun URL servera — koristi ga SAMO mobilna aplikacija.
export const API_ORIGIN = 'https://ace-barberstudio.online';

// U nativnoj aplikaciji WebView je na "https://localhost", pa "isti origin"
// ne postoji i relativna putanja bi gađala samu aplikaciju. Zato pun URL.
// Sam CORS se ne postavlja pitanje: CapacitorHttp (uključen u
// capacitor.config.ts) šalje zahteve nativno, mimo browser CORS provere.
export const isNativeApp = Capacitor.isNativePlatform();

// Prazno / "/" = isti origin.
//  • U produkciji: front i PocketBase su na istom domenu → radi direktno.
//  • U dev-u: Vite proxy ('/api' u vite.config.ts) prosleđuje na server → nema CORS-a.
const POCKETBASE_URL = isNativeApp
  ? API_ORIGIN
  : import.meta.env.VITE_POCKETBASE_URL || '/';

export const pb = new PocketBase(POCKETBASE_URL);

export interface Appointment {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  user_email: string;
  barber?: string;
  barber_name?: string;
  // Popunjeno samo kod fiksnih (ponavljajućih) termina — povezuje sve
  // nedeljne zapise jedne serije, da bi mogla da se otkaže odjednom.
  recurring_id?: string;
  created: string;
  updated: string;
}
