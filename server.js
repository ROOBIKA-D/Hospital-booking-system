require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 8080;

// Supabase Client Setup
const SUPABASE_URL = process.env.SUPABASE_URL || "https://uxvvjpkuewvakcvllmpi.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
    console.warn("⚠️ Warning: No Supabase API key found in .env.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Master Doctor & Department Directory
const DOCTOR_DIRECTORY = {
    "General Medicine": [
        { name: "Dr. Anand Rao", room: "Room 101", qualification: "MBBS, MD (General Medicine)", fee: "₹500" },
        { name: "Dr. Meera Nair", room: "Room 102", qualification: "MBBS, DNB", fee: "₹500" }
    ],
    "Cardiology": [
        { name: "Dr. Suresh Iyer", room: "Room 201", qualification: "MD, DM (Cardiology)", fee: "₹800" },
        { name: "Dr. Fatima Khan", room: "Room 202", qualification: "MBBS, MD, FACC", fee: "₹800" }
    ],
    "Orthopedics": [
        { name: "Dr. Vikram Sethi", room: "Room 301", qualification: "MS (Orthopedics), M.Ch", fee: "₹700" }
    ],
    "Pediatrics": [
        { name: "Dr. Leena Joseph", room: "Room 401", qualification: "MD (Pediatrics)", fee: "₹600" },
        { name: "Dr. Rahul Menon", room: "Room 402", qualification: "DCH, DNB (Pediatrics)", fee: "₹600" }
    ],
    "Dermatology": [
        { name: "Dr. Priya Das", room: "Room 501", qualification: "MD (Dermatology, Venereology)", fee: "₹650" }
    ]
};

// Standard Consult Consultation Time Slots (09:00 to 18:00, lunch break 13:00 - 14:00)
const STANDARD_SLOTS = [
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30"
];

// Helper: Escape HTML characters
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper: Format 24-hr time to 12-hr display (e.g. 09:30 -> 09:30 AM)
function formatTime12(timeStr) {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const adjustedHours = hours % 12 || 12;
    return `${String(adjustedHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Helper: Lookup doctor details
function getDoctorInfo(doctorName) {
    for (const [dept, list] of Object.entries(DOCTOR_DIRECTORY)) {
        const found = list.find(d => d.name.toLowerCase() === (doctorName || "").toLowerCase());
        if (found) return { ...found, department: dept };
    }
    return { name: doctorName, room: "OPD Desk", qualification: "Consultant Specialist", fee: "₹500", department: "General" };
}

// Helper: Compute daily token and reference code for an appointment
async function computeTokenNumber(doctor, date) {
    try {
        const { count, error } = await supabase
            .from("appointments")
            .select("*", { count: "exact", head: true })
            .eq("doctor", doctor)
            .eq("appointment_date", date);

        if (error) return { token: 1, refCode: `HSP-${date.replace(/-/g, "")}-001` };
        const token = (count || 0) + 1;
        const refCode = `HSP-${date.replace(/-/g, "")}-${String(token).padStart(3, "0")}`;
        return { token, refCode };
    } catch {
        return { token: 1, refCode: `HSP-${date.replace(/-/g, "")}-001` };
    }
}

// Helper: Check for appointment time conflict
async function checkTimeSlotConflict(doctor, date, time, excludeId = null) {
    let query = supabase
        .from("appointments")
        .select("id, patient_name, appointment_time, status")
        .eq("doctor", doctor)
        .eq("appointment_date", date)
        .eq("appointment_time", time)
        .neq("status", "Cancelled");

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Conflict check error:", error);
        return false;
    }
    return data && data.length > 0;
}

// Helper: Validate appointment input data
function validateAppointmentData(data) {
    const errors = [];

    const name = (data.name || data.patient_name || "").trim();
    const email = (data.email || "").trim();
    const phone = (data.phone || "").trim();
    const age = String(data.age || "").trim();
    const gender = (data.gender || "").trim();
    const department = (data.department || "").trim();
    const doctor = (data.doctor || "").trim();
    const date = (data.date || data.appointment_date || "").trim();
    let time = (data.time || data.appointment_time || "").trim();
    const reason = (data.reason || "").trim();

    // 1. Name
    if (!name) {
        errors.push("Patient name is required");
    } else if (!/^[A-Za-z ]{3,50}$/.test(name)) {
        errors.push("Patient name must contain only letters and spaces (3 to 50 characters)");
    }

    // 2. Email
    if (!email) {
        errors.push("Email address is required");
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        errors.push("Please provide a valid email address");
    }

    // 3. Mobile phone
    if (!phone) {
        errors.push("Mobile number is required");
    } else if (!/^[0-9]{10}$/.test(phone)) {
        errors.push("Mobile number must be exactly 10 digits");
    }

    // 4. Age
    if (!age || isNaN(age)) {
        errors.push("Age must be a valid number");
    } else {
        const numAge = parseInt(age, 10);
        if (numAge < 1 || numAge > 120) {
            errors.push("Age must be between 1 and 120");
        }
    }

    // 5. Gender
    if (!gender) {
        errors.push("Gender selection is required");
    }

    // 6. Department
    if (!department) {
        errors.push("Department selection is required");
    }

    // 7. Doctor
    if (!doctor) {
        errors.push("Doctor selection is required");
    }

    // 8. Appointment Date
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        errors.push("Appointment date format must be YYYY-MM-DD");
    } else {
        const selectedDate = new Date(date + "T00:00:00");
        if (isNaN(selectedDate.getTime())) {
            errors.push("Invalid appointment date");
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                errors.push("Appointment date cannot be in the past");
            } else if (selectedDate.getDay() === 0) {
                errors.push("Hospital is closed on Sundays");
            }
        }
    }

    // 9. Appointment Time
    if (!time) {
        errors.push("Appointment time is required");
    } else {
        const normalized = time.slice(0, 5);
        if (!/^[0-9]{2}:[0-9]{2}$/.test(normalized)) {
            errors.push("Appointment time format must be HH:MM");
        } else if (normalized < "09:00" || normalized > "18:00") {
            errors.push("Hospital timings are between 09:00 and 18:00");
        }
    }

    // Normalize time to HH:MM:00 for database storage
    const normalizedTime = time.length === 5 ? `${time}:00` : time;

    // 10. Reason
    if (reason.length > 300) {
        errors.push("Reason for visit should not exceed 300 characters");
    }

    return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
            patient_name: name,
            email,
            phone,
            age: parseInt(age, 10) || 0,
            gender,
            department,
            doctor,
            appointment_date: date,
            appointment_time: normalizedTime,
            reason
        }
    };
}

// Generate styled HTML response page for standard form submissions
function makePage(title, isSuccess, heading, bodyContent) {
    const bannerColor = isSuccess ? "#0b6e99" : "#d9534f";
    const statusIcon = isSuccess ? "&#10004;" : "&#9888;";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - Hospital Booking System</title>
    <link rel="stylesheet" href="style.css">
    <style>
        .result-card {
            background: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            overflow: hidden;
            margin-top: 10px;
        }
        .result-header {
            background-color: ${bannerColor};
            color: #ffffff;
            padding: 22px;
            text-align: center;
        }
        .result-header h2 {
            margin: 0;
            color: #ffffff;
            border: none;
            padding: 0;
            font-size: 24px;
        }
        .result-body {
            padding: 25px 30px;
        }
        .token-badge-large {
            display: inline-block;
            background: #e0f2fe;
            border: 2px dashed #0284c7;
            color: #0369a1;
            padding: 10px 22px;
            border-radius: 8px;
            font-size: 20px;
            font-weight: 700;
            margin: 15px auto;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 9px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14.5px;
        }
        .info-label {
            font-weight: 600;
            color: #475569;
        }
        .info-val {
            color: #0f172a;
            font-weight: 500;
        }
        .action-links {
            margin-top: 25px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
        }
        .btn-link {
            display: inline-block;
            background-color: #0b6e99;
            color: #ffffff;
            text-decoration: none;
            padding: 10px 18px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
        }
        .btn-link:hover {
            background-color: #084d6b;
        }
        .btn-secondary {
            background-color: #64748b;
        }
        .btn-secondary:hover {
            background-color: #475569;
        }
        .error-list {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 15px 20px;
            color: #c53030;
            margin-bottom: 20px;
        }
        .error-list li {
            margin-bottom: 6px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <h1>Hospital Appointment Booking System</h1>
            <div class="nav-links">
                <a href="index.html" class="nav-item">Book Appointment</a>
                <a href="lookup.html" class="nav-item">My Appointments</a>
                <a href="appointments.html" class="nav-item">Dashboard</a>
            </div>
        </div>
    </div>
    <div class="container">
        <div class="result-card">
            <div class="result-header">
                <h2>${statusIcon} ${escapeHtml(heading)}</h2>
            </div>
            <div class="result-body">
                ${bodyContent}
            </div>
        </div>
    </div>
</body>
</html>`;
}

// ====================================================
// 1. Core Booking Handler (HTML Form POST)
// ====================================================
app.post("/BookingServlet", async function (req, res) {
    const validation = validateAppointmentData(req.body);

    if (!validation.isValid) {
        const errorList = `<div class="error-list">
            <p><strong>Please correct the following errors:</strong></p>
            <ul>${validation.errors.map(err => `<li>${escapeHtml(err)}</li>`).join("")}</ul>
        </div>
        <div class="action-links">
            <a href="index.html" class="btn-link">&larr; Return to Form</a>
        </div>`;
        return res.status(400).send(makePage("Booking Failed", false, "Appointment Not Booked", errorList));
    }

    const { sanitized } = validation;

    try {
        // Double-Booking & Conflict Detection
        const isConflict = await checkTimeSlotConflict(
            sanitized.doctor,
            sanitized.appointment_date,
            sanitized.appointment_time
        );

        if (isConflict) {
            const conflictContent = `<div class="error-list">
                <p><strong>Time Slot Unavailable:</strong></p>
                <p>${escapeHtml(sanitized.doctor)} already has an appointment booked at 
                   <strong>${escapeHtml(formatTime12(sanitized.appointment_time))}</strong> on 
                   <strong>${escapeHtml(sanitized.appointment_date)}</strong>.</p>
                <p>Please select another available time slot or doctor.</p>
            </div>
            <div class="action-links">
                <a href="index.html" class="btn-link">&larr; Choose Another Slot</a>
            </div>`;
            return res.status(409).send(makePage("Slot Unavailable", false, "Slot Already Booked", conflictContent));
        }

        // Calculate sequential daily token number
        const { token, refCode } = await computeTokenNumber(sanitized.doctor, sanitized.appointment_date);
        const docInfo = getDoctorInfo(sanitized.doctor);

        // Insert into Supabase
        const { data, error } = await supabase
            .from("appointments")
            .insert([{
                ...sanitized,
                status: "Confirmed"
            }])
            .select();

        if (error) {
            console.error("Supabase insert error:", error);
            const errorMsg = `<div class="error-list">
                <p><strong>Database Error:</strong> Could not save appointment to database.</p>
                <p>${escapeHtml(error.message)}</p>
            </div>
            <div class="action-links">
                <a href="index.html" class="btn-link">&larr; Return to Form</a>
            </div>`;
            return res.status(500).send(makePage("Booking Error", false, "System Error", errorMsg));
        }

        const booked = data[0];

        const successContent = `
            <div style="text-align: center;">
                <p style="color: #16a34a; font-size: 16px; font-weight: 600; margin: 0 0 10px;">
                    Appointment Successfully Confirmed!
                </p>
                <div class="token-badge-large">
                    Queue Token #${token}
                </div>
                <p style="color: #64748b; font-size: 13px; margin: 0 0 20px;">
                    Booking Reference ID: <strong>${booked.id}</strong>
                </p>
            </div>

            <div class="info-row"><span class="info-label">Patient Name:</span><span class="info-val">${escapeHtml(sanitized.patient_name)}</span></div>
            <div class="info-row"><span class="info-label">Doctor & Room:</span><span class="info-val">${escapeHtml(sanitized.doctor)} (${docInfo.room})</span></div>
            <div class="info-row"><span class="info-label">Department:</span><span class="info-val">${escapeHtml(sanitized.department)}</span></div>
            <div class="info-row"><span class="info-label">Appointment Date:</span><span class="info-val">${escapeHtml(sanitized.appointment_date)}</span></div>
            <div class="info-row"><span class="info-label">Appointment Time:</span><span class="info-val">${escapeHtml(formatTime12(sanitized.appointment_time))}</span></div>
            <div class="info-row"><span class="info-label">Consultation Fee:</span><span class="info-val">${docInfo.fee}</span></div>
            <div class="info-row"><span class="info-label">Mobile Number:</span><span class="info-val">${escapeHtml(sanitized.phone)}</span></div>
            <div class="info-row"><span class="info-label">Status:</span><span class="info-val" style="color:#0284c7; font-weight:700;">Confirmed</span></div>

            <div class="action-links">
                <a href="/api/appointments/${booked.id}/slip" target="_blank" class="btn-link">Print / Download Pass</a>
                <a href="lookup.html" class="btn-link btn-secondary">My Appointments</a>
                <a href="index.html" class="btn-link btn-secondary">Book Another</a>
            </div>
        `;

        res.send(makePage("Booking Confirmed", true, "Appointment Confirmed", successContent));
    } catch (err) {
        console.error("Booking error:", err);
        res.status(500).send(makePage("Error", false, "Server Error", `<p>${escapeHtml(err.message)}</p>`));
    }
});

// ====================================================
// 2. Dynamic Available Slots API
// ====================================================
app.get("/api/available-slots", async (req, res) => {
    try {
        const { doctor, date } = req.query;

        if (!doctor || !date) {
            return res.status(400).json({ success: false, message: "Doctor and date query parameters are required" });
        }

        // Query active appointments for this doctor on this date
        const { data: booked, error } = await supabase
            .from("appointments")
            .select("appointment_time")
            .eq("doctor", doctor)
            .eq("appointment_date", date)
            .neq("status", "Cancelled");

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        const bookedTimes = new Set((booked || []).map(b => b.appointment_time.slice(0, 5)));

        const slots = STANDARD_SLOTS.map(slot => ({
            time: slot,
            display: formatTime12(slot),
            isAvailable: !bookedTimes.has(slot)
        }));

        res.json({
            success: true,
            doctor,
            date,
            totalSlots: slots.length,
            availableSlotsCount: slots.filter(s => s.isAvailable).length,
            slots
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 3. Doctors Catalog API
// ====================================================
app.get("/api/doctors", (req, res) => {
    res.json({
        success: true,
        directory: DOCTOR_DIRECTORY,
        allDoctors: Object.values(DOCTOR_DIRECTORY).flat()
    });
});

// ====================================================
// 4. Appointments Search & List API
// ====================================================
app.get("/api/appointments", async (req, res) => {
    try {
        const { search, department, doctor, date, status } = req.query;

        let query = supabase
            .from("appointments")
            .select("*")
            .order("appointment_date", { ascending: false })
            .order("appointment_time", { ascending: true });

        if (department) query = query.eq("department", department);
        if (doctor) query = query.eq("doctor", doctor);
        if (date) query = query.eq("appointment_date", date);
        if (status) query = query.eq("status", status);
        if (search) {
            query = query.or(`patient_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,doctor.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, count: data.length, appointments: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 5. Patient Lookup API (Self-Service)
// ====================================================
app.get("/api/appointments/lookup", async (req, res) => {
    try {
        const { query: searchQuery } = req.query;

        if (!searchQuery || searchQuery.trim().length === 0) {
            return res.status(400).json({ success: false, message: "Search query (phone, email, or ID) is required" });
        }

        const trimmed = searchQuery.trim();

        // Check if query is a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

        let query = supabase.from("appointments").select("*").order("appointment_date", { ascending: false });

        if (isUuid) {
            query = query.eq("id", trimmed);
        } else {
            query = query.or(`phone.eq.${trimmed},email.ilike.${trimmed},patient_name.ilike.%${trimmed}%`);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, count: data.length, appointments: data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 6. Single Appointment Details API
// ====================================================
app.get("/api/appointments/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from("appointments")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        const docInfo = getDoctorInfo(data.doctor);
        res.json({ success: true, appointment: { ...data, doctorInfo: docInfo } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 7. Reschedule Appointment API
// ====================================================
app.patch("/api/appointments/:id/reschedule", async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time } = req.body;

        if (!date || !time) {
            return res.status(400).json({ success: false, message: "New date and time are required" });
        }

        // Validate date
        const selectedDate = new Date(date + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            return res.status(400).json({ success: false, message: "Cannot reschedule to a past date" });
        }
        if (selectedDate.getDay() === 0) {
            return res.status(400).json({ success: false, message: "Hospital is closed on Sundays" });
        }

        // Normalize time
        const normalizedTime = time.length === 5 ? `${time}:00` : time;

        // Fetch current appointment
        const { data: current, error: fetchErr } = await supabase
            .from("appointments")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchErr || !current) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        // Check conflict for the doctor at new date & time
        const isConflict = await checkTimeSlotConflict(current.doctor, date, normalizedTime, id);
        if (isConflict) {
            return res.status(409).json({
                success: false,
                message: `${current.doctor} is already booked at ${formatTime12(normalizedTime)} on ${date}.`
            });
        }

        // Update appointment
        const { data, error } = await supabase
            .from("appointments")
            .update({
                appointment_date: date,
                appointment_time: normalizedTime,
                status: "Confirmed"
            })
            .eq("id", id)
            .select();

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({
            success: true,
            message: "Appointment rescheduled successfully",
            appointment: data[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 8. Cancel Appointment API
// ====================================================
app.patch("/api/appointments/:id/cancel", async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from("appointments")
            .update({ status: "Cancelled" })
            .eq("id", id)
            .select();

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, message: "Appointment cancelled successfully", appointment: data[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 9. Status Update API (Admin)
// ====================================================
app.patch("/api/appointments/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ["Confirmed", "Completed", "Cancelled"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(", ")}` });
        }

        const { data, error } = await supabase
            .from("appointments")
            .update({ status })
            .eq("id", id)
            .select();

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        res.json({ success: true, message: "Status updated successfully", appointment: data[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 10. Printable Appointment Slip Pass Generator
// ====================================================
app.get("/api/appointments/:id/slip", async (req, res) => {
    try {
        const { id } = req.params;
        const { data: apt, error } = await supabase
            .from("appointments")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !apt) {
            return res.status(404).send("Appointment not found");
        }

        const docInfo = getDoctorInfo(apt.doctor);
        const formattedTime = formatTime12(apt.appointment_time);

        const slipHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Slip - ${escapeHtml(apt.patient_name)}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f1f5f9;
            margin: 0;
            padding: 30px 15px;
            color: #1e293b;
        }
        .slip-box {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border: 2px solid #0b6e99;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .hospital-header {
            text-align: center;
            border-bottom: 2px solid #0b6e99;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }
        .hospital-header h1 {
            margin: 0;
            color: #0b6e99;
            font-size: 24px;
        }
        .hospital-header p {
            margin: 4px 0 0;
            font-size: 13px;
            color: #64748b;
        }
        .token-callout {
            background: #e0f2fe;
            border: 2px dashed #0284c7;
            text-align: center;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .token-callout .label {
            font-size: 12px;
            color: #0369a1;
            font-weight: 600;
            text-transform: uppercase;
        }
        .token-callout .token-val {
            font-size: 24px;
            font-weight: 800;
            color: #0369a1;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px 20px;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .item-label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
        }
        .item-val {
            font-size: 15px;
            color: #0f172a;
            font-weight: 600;
        }
        .notes-box {
            background: #f8fafc;
            border-left: 4px solid #0b6e99;
            padding: 12px 16px;
            border-radius: 4px;
            font-size: 13px;
            color: #475569;
            margin-bottom: 24px;
        }
        .barcode-strip {
            text-align: center;
            font-family: monospace;
            letter-spacing: 4px;
            font-size: 16px;
            background: #f1f5f9;
            padding: 8px;
            border-radius: 4px;
            color: #334155;
            margin-bottom: 20px;
        }
        .btn-print {
            background: #0b6e99;
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            display: block;
            margin: 0 auto;
        }
        @media print {
            body { background: #ffffff; padding: 0; }
            .slip-box { box-shadow: none; border: 1px solid #000000; }
            .btn-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="slip-box">
        <div class="hospital-header">
            <h1>CITY GENERAL HOSPITAL</h1>
            <p>124 Healthcare Avenue, Medical District &bull; Phone: (044) 2345-6789</p>
            <p><strong>OFFICIAL APPOINTMENT PASS</strong></p>
        </div>

        <div class="token-callout">
            <div class="label">Consultation Pass ID</div>
            <div class="token-val">${apt.id.slice(0, 8).toUpperCase()}</div>
        </div>

        <div class="info-grid">
            <div>
                <div class="item-label">Patient Name</div>
                <div class="item-val">${escapeHtml(apt.patient_name)}</div>
            </div>
            <div>
                <div class="item-label">Age / Gender</div>
                <div class="item-val">${escapeHtml(apt.age)} yrs / ${escapeHtml(apt.gender)}</div>
            </div>
            <div>
                <div class="item-label">Doctor</div>
                <div class="item-val">${escapeHtml(apt.doctor)}</div>
            </div>
            <div>
                <div class="item-label">Consultation Room</div>
                <div class="item-val">${escapeHtml(docInfo.room)}</div>
            </div>
            <div>
                <div class="item-label">Department</div>
                <div class="item-val">${escapeHtml(apt.department)}</div>
            </div>
            <div>
                <div class="item-label">Consultation Fee</div>
                <div class="item-val">${escapeHtml(docInfo.fee)}</div>
            </div>
            <div>
                <div class="item-label">Appointment Date</div>
                <div class="item-val">${escapeHtml(apt.appointment_date)}</div>
            </div>
            <div>
                <div class="item-label">Appointment Time</div>
                <div class="item-val">${escapeHtml(formattedTime)}</div>
            </div>
            <div>
                <div class="item-label">Mobile Number</div>
                <div class="item-val">${escapeHtml(apt.phone)}</div>
            </div>
            <div>
                <div class="item-label">Current Status</div>
                <div class="item-val" style="color: #0284c7;">${escapeHtml(apt.status)}</div>
            </div>
        </div>

        ${apt.reason ? `
        <div style="margin-bottom: 16px;">
            <div class="item-label">Reason for Visit</div>
            <div style="font-size: 14px; color: #334155; margin-top: 4px;">${escapeHtml(apt.reason)}</div>
        </div>` : ""}

        <div class="notes-box">
            <strong>Instructions for Patient:</strong><br>
            &bull; Please arrive at <strong>${escapeHtml(docInfo.room)}</strong> at least 15 minutes prior to your time.<br>
            &bull; Present this slip at the reception desk for token verification.<br>
            &bull; Bring previous prescription or test reports if applicable.
        </div>

        <div class="barcode-strip">
            ||| | |||| | ||||| | ||| |||| | ${apt.id.slice(0, 8).toUpperCase()}
        </div>

        <button onclick="window.print()" class="btn-print">Print / Save as PDF</button>
    </div>
</body>
</html>`;

        res.send(slipHtml);
    } catch (err) {
        res.status(500).send("Error generating appointment slip: " + err.message);
    }
});

// ====================================================
// 11. Admin Statistics & Analytics API
// ====================================================
app.get("/api/admin/stats", async (req, res) => {
    try {
        const { data, error } = await supabase.from("appointments").select("*");

        if (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

        const total = data.length;
        const todayStr = new Date().toISOString().split("T")[0];

        const todayAppointments = data.filter(a => a.appointment_date === todayStr);
        const confirmed = data.filter(a => a.status === "Confirmed").length;
        const completed = data.filter(a => a.status === "Completed").length;
        const cancelled = data.filter(a => a.status === "Cancelled").length;

        // Department breakdown
        const departmentCounts = {};
        const doctorCounts = {};

        data.forEach(a => {
            departmentCounts[a.department] = (departmentCounts[a.department] || 0) + 1;
            doctorCounts[a.doctor] = (doctorCounts[a.doctor] || 0) + 1;
        });

        res.json({
            success: true,
            total,
            todayCount: todayAppointments.length,
            confirmed,
            completed,
            cancelled,
            departmentBreakdown: departmentCounts,
            doctorWorkload: doctorCounts
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ====================================================
// 12. CSV Export API
// ====================================================
app.get("/api/appointments/export", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("appointments")
            .select("*")
            .order("appointment_date", { ascending: false });

        if (error) {
            return res.status(500).send("Error exporting data: " + error.message);
        }

        const headers = ["ID", "Patient Name", "Email", "Phone", "Age", "Gender", "Department", "Doctor", "Date", "Time", "Status", "Reason", "Created At"];

        const csvRows = [headers.join(",")];

        (data || []).forEach(row => {
            const values = [
                `"${row.id}"`,
                `"${(row.patient_name || "").replace(/"/g, '""')}"`,
                `"${(row.email || "").replace(/"/g, '""')}"`,
                `"${row.phone || ""}"`,
                row.age || "",
                `"${row.gender || ""}"`,
                `"${row.department || ""}"`,
                `"${(row.doctor || "").replace(/"/g, '""')}"`,
                `"${row.appointment_date || ""}"`,
                `"${row.appointment_time || ""}"`,
                `"${row.status || ""}"`,
                `"${(row.reason || "").replace(/"/g, '""').replace(/\n/g, " ")}"`,
                `"${row.created_at || ""}"`
            ];
            csvRows.push(values.join(","));
        });

        const csvString = csvRows.join("\n");
        const filename = `appointments_${new Date().toISOString().split("T")[0]}.csv`;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.status(200).send(csvString);
    } catch (err) {
        res.status(500).send("Server export error: " + err.message);
    }
});

// ====================================================
// 13. Health & Connectivity Diagnostics API
// ====================================================
app.get("/api/health", async (req, res) => {
    try {
        const { count, error } = await supabase
            .from("appointments")
            .select("*", { count: "exact", head: true });

        if (error) {
            return res.status(503).json({
                status: "degraded",
                database: "error",
                message: error.message
            });
        }

        res.json({
            status: "healthy",
            database: "connected",
            totalAppointmentsInDb: count,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🏥 Hospital Appointment Booking System Active!`);
    console.log(`======================================================`);
    console.log(`- Patient Booking:   http://localhost:${PORT}`);
    console.log(`- Patient Portal:    http://localhost:${PORT}/lookup.html`);
    console.log(`- Admin Dashboard:   http://localhost:${PORT}/appointments.html`);
    console.log(`- Health Check:      http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
});
