// Hospital Appointment Booking System
// Client-side form logic, live slot checks, and validation

// Doctor master directory with room and consultation fee
var doctorDirectory = {
    "General Medicine": [
        { name: "Dr. Anand Rao", room: "Room 101", fee: "₹500" },
        { name: "Dr. Meera Nair", room: "Room 102", fee: "₹500" }
    ],
    "Cardiology": [
        { name: "Dr. Suresh Iyer", room: "Room 201", fee: "₹800" },
        { name: "Dr. Fatima Khan", room: "Room 202", fee: "₹800" }
    ],
    "Orthopedics": [
        { name: "Dr. Vikram Sethi", room: "Room 301", fee: "₹700" }
    ],
    "Pediatrics": [
        { name: "Dr. Leena Joseph", room: "Room 401", fee: "₹600" },
        { name: "Dr. Rahul Menon", room: "Room 402", fee: "₹600" }
    ],
    "Dermatology": [
        { name: "Dr. Priya Das", room: "Room 501", fee: "₹650" }
    ]
};

// Initialize page attributes
window.addEventListener("DOMContentLoaded", function () {
    var dateInput = document.getElementById("date");
    if (dateInput) {
        var today = new Date().toISOString().split("T")[0];
        dateInput.min = today;
    }
});

// Load doctor names according to selected department
function loadDoctors() {
    var department = document.getElementById("department").value;
    var doctorSelect = document.getElementById("doctor");
    var badge = document.getElementById("doctorDetailsBadge");

    if (badge) badge.innerHTML = "";
    resetSlots();

    doctorSelect.innerHTML = "<option value=''>-- Select Doctor --</option>";

    var doctors = doctorDirectory[department] || [];
    for (var i = 0; i < doctors.length; i++) {
        var opt = document.createElement("option");
        opt.value = doctors[i].name;
        opt.text = doctors[i].name + " (" + doctors[i].room + " - " + doctors[i].fee + ")";
        doctorSelect.appendChild(opt);
    }
}

// Fetch live time slot availability from backend API
async function checkSlotsAvailability() {
    var doctor = document.getElementById("doctor").value;
    var date = document.getElementById("date").value;
    var slotBox = document.getElementById("slotPickerBox");
    var list = document.getElementById("slotButtonsList");
    var badge = document.getElementById("doctorDetailsBadge");

    if (!doctor || !date) {
        if (slotBox) slotBox.style.display = "none";
        return;
    }

    // Display doctor room & fee
    var dept = document.getElementById("department").value;
    var docs = doctorDirectory[dept] || [];
    var found = docs.find(function (d) { return d.name === doctor; });
    if (found && badge) {
        badge.innerHTML = "Consultation: " + found.room + " &bull; Fee: " + found.fee;
    }

    if (slotBox) slotBox.style.display = "block";
    if (list) list.innerHTML = "<span style='font-size:12px; color:#64748b;'>Checking doctor calendar...</span>";

    try {
        var response = await fetch("/api/available-slots?doctor=" + encodeURIComponent(doctor) + "&date=" + encodeURIComponent(date));
        var data = await response.json();

        if (!data.success || !data.slots) {
            list.innerHTML = "<span style='color:#dc2626; font-size:12px;'>Could not check slots.</span>";
            return;
        }

        var html = "";
        for (var i = 0; i < data.slots.length; i++) {
            var s = data.slots[i];
            if (s.isAvailable) {
                html += "<button type='button' class='slot-btn' onclick=\"pickTimeSlot('" + s.time + "', this)\">" + s.display + "</button>";
            } else {
                html += "<button type='button' class='slot-btn disabled' title='Already booked' disabled>" + s.display + "</button>";
            }
        }

        list.innerHTML = html;
    } catch (err) {
        if (list) list.innerHTML = "<span style='color:#dc2626; font-size:12px;'>Error checking slots.</span>";
    }
}

