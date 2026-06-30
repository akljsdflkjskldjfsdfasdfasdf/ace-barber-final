import PocketBase from 'pocketbase';

// Prazno / "/" = isti origin.
//  • U produkciji: front i PocketBase su na istom domenu → radi direktno.
//  • U dev-u: Vite proxy ('/api' u vite.config.ts) prosleđuje na server → nema CORS-a.
const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || '/';

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
  created: string;
  updated: string;
}