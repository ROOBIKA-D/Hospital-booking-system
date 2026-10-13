# Hospital Appointment Booking System 🏥

A full-stack Hospital Appointment Booking & Management application powered by **Node.js**, **Express**, and **Supabase (PostgreSQL)**.

---

## 🌟 Key Features

### 1. Patient Appointment Booking
- Interactive booking form with real-time validation (name, email, 10-digit mobile, age, gender, department, doctor, date, time slot, reason).
- **Conflict Detection & Double-Booking Prevention:** Checks doctor availability in real time; blocks overlapping appointments and notifies the patient.
- **Dynamic Slot Availability:** Generates consultation slots between 09:00 and 18:00 (with lunch break) and marks booked slots as unavailable.
- **Queue Tokens:** Computes sequential daily token numbers per doctor for orderly consultations.

### 2. Patient Self-Service Portal (`lookup.html`)
- Track bookings by 10-digit mobile number or Appointment ID.
- **1-Click Rescheduling:** Change appointment date and time slot with live conflict check.
- **Appointment Cancellation:** Cancel appointments with automatic slot release.
- **Digital Consultation Slip:** Print or save official hospital appointment pass with barcode and room instructions.

### 3. Operations & Staff Dashboard (`appointments.html`)
- **Real-Time KPIs:** Live metric cards for total bookings, today's schedule, confirmed, completed, and cancelled counts.
- **Search & Filters:** Instant search by patient name, contact, doctor, department, date, or status.
- **Status Updates:** Mark appointments as Completed or Cancelled.
- **CSV Data Export:** 1-click download of all records for hospital administration and reporting.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18+)
- Supabase project credentials

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```env
PORT=8080
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Supabase SQL Setup
Run the following table schema in your **Supabase Dashboard &rarr; SQL Editor**:
```sql
create table if not exists appointments (
  id uuid default gen_random_uuid() primary key,
  patient_name text not null,
  email text not null,
  phone text not null,
  age int not null,
  gender text not null,
  department text not null,
  doctor text not null,
  appointment_date date not null,
  appointment_time time not null,
  reason text,
  status text default 'Confirmed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 5. Run the Server
```bash
npm start
```
Then visit:
- **Booking Form:** `http://localhost:8080`
- **Patient Portal:** `http://localhost:8080/lookup.html`
- **Staff Dashboard:** `http://localhost:8080/appointments.html`
- **Health Diagnostics:** `http://localhost:8080/api/health`

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/BookingServlet` | `POST` | Traditional HTML form submission with validation and conflict checks |
| `/api/appointments` | `GET` | List appointments with filters (`search`, `department`, `doctor`, `date`, `status`) |
| `/api/appointments` | `POST` | Create a new appointment (JSON API) |
| `/api/appointments/:id` | `GET` | Fetch single appointment details |
| `/api/appointments/:id/reschedule` | `PATCH` | Reschedule appointment date and time |
| `/api/appointments/:id/cancel` | `PATCH` | Cancel appointment |
| `/api/appointments/:id/status` | `PATCH` | Update status (`Confirmed`, `Completed`, `Cancelled`) |
| `/api/appointments/:id/slip` | `GET` | Generate printable digital appointment pass |
| `/api/appointments/lookup` | `GET` | Search appointments by phone number or ID |
| `/api/available-slots` | `GET` | Returns available consultation time slots for doctor on a given date |
| `/api/doctors` | `GET` | Master directory of departments and doctors |
| `/api/admin/stats` | `GET` | Live analytics, status counts, department and doctor breakdown |
| `/api/appointments/export` | `GET` | Download appointments as a CSV file |
| `/api/health` | `GET` | Server health and database connectivity diagnostics |

---

## 📁 Project Structure

```
├── .env.example        # Environment variable template
├── .gitignore          # Git ignore (safely excludes .env and node_modules)
├── appointments.html   # Operations & Admin Dashboard
├── index.html          # Patient Booking Form
├── lookup.html         # Patient Self-Service Portal
├── package.json        # Dependencies & scripts
├── README.md           # Documentation
├── script.js           # Client-side validation & slot selector
├── server.js           # Express backend & Supabase integration
└── style.css           # Styling system & responsive UI
```