// Pick slot from buttons
function pickTimeSlot(timeStr, btn) {
    var timeInput = document.getElementById("time");
    timeInput.value = timeStr;

    var allBtns = document.querySelectorAll(".slot-btn");
    for (var i = 0; i < allBtns.length; i++) {
        allBtns[i].classList.remove("active");
    }
    btn.classList.add("active");
    showError("time", "");
}

// Reset slots panel
function resetSlots() {
    var slotBox = document.getElementById("slotPickerBox");
    if (slotBox) slotBox.style.display = "none";
    var badge = document.getElementById("doctorDetailsBadge");
    if (badge) badge.innerHTML = "";
}

// Show error message below the field
function showError(fieldId, message) {
    var el = document.getElementById(fieldId + "Error");
    if (el) el.innerHTML = message;
}

// Clear all error messages
function clearErrors() {
    var fields = ["name", "email", "phone", "age", "gender",
                  "department", "doctor", "date", "time", "reason"];

    for (var i = 0; i < fields.length; i++) {
        var el = document.getElementById(fields[i] + "Error");
        if (el) el.innerHTML = "";
    }
}

// Main validation function
function validateForm() {
    clearErrors();

    var valid = true;

    var name = document.getElementById("name").value.trim();
    var email = document.getElementById("email").value.trim();
    var phone = document.getElementById("phone").value.trim();
    var age = document.getElementById("age").value.trim();
    var gender = document.getElementById("gender").value;
    var department = document.getElementById("department").value;
    var doctor = document.getElementById("doctor").value;
    var date = document.getElementById("date").value;
    var time = document.getElementById("time").value;
    var reason = document.getElementById("reason").value.trim();

    // 1. Name
    var namePattern = /^[A-Za-z ]{3,50}$/;
    if (name === "") {
        showError("name", "Please enter your name");
        valid = false;
    } else if (!namePattern.test(name)) {
        showError("name", "Name must contain only letters (3 to 50 characters)");
        valid = false;
    }

    // 2. Email
    var emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (email === "") {
        showError("email", "Please enter your email ID");
        valid = false;
    } else if (!emailPattern.test(email)) {
        showError("email", "Please enter a valid email ID");
        valid = false;
    }

    // 3. Mobile number (10 digits)
    var phonePattern = /^[0-9]{10}$/;
    if (phone === "") {
        showError("phone", "Please enter your mobile number");
        valid = false;
    } else if (!phonePattern.test(phone)) {
        showError("phone", "Mobile number must be exactly 10 digits");
        valid = false;
    }

    // 4. Age (1 - 120)
    if (age === "") {
        showError("age", "Please enter your age");
        valid = false;
    } else if (isNaN(age) || Number(age) < 1 || Number(age) > 120) {
        showError("age", "Please enter a valid age (1 - 120)");
        valid = false;
    }

    // 5. Gender
    if (gender === "") {
        showError("gender", "Please select your gender");
        valid = false;
    }

    // 6. Department
    if (department === "") {
        showError("department", "Please select a department");
        valid = false;
    }

    // 7. Doctor
    if (doctor === "") {
        showError("doctor", "Please select a doctor");
        valid = false;
    }

    // 8. Date
    if (date === "") {
        showError("date", "Please select an appointment date");
        valid = false;
    } else {
        var selectedDate = new Date(date + "T00:00:00");
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            showError("date", "Date cannot be in the past");
            valid = false;
        } else if (selectedDate.getDay() === 0) {
            showError("date", "Hospital is closed on Sunday");
            valid = false;
        }
    }

    // 9. Time (09:00 - 18:00)
    if (time === "") {
        showError("time", "Please select an appointment time slot");
        valid = false;
    } else if (time < "09:00" || time > "18:00") {
        showError("time", "Consultation timing is between 09:00 and 18:00");
        valid = false;
    }

    // 10. Reason
    if (reason.length > 300) {
        showError("reason", "Reason should be within 300 characters");
        valid = false;
    }

    if (!valid) {
        alert("Please correct the errors indicated in the form before submitting.");
    }

    return valid;
}
