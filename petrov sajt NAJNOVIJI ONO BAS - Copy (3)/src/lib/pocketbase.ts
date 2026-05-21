import PocketBase from 'pocketbase';

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);

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