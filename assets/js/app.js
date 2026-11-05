// MOBILE MENU
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", function () {
        navLinks.classList.toggle("active");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            navLinks.classList.remove("active");
        });
    });
}

// CURRENT YEAR
document.querySelectorAll(".current-year").forEach(function (element) {
    element.textContent = new Date().getFullYear();
});


// REGISTRATION FORM
const registrationForm = document.getElementById("registrationForm");

if (registrationForm) {
    registrationForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const age = document.getElementById("age").value;
        const workshop = document.getElementById("workshop").value;
        const message = document.getElementById("message").value.trim();
        const formMessage = document.getElementById("formMessage");

        const registration = {
            id: "SC" + Date.now(),
            name: name,
            email: email,
            phone: phone,
            age: age,
            workshop: workshop,
            message: message,
            status: "Registered"
        };

        try {
            const registrations = JSON.parse(
                localStorage.getItem("skillConnectRegistrations") || "[]"
            );

            registrations.push(registration);

            localStorage.setItem(
                "skillConnectRegistrations",
                JSON.stringify(registrations)
            );

            formMessage.textContent =
                "Registration successful! Your ID is: " + registration.id;

            formMessage.className = "form-message success";
            registrationForm.reset();

        } catch (error) {
            formMessage.textContent =
                "Unable to save registration. Please try again.";

            formMessage.className = "form-message error";
        }
    });
}


// TRACKING FORM
const trackingForm = document.getElementById("trackingForm");

if (trackingForm) {
    trackingForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const input = document.getElementById("trackingInput").value.trim();
        const result = document.getElementById("trackingResult");

        const registrations = JSON.parse(
            localStorage.getItem("skillConnectRegistrations") || "[]"
        );

        const found = registrations.find(function (registration) {
            return registration.id.toLowerCase() === input.toLowerCase()
                || registration.email.toLowerCase() === input.toLowerCase();
        });

        if (found) {

            const workshopDates = {
                "First Aid Training": "14 November 2026",
                "Computer Usage": "21 November 2026",
                "Personality Development": "28 November 2026"
            };

            const attendanceRecords = JSON.parse(
                localStorage.getItem("skillConnectAttendance") || "{}"
            );

            const attendanceKey =
                workshopDates[found.workshop] === "14 November 2026"
                    ? "2026-11-14__" + found.workshop
                    : workshopDates[found.workshop] === "21 November 2026"
                    ? "2026-11-21__" + found.workshop
                    : "2026-11-28__" + found.workshop;

            const attendance = attendanceRecords[attendanceKey] || {};
            const attendanceStatus = attendance[found.id] || "Not Marked Yet";

            result.className = "tracking-result";

            result.innerHTML = `
                <h3>Registration Found!</h3>
                <p><strong>Name:</strong> ${found.name}</p>
                <p><strong>Registration ID:</strong> ${found.id}</p>
                <p><strong>Workshop:</strong> ${found.workshop}</p>
                <p><strong>Registration Status:</strong> ${found.status}</p>
                <hr>
                <h3>Workshop Schedule</h3>
                <p><strong>Venue:</strong> Dr. T. Thimmaiah Institute of Technology, KGF</p>
                <p><strong>Date:</strong> ${workshopDates[found.workshop] || "To be announced"}</p>
                <p><strong>Time:</strong> 10:00 AM – 12:00 PM</p>
                <p><strong>Attendance:</strong> ${attendanceStatus}</p>
                <a class="location-link"
                href="https://www.google.com/maps/search/?api=1&query=Dr.+T.+Thimmaiah+Institute+of+Technology+KGF"
                   target="_blank" rel="noopener noreferrer">
                   View Location on Google Maps
                </a>
            `;

            result.style.display = "block";

        } else {
            result.textContent =
                "No registration found. Please check your ID or email.";

            result.className = "tracking-result error";
            result.style.display = "block";
        }
    });
}


// ADMIN LOGIN - FRONTEND DEMO ONLY
const adminLoginForm = document.getElementById("adminLoginForm");

if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        const message = document.getElementById("loginMessage");

        if (email && password) {
            sessionStorage.setItem("skillConnectAdminDemo", "true");
            window.location.href = "admin-dashboard.html";
        } else {
            message.textContent = "Please enter both email and password.";
            message.className = "form-message error";
        }
    });
}


// ADMIN DASHBOARD
const registrationTableBody =
    document.getElementById("registrationTableBody");

if (registrationTableBody) {

    const isAdmin = sessionStorage.getItem("skillConnectAdminDemo");

    if (isAdmin !== "true") {
        window.location.href = "admin-login.html";
    } else {

        const registrations = JSON.parse(
            localStorage.getItem("skillConnectRegistrations") || "[]"
        );

        document.getElementById("totalRegistrations").textContent =
            registrations.length;

        document.getElementById("firstAidCount").textContent =
            registrations.filter(r => r.workshop === "First Aid Training").length;

        document.getElementById("computerCount").textContent =
            registrations.filter(r => r.workshop === "Computer Usage").length;

        document.getElementById("personalityCount").textContent =
            registrations.filter(r => r.workshop === "Personality Development").length;

        if (registrations.length > 0) {

            registrationTableBody.innerHTML = "";

            registrations.forEach(function (registration) {
                const row = document.createElement("tr");

                [
                    registration.id,
                    registration.name,
                    registration.email,
                    registration.workshop,
                    registration.status
                ].forEach(function (value) {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                registrationTableBody.appendChild(row);
            });
        }
    }
}


// ADMIN LOGOUT
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        sessionStorage.removeItem("skillConnectAdminDemo");
        window.location.href = "admin-login.html";
    });
}
// ATTENDANCE MANAGEMENT

