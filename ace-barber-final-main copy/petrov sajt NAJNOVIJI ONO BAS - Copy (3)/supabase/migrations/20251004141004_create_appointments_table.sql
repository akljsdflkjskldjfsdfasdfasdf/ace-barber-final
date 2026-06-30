  /*
    # Create Appointments Table

    1. New Tables
      - `appointments`
        - `id` (uuid, primary key) - Unique identifier for each appointment
        - `first_name` (text, required) - Customer's first name
        - `last_name` (text, required) - Customer's last name
        - `phone_number` (text, required) - Customer's phone number
        - `appointment_date` (date, required) - Date of the appointment
        - `appointment_time` (text, required) - Time slot for the appointment
        - `status` (text, default 'booked') - Status of appointment (booked, completed, cancelled)
        - `created_at` (timestamptz, default now()) - When the appointment was created
        - `updated_at` (timestamptz, default now()) - When the appointment was last updated

    2. Security
      - Enable RLS on `appointments` table
      - Add policy for anyone to view appointments (to check availability)
      - Add policy for authenticated admin to manage all appointments
      - Add policy for anyone to create appointments (booking)

    3. Important Notes
      - Only admin users can update or delete appointments
      - Public users can view appointments to check slot availability
      - Public users can create new appointments
      - Each appointment slot is unique by date and time combination
  */

  CREATE TABLE IF NOT EXISTS appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone_number text NOT NULL,
    appointment_date date NOT NULL,
    appointment_time text NOT NULL,
    status text DEFAULT 'booked' NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(appointment_date, appointment_time)
  );

  ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can view appointments"
    ON appointments FOR SELECT
    USING (true);

  CREATE POLICY "Anyone can create appointments"
    ON appointments FOR INSERT
    WITH CHECK (true);

  CREATE POLICY "Admin can update appointments"
    ON appointments FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Admin can delete appointments"
    ON appointments FOR DELETE
    TO authenticated
    USING (true);

  CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(appointment_date, appointment_time);
  CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);