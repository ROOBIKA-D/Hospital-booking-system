// Hospital Appointment Booking System
// Client side form validation using JavaScript

// Load doctor names according to the department selected
function loadDoctors() {
    var department = document.getElementById("department").value;
    var doctor = document.getElementById("doctor");

    // remove old options first
    doctor.innerHTML = "<option value=''>-- Select Doctor --</option>";

    var list = [];

    if (department == "General Medicine") {
        list = ["Dr. Anand Rao", "Dr. Meera Nair"];
    } else if (department == "Cardiology") {
        list = ["Dr. Suresh Iyer", "Dr. Fatima Khan"];
    } else if (department == "Orthopedics") {
        list = ["Dr. Vikram Sethi"];
    } else if (department == "Pediatrics") {
        list = ["Dr. Leena Joseph", "Dr. Rahul Menon"];
    } else if (department == "Dermatology") {
        list = ["Dr. Priya Das"];
    }

    for (var i = 0; i < list.length; i++) {
        var option = document.createElement("option");
        option.value = list[i];
        option.text = list[i];
        doctor.appendChild(option);
    }
}

// Show an error message below the field
function showError(fieldId, message) {
    document.getElementById(fieldId + "Error").innerHTML = message;
}

// Clear all old error messages before validating again
function clearErrors() {
    var fields = ["name", "email", "phone", "age", "gender",
                  "department", "doctor", "date", "time", "reason"];

    for (var i = 0; i < fields.length; i++) {
        document.getElementById(fields[i] + "Error").innerHTML = "";
    }
}

// Main validation function, called when the form is submitted
function validateForm() {
    clearErrors();

    var valid = true;

    var name = document.getElementById("name").value;
    var email = document.getElementById("email").value;
    var phone = document.getElementById("phone").value;
    var age = document.getElementById("age").value;
    var gender = document.getElementById("gender").value;
    var department = document.getElementById("department").value;
    var doctor = document.getElementById("doctor").value;
    var date = document.getElementById("date").value;
    var time = document.getElementById("time").value;
    var reason = document.getElementById("reason").value;

    // 1. Name - must not be empty, only letters and spaces allowed
    var namePattern = /^[A-Za-z ]{3,50}$/;
    if (name == "") {
        showError("name", "Please enter your name");
        valid = false;
    } else if (!namePattern.test(name)) {
        showError("name", "Name must have only letters (3 to 50 characters)");
        valid = false;
    }

    // 2. Email - must be in correct format
    var emailPattern = /^[a-zA-Z0-9._]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,}$/;
    if (email == "") {
        showError("email", "Please enter your email id");
        valid = false;
    } else if (!emailPattern.test(email)) {
        showError("email", "Please enter a valid email id");
        valid = false;
    }

    // 3. Mobile number - exactly 10 digits
    var phonePattern = /^[0-9]{10}$/;
    if (phone == "") {
        showError("phone", "Please enter your mobile number");
        valid = false;
    } else if (!phonePattern.test(phone)) {
        showError("phone", "Mobile number must be 10 digits");
        valid = false;
    }

    // 4. Age - number between 1 and 120
    if (age == "") {
        showError("age", "Please enter your age");
        valid = false;
    } else if (isNaN(age)) {
        showError("age", "Age must be a number");
        valid = false;
    } else if (age < 1 || age > 120) {
        showError("age", "Please enter a valid age (1 - 120)");
        valid = false;
    }

    // 5. Gender
    if (gender == "") {
        showError("gender", "Please select your gender");
        valid = false;
    }

    // 6. Department
    if (department == "") {
        showError("department", "Please select a department");
        valid = false;
    }

    // 7. Doctor
    if (doctor == "") {
        showError("doctor", "Please select a doctor");
        valid = false;
    }

    // 8. Date - cannot be a past date and hospital is closed on Sunday
    if (date == "") {
        showError("date", "Please select the appointment date");
        valid = false;
    } else {
        var selectedDate = new Date(date);
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            showError("date", "Date cannot be in the past");
            valid = false;
        } else if (selectedDate.getDay() == 0) {
            showError("date", "Hospital is closed on Sunday");
            valid = false;
        }
    }

    // 9. Time - between 09:00 AM and 06:00 PM
    if (time == "") {
        showError("time", "Please select the appointment time");
        valid = false;
    } else if (time < "09:00" || time > "18:00") {
        showError("time", "Timing must be between 09:00 and 18:00");
        valid = false;
    }

    // 10. Reason is optional but should not be too long
    if (reason.length > 300) {
        showError("reason", "Reason should be within 300 characters");
        valid = false;
    }

    if (valid == false) {
        alert("Please correct the errors shown in the form");
    }

    return valid;
}