const loadAttendanceBtn = document.getElementById("loadAttendanceBtn");
const saveAttendanceBtn = document.getElementById("saveAttendanceBtn");
const attendanceWorkshop = document.getElementById("attendanceWorkshop");
const attendanceDate = document.getElementById("attendanceDate");
const attendanceTableBody = document.getElementById("attendanceTableBody");
const attendanceMessage = document.getElementById("attendanceMessage");

// Set today's date automatically
if (attendanceDate) {
    attendanceDate.value = new Date().toISOString().split("T")[0];
}


// LOAD PARTICIPANTS
if (loadAttendanceBtn) {

    loadAttendanceBtn.addEventListener("click", function () {
        
        const workshop = attendanceWorkshop.value;
        const date = attendanceDate.value;

        if (!workshop || !date) {
            attendanceMessage.textContent =
                "Please select both workshop and date.";
            return;
        }

        const registrations = JSON.parse(
            localStorage.getItem("skillConnectRegistrations") || "[]"
        );

        const participants = registrations.filter(function (person) {
            return person.workshop === workshop;
        });

        if (participants.length === 0) {
            attendanceTableBody.innerHTML =
                `<tr><td colspan="4">No participants registered for this workshop.</td></tr>`;

            attendanceMessage.textContent = "";
            return;
        }

        const attendanceRecords = JSON.parse(
            localStorage.getItem("skillConnectAttendance") || "{}"
        );

        const recordKey = date + "__" + workshop;
        const savedRecords = attendanceRecords[recordKey] || {};

        attendanceTableBody.innerHTML = "";

        participants.forEach(function (person) {

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = person.name;

            const emailCell = document.createElement("td");
            emailCell.textContent = person.email;

            const workshopCell = document.createElement("td");
            workshopCell.textContent = person.workshop;

            const attendanceCell = document.createElement("td");

            const select = document.createElement("select");
            select.className = "attendance-status";
            select.dataset.participantId = person.id;

            const options = ["Select Status", "Present", "Absent"];

            options.forEach(function (status) {
                const option = document.createElement("option");

                option.value = status === "Select Status" ? "" : status;
                option.textContent = status;

                select.appendChild(option);
            });

            select.value = savedRecords[person.id] || "";

            attendanceCell.appendChild(select);

            row.appendChild(nameCell);
            row.appendChild(emailCell);
            row.appendChild(workshopCell);
            row.appendChild(attendanceCell);

            attendanceTableBody.appendChild(row);
        });

        attendanceMessage.textContent =
            participants.length + " participant(s) loaded.";

    });
}


// SAVE ATTENDANCE
if (saveAttendanceBtn) {

    saveAttendanceBtn.addEventListener("click", function () {

        const workshop = attendanceWorkshop.value;
        const date = attendanceDate.value;

        if (!workshop || !date) {
            attendanceMessage.textContent =
                "Please select a workshop and date first.";
            return;
        }

        const selects = attendanceTableBody.querySelectorAll(
            ".attendance-status"
        );

        if (selects.length === 0) {
            attendanceMessage.textContent =
                "Please load participants first.";
            return;
        }

        const attendanceRecords = JSON.parse(
            localStorage.getItem("skillConnectAttendance") || "{}"
        );

        const recordKey = date + "__" + workshop;

        const records = {};

        for (const select of selects) {

            if (!select.value) {
                attendanceMessage.textContent =
                    "Please mark every participant as Present or Absent.";
                return;
            }

            records[select.dataset.participantId] = select.value;
        }

        attendanceRecords[recordKey] = records;

        localStorage.setItem(
            "skillConnectAttendance",
            JSON.stringify(attendanceRecords)
        );

        attendanceMessage.textContent =
            "Attendance saved successfully!";

    });
}

// WORKSHOP SCHEDULE DISPLAY

const workshopSelect = document.getElementById("workshop");
const workshopSchedule = document.getElementById("workshopSchedule");
const scheduleDate = document.getElementById("scheduleDate");

if (workshopSelect && workshopSchedule && scheduleDate) {

    const workshopDates = {
        "First Aid Training": "14 November 2026",
        "Computer Usage": "21 November 2026",
        "Personality Development": "28 November 2026"
    };

    workshopSelect.addEventListener("change", function () {

        const selectedWorkshop = workshopSelect.value;

        if (workshopDates[selectedWorkshop]) {

            scheduleDate.textContent = workshopDates[selectedWorkshop];

            workshopSchedule.hidden = false;

        } else {

            workshopSchedule.hidden = true;

        }

    });

}
