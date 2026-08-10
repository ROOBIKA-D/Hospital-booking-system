/*
 * Hospital Appointment Booking System
 * Server side program written using Node.js and Express.
 *
 * This file works like a servlet. It receives the appointment form which is
 * submitted from index.html and validates all the values once again on the
 * server. Server side validation is required because the user can disable
 * JavaScript in the browser and skip the client side checks in script.js.
 *
 * How to run this program :
 *      1. npm init -y
 *      2. npm install express
 *      3. node server.js
 *      4. Open http://localhost:8080 in the browser
 */

var express = require("express");
var path = require("path");

var app = express();
var PORT = 8080;

// This line is needed to read the form values sent by the POST method
app.use(express.urlencoded({ extended: false }));

// This line makes index.html, style.css and script.js open in the browser
app.use(express.static(__dirname));

// Convert the special HTML characters so that the values typed by the user
// are printed as plain text and not treated as HTML tags
function escape(value) {
    value = value.replace(/&/g, "&amp;");
    value = value.replace(/</g, "&lt;");
    value = value.replace(/>/g, "&gt;");
    value = value.replace(/"/g, "&quot;");
    return value;
}

// This function makes the full HTML page that is sent back to the browser
function makePage(title, heading, body) {
    var page = "";
    page = page + "<html>";
    page = page + "<head><title>" + title + "</title>";
    page = page + "<link rel='stylesheet' href='style.css'></head>";
    page = page + "<body>";
    page = page + "<div class='header'><h1>Hospital Appointment Booking System</h1></div>";
    page = page + "<div class='container'><div class='form-box'>";
    page = page + "<h2>" + heading + "</h2>";
    page = page + body;
    page = page + "</div></div>";
    page = page + "</body></html>";
    return page;
}

// This part runs when the Book Appointment button is clicked
app.post("/BookingServlet", function (request, response) {

    // Get all the values sent from the form
    var name = request.body.name;
    var email = request.body.email;
    var phone = request.body.phone;
    var age = request.body.age;
    var gender = request.body.gender;
    var department = request.body.department;
    var doctor = request.body.doctor;
    var date = request.body.date;
    var time = request.body.time;
    var reason = request.body.reason;

    // If a field was not sent at all, make it an empty string
    if (name == undefined) { name = ""; }
    if (email == undefined) { email = ""; }
    if (phone == undefined) { phone = ""; }
    if (age == undefined) { age = ""; }
    if (gender == undefined) { gender = ""; }
    if (department == undefined) { department = ""; }
    if (doctor == undefined) { doctor = ""; }
    if (date == undefined) { date = ""; }
    if (time == undefined) { time = ""; }
    if (reason == undefined) { reason = ""; }

    name = name.trim();
    email = email.trim();
    phone = phone.trim();
    age = age.trim();

    // This array will store all the error messages
    var errors = [];

    // 1. Name
    if (name == "") {
        errors.push("Name is empty");
    } else if (!/^[A-Za-z ]{3,50}$/.test(name)) {
        errors.push("Name must have only letters (3 to 50 characters)");
    }

    // 2. Email
    if (email == "") {
        errors.push("Email id is empty");
    } else if (!/^[a-zA-Z0-9._]+@[a-zA-Z0-9]+\.[a-zA-Z]{2,}$/.test(email)) {
        errors.push("Email id is not valid");
    }

    // 3. Mobile number
    if (!/^[0-9]{10}$/.test(phone)) {
        errors.push("Mobile number must be 10 digits");
    }

    // 4. Age
    if (age == "" || isNaN(age)) {
        errors.push("Age must be a number");
    } else if (Number(age) < 1 || Number(age) > 120) {
        errors.push("Age must be between 1 and 120");
    }

    // 5. Gender
    if (gender == "") {
        errors.push("Gender is not selected");
    }

    // 6. Department
    if (department == "") {
        errors.push("Department is not selected");
    }

    // 7. Doctor
    if (doctor == "") {
        errors.push("Doctor is not selected");
    }

    // 8. Appointment date
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
        errors.push("Appointment date is not valid");
    } else {
        var selectedDate = new Date(date + "T00:00:00");

        if (isNaN(selectedDate.getTime())) {
            errors.push("Appointment date is not valid");
        } else {
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                errors.push("Appointment date cannot be in the past");
            } else if (selectedDate.getDay() == 0) {
                errors.push("Hospital is closed on Sunday");
            }
        }
    }

    // 9. Appointment time
    if (!/^[0-9]{2}:[0-9]{2}$/.test(time)) {
        errors.push("Appointment time is not valid");
    } else if (time < "09:00" || time > "18:00") {
        errors.push("Timing must be between 09:00 and 18:00");
    }

    // 10. Reason
    if (reason.length > 300) {
        errors.push("Reason should be within 300 characters");
    }

    // If there are errors, show them to the user
    if (errors.length > 0) {

        var errorBody = "<p>Please correct the following :</p><ul>";

        for (var i = 0; i < errors.length; i++) {
            errorBody = errorBody + "<li>" + errors[i] + "</li>";
        }

        errorBody = errorBody + "</ul>";
        errorBody = errorBody + "<p><a href='index.html'>Go back to the form</a></p>";

        response.send(makePage("Booking Failed", "Appointment Not Booked", errorBody));

    } else {

        // All the values are correct, so the appointment is confirmed.
        // Note : the details are only printed here. Saving into a database
        // like MySQL or MongoDB can be added later.
        var successBody = "";
        successBody = successBody + "<p>Thank you " + escape(name) + ", your appointment is booked.</p>";
        successBody = successBody + "<p><b>Name :</b> " + escape(name) + "</p>";
        successBody = successBody + "<p><b>Email :</b> " + escape(email) + "</p>";
        successBody = successBody + "<p><b>Mobile :</b> " + escape(phone) + "</p>";
        successBody = successBody + "<p><b>Age :</b> " + escape(age) + "</p>";
        successBody = successBody + "<p><b>Gender :</b> " + escape(gender) + "</p>";
        successBody = successBody + "<p><b>Department :</b> " + escape(department) + "</p>";
        successBody = successBody + "<p><b>Doctor :</b> " + escape(doctor) + "</p>";
        successBody = successBody + "<p><b>Date :</b> " + escape(date) + "</p>";
        successBody = successBody + "<p><b>Time :</b> " + escape(time) + "</p>";
        successBody = successBody + "<p><a href='index.html'>Book another appointment</a></p>";

        console.log("New appointment booked : " + name + " - " + doctor + " on " + date + " " + time);

        response.send(makePage("Booking Confirmed", "Appointment Confirmed", successBody));
    }
});

app.listen(PORT, function () {
    console.log("Server is running on http://localhost:" + PORT);
});
