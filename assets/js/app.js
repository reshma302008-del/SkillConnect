
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


// REGISTRATION FORM - SUPABASE DATABASE

const registrationForm = document.getElementById("registrationForm");
const registrationWorkshopSelect = document.getElementById("workshop");

let registrationWorkshopData = [];

// LOAD WORKSHOPS FROM SUPABASE
async function loadRegistrationWorkshops() {
    if (!registrationWorkshopSelect) return;

    const { data, error } = await window.supabaseClient
        .from("workshops")
        .select("id, title, date, start_time, end_time, location")
        .eq("is_active", true)
        .order("date");

    if (error) {
        console.error("Workshop loading error:", error);
        return;
    }

    registrationWorkshopData = data || [];

    registrationWorkshopSelect.innerHTML =
        '<option value="">Choose a Workshop</option>';

    data.forEach(function (workshop) {
        const option = document.createElement("option");
        option.value = workshop.id;
        option.textContent = workshop.title;
        registrationWorkshopSelect.appendChild(option);
    });

    // AUTOMATICALLY SELECT WORKSHOP FROM URL
    const params = new URLSearchParams(window.location.search);
    const selectedWorkshopId = params.get("workshop");

    if (selectedWorkshopId) {
        registrationWorkshopSelect.value = selectedWorkshopId;
        registrationWorkshopSelect.dispatchEvent(
            new Event("change")
        );
    }
}

loadRegistrationWorkshops();


// SUBMIT REGISTRATION
if (registrationForm) {
    registrationForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const age = Number(document.getElementById("age").value);
        const workshopId = Number(registrationWorkshopSelect.value);
        const message = document.getElementById("message").value.trim();
        const formMessage = document.getElementById("formMessage");

        if (!name || !email || !phone || !age || !workshopId) {
            formMessage.textContent = "Please fill in all required fields.";
            formMessage.className = "form-message error";
            return;
        }

        formMessage.textContent = "Submitting your registration...";
        formMessage.className = "form-message";

        const { data, error } = await window.supabaseClient.rpc(
            "register_for_workshop",
            {
                p_participant_name: name,
                p_email: email,
                p_phone: phone,
                p_workshop_id: workshopId,
                p_age: age,
                p_message: message || null
            }
        );

        if (error) {

            console.log("SUPABASE ERROR:", error.message);

            if (error.message.includes("Workshop Full")) {
                formMessage.textContent =
                    "Sorry! This workshop is full. Please choose another workshop.";
            } else if (error.message.includes("already registered")) {
                formMessage.textContent =
                    "You have already registered for this workshop.";
            } else {
                formMessage.textContent =
                    "Registration failed. Please try again.";
            }

            formMessage.className = "form-message error";
            return;
        }

        const registrationCode = data[0].registration_code;

        formMessage.textContent =
            "Registration successful! Your ID is: " + registrationCode;

        formMessage.className = "form-message success";
        registrationForm.reset();
    });
}


// TRACKING FORM - SUPABASE

const trackingForm = document.getElementById("trackingForm");

if (trackingForm) {
    trackingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const searchInput =
            document.getElementById("trackingInput").value.trim();

        const result = document.getElementById("trackingResult");

        result.textContent = "Checking your registration...";
        result.style.display = "block";

        try {
            const { data, error } = await window.supabaseClient.rpc(
                "track_registration",
                { p_search_input: searchInput }
            );

            if (error) throw error;

            if (!data || data.length === 0) {
                result.textContent = "No registration found. Please check your ID or email.";
                result.className = "tracking-result error";
                return;
            }

            const r = data[0];

            const date = r.workshop_date
                ? new Date(r.workshop_date + "T00:00:00")
                    .toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric"
                    })
                : "To be announced";

            result.className = "tracking-result";

            result.innerHTML = `
                <h3>Registration Found!</h3>
                <p><strong>Name:</strong> ${r.participant_name}</p>
                <p><strong>Registration ID:</strong> ${r.registration_code}</p>
                <p><strong>Workshop:</strong> ${r.workshop_title}</p>
                <p><strong>Status:</strong> ${r.registration_status}</p>
                <hr>
                <h3>Workshop Schedule</h3>
                <p><strong>Venue:</strong> ${r.location}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Time:</strong> ${r.start_time} – ${r.end_time}</p>
            `;

        } catch (error) {
            console.error("Tracking error:", error);
            result.textContent = "Tracking failed: " + error.message;
            result.className = "tracking-result error";
        }
    });
}


// ADMIN LOGIN - SUPABASE AUTHENTICATION

const adminLoginForm = document.getElementById("adminLoginForm");

if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        const message = document.getElementById("loginMessage");

        message.textContent = "Verifying login...";
        message.className = "form-message";

        const { data, error } =
            await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            message.textContent = "Login failed. Please check your email and password.";
            message.className = "form-message error";
            return;
        }

        const { data: isAdmin, error: roleError } =
            await window.supabaseClient.rpc("is_skillconnect_admin");

        if (roleError || !isAdmin) {
            await window.supabaseClient.auth.signOut();

            message.textContent =
                "Access denied. This account is not an authorized administrator.";

            message.className = "form-message error";
            return;
        }

        window.location.href = "admin-dashboard.html";
    });
}


// ADMIN DASHBOARD - SUPABASE DATABASE
// PARTICIPANT EDITING AND CANCELLATION INCLUDED

const registrationTableBody =
    document.getElementById("registrationTableBody");

if (registrationTableBody) {

    window.currentRegistrations = [];

    async function loadAdminDashboard() {

        const { data: sessionData, error: sessionError } =
            await window.supabaseClient.auth.getSession();

        if (sessionError || !sessionData.session) {
            window.location.href = "admin-login.html";
            return;
        }

        const { data: isAdmin, error: roleError } =
            await window.supabaseClient.rpc("is_skillconnect_admin");

        if (roleError || !isAdmin) {
            await window.supabaseClient.auth.signOut();
            window.location.href = "admin-login.html";
            return;
        }

        registrationTableBody.innerHTML =
            '<tr><td colspan="6">Loading registrations...</td></tr>';

        const { data: registrations, error } =
            await window.supabaseClient
                .from("registrations")
                .select(`
                    id,
                    registration_code,
                    participant_name,
                    email,
                    phone,
                    age,
                    message,
                    status,
                    workshop_id,
                    workshops(title)
                `)
                .order("created_at", { ascending: false });

        if (error) {
            console.error("Registration loading error:", error);

            registrationTableBody.innerHTML =
                '<tr><td colspan="6">Unable to load registrations.</td></tr>';

            return;
        }

        window.currentRegistrations = registrations || [];

document.getElementById("totalRegistrations").textContent =
    registrations.length;

        // STORE REGISTRATIONS FOR EDITING
        window.currentRegistrations = registrations || [];

        // COUNT ONLY ACTIVE REGISTRATIONS
        const activeRegistrations = registrations.filter(
            registration => registration.status === "Registered"
        );

        document.getElementById("totalRegistrations").textContent =
            activeRegistrations.length;

        // LOAD DYNAMIC WORKSHOP REGISTRATION COUNTS

        const workshopCards = document.getElementById(
            "workshopRegistrationCards"
        );

        const { data: workshops, error: workshopError } =
            await window.supabaseClient
                .from("workshops")
                .select("id, title")
                .order("id", { ascending: true });

        if (workshopError) {

            console.error("Workshop statistics error:", workshopError);
            workshopCards.textContent =
                "Unable to load workshop statistics.";

        } else {

            workshopCards.innerHTML = "";

            workshops.forEach(function (workshop) {

                const count = activeRegistrations.filter(
                    registration =>
                        Number(registration.workshop_id) ===
                        Number(workshop.id)
                ).length;

                const card = document.createElement("div");
                card.className = "dashboard-card";

                const heading = document.createElement("h3");
                heading.textContent = workshop.title;

                const number = document.createElement("h2");
                number.textContent = count;

                card.appendChild(heading);
                card.appendChild(number);

                workshopCards.appendChild(card);

            });
        }

        // DISPLAY PARTICIPANTS

        registrationTableBody.innerHTML = "";

        if (registrations.length === 0) {

            registrationTableBody.innerHTML =
                '<tr><td colspan="6">No registrations available yet.</td></tr>';

            return;
        }

        registrations.forEach(function (registration) {

            const row = document.createElement("tr");

            const values = [
                registration.registration_code,
                registration.participant_name,
                registration.email,
                registration.workshops?.title || "Unknown Workshop",
                registration.status
            ];

            values.forEach(function (value) {

                const cell = document.createElement("td");
                cell.textContent = value || "";
                row.appendChild(cell);

            });

            // ACTION BUTTONS

            const actionCell = document.createElement("td");

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";
            editButton.className = "btn btn-primary";
            editButton.dataset.id = registration.id;
            editButton.dataset.action = "edit";

            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.textContent =
                registration.status === "Cancelled"
                    ? "Cancelled"
                    : "Cancel";

            cancelButton.className = "btn btn-primary";
            cancelButton.dataset.id = registration.id;
            cancelButton.dataset.action = "cancel";

            if (registration.status === "Cancelled") {
                cancelButton.disabled = true;
            }

            actionCell.appendChild(editButton);
            actionCell.appendChild(cancelButton);

            row.appendChild(actionCell);

            registrationTableBody.appendChild(row);

        });
    }
    // EXPORT PARTICIPANT REGISTRATIONS AS CSV

const exportRegistrationsBtn = document.getElementById(
    "exportRegistrationsBtn"
);

if (exportRegistrationsBtn) {

    exportRegistrationsBtn.addEventListener("click", function () {

        const registrations = window.currentRegistrations || [];

        if (registrations.length === 0) {
            alert("No participant registrations available to export.");
            return;
        }

        const headers = [
            "Registration ID",
            "Participant Name",
            "Email",
            "Phone",
            "Age",
            "Workshop",
            "Status",
            "Additional Message"
        ];

        function escapeCSV(value) {

            let text = String(value ?? "");

            // Prevent spreadsheet formula execution
            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return '"' + text.replace(/"/g, '""') + '"';
        }

        const rows = registrations.map(function (registration) {

            return [
                registration.registration_code,
                registration.participant_name,
                registration.email,
                registration.phone,
                registration.age,
                registration.workshops?.title || "Unknown Workshop",
                registration.status,
                registration.message
            ];

        });

        const csvContent = [
            headers,
            ...rows
        ]
            .map(row => row.map(escapeCSV).join(","))
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");

        downloadLink.href = url;
        downloadLink.download =
            "SkillConnect_Participant_Registrations.csv";

        document.body.appendChild(downloadLink);

        downloadLink.click();

        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(url);

        alert("Participant CSV report downloaded successfully!");

    });

}


    // OPEN EDIT PARTICIPANT FORM

    registrationTableBody.addEventListener("click", function (event) {

        const button = event.target.closest(
            "button[data-action='edit']"
        );

        if (!button) return;

        const participantId = Number(button.dataset.id);

        const registration = window.currentRegistrations.find(
            item => Number(item.id) === participantId
        );

        if (!registration) {
            alert("Participant details not found. Please refresh the page.");
            return;
        }

        document.getElementById("editParticipantId").value =
            registration.id;

        document.getElementById("editParticipantName").value =
            registration.participant_name || "";

        document.getElementById("editParticipantEmail").value =
            registration.email || "";

        document.getElementById("editParticipantPhone").value =
            registration.phone || "";

        document.getElementById("editParticipantAge").value =
            registration.age || "";

        document.getElementById("editParticipantMessage").value =
            registration.message || "";

        document.getElementById("editParticipantMessageStatus").textContent =
            "";

        const editContainer = document.getElementById(
            "editParticipantContainer"
        );

        editContainer.style.display = "block";

        editContainer.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    });


    // CANCEL PARTICIPANT REGISTRATION
    // PRESERVES ATTENDANCE HISTORY

    registrationTableBody.addEventListener("click", async function (event) {

        const button = event.target.closest(
            "button[data-action='cancel']"
        );

        if (!button || button.disabled) return;

        const participantId = Number(button.dataset.id);

        const registration = window.currentRegistrations.find(
            item => Number(item.id) === participantId
        );

        if (!registration) {
            alert("Participant not found. Please refresh the page.");
            return;
        }

        const confirmed = confirm(
            "Are you sure you want to cancel the registration of " +
            registration.participant_name +
            "?\n\nTheir attendance history will be preserved."
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Cancelling...";

        const { error } = await window.supabaseClient
            .from("registrations")
            .update({ status: "Cancelled" })
            .eq("id", participantId);

        if (error) {

            console.error("Registration cancellation error:", error);

            alert("Unable to cancel registration. Please try again.");

            button.disabled = false;
            button.textContent = "Cancel";

            return;
        }

        alert("Registration cancelled successfully!");

        await loadAdminDashboard();

        await loadAdminSeatAvailability();

    });


    // SAVE EDITED PARTICIPANT DETAILS

    const editParticipantForm = document.getElementById(
        "editParticipantForm"
    );

    if (editParticipantForm) {

        editParticipantForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const participantId = Number(
                document.getElementById("editParticipantId").value
            );

            const registration = window.currentRegistrations.find(
                item => Number(item.id) === participantId
            );

            const message = document.getElementById(
                "editParticipantMessageStatus"
            );

            if (!registration) {
                message.textContent =
                    "Participant not found. Please refresh the page.";
                return;
            }

            const name = document.getElementById(
                "editParticipantName"
            ).value.trim();

            const email = document.getElementById(
                "editParticipantEmail"
            ).value.trim().toLowerCase();

            const phone = document.getElementById(
                "editParticipantPhone"
            ).value.trim();

            const age = Number(
                document.getElementById("editParticipantAge").value
            );

            const additionalMessage = document.getElementById(
                "editParticipantMessage"
            ).value.trim();

            if (!name || !email || !phone || !age) {
                message.textContent =
                    "Please fill in all required fields.";
                return;
            }

            if (!/^[0-9]{10}$/.test(phone)) {
                message.textContent =
                    "Please enter a valid 10-digit phone number.";
                return;
            }

            if (!Number.isInteger(age) || age < 1 || age > 120) {
                message.textContent =
                    "Please enter a valid age.";
                return;
            }

            message.textContent = "Checking participant details...";

            // CHECK DUPLICATE EMAIL IN THE SAME WORKSHOP

            const { data: duplicate, error: duplicateError } =
                await window.supabaseClient
                    .from("registrations")
                    .select("id")
                    .eq("workshop_id", registration.workshop_id)
                    .ilike("email", email)
                    .neq("id", participantId)
                    .limit(1);

            if (duplicateError) {

                console.error("Duplicate check error:", duplicateError);

                message.textContent =
                    "Unable to verify email. Please try again.";

                return;
            }

            if (duplicate && duplicate.length > 0) {

                message.textContent =
                    "This email is already registered for this workshop.";

                return;
            }

            message.textContent = "Saving participant details...";

            const { error } = await window.supabaseClient
                .from("registrations")
                .update({
                    participant_name: name,
                    email: email,
                    phone: phone,
                    age: age,
                    message: additionalMessage || null
                })
                .eq("id", participantId);

            if (error) {

                console.error("Participant update error:", error);

                message.textContent =
                    "Unable to save changes. Please try again.";

                return;
            }

            message.textContent =
                "Participant details updated successfully!";

            document.getElementById(
                "editParticipantContainer"
            ).style.display = "none";

            editParticipantForm.reset();

            await loadAdminDashboard();

        });

    }


    // CANCEL EDITING

    const cancelParticipantEdit = document.getElementById(
        "cancelParticipantEdit"
    );

    if (cancelParticipantEdit) {

        cancelParticipantEdit.addEventListener("click", function () {

            document.getElementById(
                "editParticipantContainer"
            ).style.display = "none";

            if (editParticipantForm) {
                editParticipantForm.reset();
            }

            document.getElementById(
                "editParticipantMessageStatus"
            ).textContent = "";

        });

    }

    // INITIAL DASHBOARD LOAD
    loadAdminDashboard();

}


// WORKSHOP MANAGEMENT - LOAD AND DISPLAY WORKSHOPS

const workshopList = document.getElementById("workshopList");

if (workshopList) {

    async function loadWorkshops() {

        workshopList.innerHTML = "<p>Loading workshops...</p>";

        const { data: workshops, error } =
            await window.supabaseClient
                .from("workshops")
                .select("*")
                .order("id", { ascending: true });

        if (error) {
            console.error("Workshop loading error:", error);
            workshopList.innerHTML =
                "<p>Unable to load workshops.</p>";
            return;
        }

        workshopList.innerHTML = "";

        if (!workshops || workshops.length === 0) {
            workshopList.innerHTML =
                "<p>No workshops available.</p>";
            return;
        }

        workshops.forEach(function (workshop) {

            const card = document.createElement("div");
            card.className = "workshop-admin-card";

            const title = document.createElement("h3");
            title.textContent = workshop.title;

            const details = document.createElement("p");
            details.textContent =
                "Capacity: " + workshop.capacity +
                " | Date: " + workshop.date +
                " | Location: " + workshop.location;

            const status = document.createElement("p");
            status.textContent = workshop.is_active
                ? "Status: Active"
                : "Status: Inactive";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.className = "btn btn-primary";

            editBtn.addEventListener("click", function () {

                document.getElementById("workshopId").value = workshop.id;
                document.getElementById("workshopTitle").value = workshop.title;
                document.getElementById("workshopDescription").value =
                    workshop.description || "";

                document.getElementById("workshopTopics").value =
                    Array.isArray(workshop.topics)
                        ? workshop.topics.join(", ")
                        : "";

                document.getElementById("workshopOrganizer").value =
                    workshop.organizer || "";

                document.getElementById("workshopImage").value = "";
                document.getElementById("workshopDate").value = workshop.date;
                document.getElementById("workshopStartTime").value = workshop.start_time;
                document.getElementById("workshopEndTime").value = workshop.end_time;
                document.getElementById("workshopLocation").value = workshop.location;
                document.getElementById("workshopCapacity").value = workshop.capacity;

                document.getElementById("workshopFormTitle").textContent =
                    "Edit Workshop";

                document.getElementById("workshopFormContainer").style.display =
                    "block";

                document.getElementById("workshopMessage").textContent = "";

                document.getElementById("workshopFormContainer")
                    .scrollIntoView({ behavior: "smooth" });

            });

            const toggleBtn = document.createElement("button");
            toggleBtn.type = "button";
            toggleBtn.textContent = workshop.is_active
                ? "Deactivate"
                : "Activate";

            toggleBtn.addEventListener("click", async function () {

                const action = workshop.is_active
                    ? "deactivate"
                    : "activate";

                if (!confirm(
                    "Are you sure you want to " + action + " this workshop?"
                )) {
                    return;
                }

                const { error } = await window.supabaseClient
                    .from("workshops")
                    .update({ is_active: !workshop.is_active })
                    .eq("id", workshop.id);

                if (error) {
                    alert("Unable to update workshop status.");
                    console.error(error);
                    return;
                }

                alert("Workshop status updated successfully!");
                loadWorkshops();

            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Delete";

            deleteBtn.addEventListener("click", async function () {

                if (!confirm(
                    "Delete this workshop permanently? This may fail if registrations are linked to it. Deactivating is safer."
                )) {
                    return;
                }

                const { error } = await window.supabaseClient
                    .from("workshops")
                    .delete()
                    .eq("id", workshop.id);

                if (error) {
                    alert("Unable to delete this workshop. It may have existing registrations.");
                    console.error(error);
                    return;
                }

                alert("Workshop deleted successfully!");
                loadWorkshops();

            });

            card.appendChild(title);
            card.appendChild(details);
            card.appendChild(status);
            card.appendChild(editBtn);
            card.appendChild(toggleBtn);
            card.appendChild(deleteBtn);

            workshopList.appendChild(card);

        });
    }

    loadWorkshops();
}


// SHOW AND HIDE WORKSHOP FORM

const addWorkshopBtn =
    document.getElementById("addWorkshopBtn");

const workshopFormContainer =
    document.getElementById("workshopFormContainer");

const cancelWorkshopBtn =
    document.getElementById("cancelWorkshopBtn");

const workshopForm =
    document.getElementById("workshopForm");

if (addWorkshopBtn && workshopFormContainer) {

    addWorkshopBtn.addEventListener("click", function () {

        workshopForm.reset();

        document.getElementById("workshopId").value = "";
        document.getElementById("workshopCapacity").value = 30;

        document.getElementById("workshopFormTitle").textContent =
            "Add Workshop";

        document.getElementById("workshopMessage").textContent = "";

        workshopFormContainer.style.display = "block";

        workshopFormContainer.scrollIntoView({
            behavior: "smooth"
        });

    });

}

if (cancelWorkshopBtn && workshopFormContainer) {

    cancelWorkshopBtn.addEventListener("click", function () {

        workshopFormContainer.style.display = "none";

        workshopForm.reset();

        document.getElementById("workshopId").value = "";
        document.getElementById("workshopCapacity").value = 30;

        document.getElementById("workshopFormTitle").textContent =
            "Add Workshop";

        document.getElementById("workshopMessage").textContent = "";

    });

}


// SAVE OR UPDATE WORKSHOP IN SUPABASE

if (workshopForm) {

    workshopForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const workshopId = document.getElementById("workshopId").value;

        const title = document.getElementById("workshopTitle").value.trim();
        const description = document.getElementById("workshopDescription").value.trim();
        const topicsText = document.getElementById("workshopTopics").value.trim();
        const organizer = document.getElementById("workshopOrganizer").value.trim();
        const imageFile = document.getElementById("workshopImage").files[0];

        const date = document.getElementById("workshopDate").value;
        const startTime = document.getElementById("workshopStartTime").value;
        const endTime = document.getElementById("workshopEndTime").value;
        const location = document.getElementById("workshopLocation").value.trim();
        const capacity = Number(document.getElementById("workshopCapacity").value);

        const message = document.getElementById("workshopMessage");

        if (endTime <= startTime) {
            message.textContent = "End time must be later than start time.";
            return;
        }

        if (!Number.isInteger(capacity) || capacity < 1) {
            message.textContent = "Please enter a valid seat capacity.";
            return;
        }

        if (imageFile && !imageFile.type.startsWith("image/")) {
            message.textContent = "Please select a valid image.";
            return;
        }

        const workshopData = {
            title: title,
            description: description,
            topics: topicsText.split(",").map(topic => topic.trim()).filter(Boolean),
            organizer: organizer,
            date: date,
            start_time: startTime,
            end_time: endTime,
            location: location,
            capacity: capacity
        };

        message.textContent = imageFile
            ? "Uploading workshop image..."
            : workshopId ? "Updating workshop..." : "Saving workshop...";

        // UPLOAD IMAGE IF A NEW IMAGE IS SELECTED

        if (imageFile) {

            const extension = imageFile.name.split(".").pop().toLowerCase();

            const imagePath =
                `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

            const { error: uploadError } = await window.supabaseClient
                .storage
                .from("workshop-images")
                .upload(imagePath, imageFile, {
                    contentType: imageFile.type,
                    upsert: false
                });

            if (uploadError) {
                console.error("Image upload error:", uploadError);
                message.textContent = "Unable to upload workshop image.";
                return;
            }

            const { data: imageData } = window.supabaseClient
                .storage
                .from("workshop-images")
                .getPublicUrl(imagePath);

            workshopData.image_url = imageData.publicUrl;
        }

        message.textContent = workshopId
            ? "Updating workshop..."
            : "Saving workshop...";

        let result;

        if (workshopId) {

            result = await window.supabaseClient
                .from("workshops")
                .update(workshopData)
                .eq("id", workshopId);

        } else {

            result = await window.supabaseClient
                .from("workshops")
                .insert([{
                    ...workshopData,
                    is_active: true
                }]);

        }

        if (result.error) {
            console.error("Workshop save error:", result.error);
            message.textContent = "Unable to save workshop. Please try again.";
            return;
        }

        alert(workshopId
            ? "Workshop updated successfully!"
            : "Workshop added successfully!");

        window.location.reload();

    });
}


// ADMIN LOGOUT - SUPABASE

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async function () {

        const { error } = await window.supabaseClient.auth.signOut();

        if (error) {
            alert("Unable to log out. Please try again.");
            return;
        }

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

// ATTENDANCE SUMMARY COUNTERS

const totalAttendanceCount = document.getElementById("totalAttendanceCount");
const presentCount = document.getElementById("presentCount");
const absentCount = document.getElementById("absentCount");

// LOAD ACTIVE WORKSHOPS

if (attendanceWorkshop) {

    async function loadAttendanceWorkshops() {

        const { data: workshops, error } =
            await window.supabaseClient
                .from("workshops")
                .select("id, title")
                .eq("is_active", true)
                .order("id", { ascending: true });

        if (error) {
            console.error("Attendance workshop error:", error);
            attendanceWorkshop.innerHTML =
                '<option value="">Unable to load workshops</option>';
            return;
        }

        attendanceWorkshop.innerHTML =
            '<option value="">Choose Workshop</option>';

        workshops.forEach(function (workshop) {

            const option = document.createElement("option");
            option.value = workshop.id;
            option.textContent = workshop.title;

            attendanceWorkshop.appendChild(option);

        });
    }

    loadAttendanceWorkshops();
}


// UPDATE ATTENDANCE SUMMARY

function updateAttendanceSummary() {

    const selects = attendanceTableBody.querySelectorAll(
        ".attendance-status"
    );

    let present = 0;
    let absent = 0;

    selects.forEach(function (select) {

        if (select.value === "Present") {
            present++;
        } else if (select.value === "Absent") {
            absent++;
        }

    });

    totalAttendanceCount.textContent = selects.length;
    presentCount.textContent = present;
    absentCount.textContent = absent;
}


// SET TODAY'S LOCAL DATE

if (attendanceDate) {

    const today = new Date();

    const localDate = new Date(
        today.getTime() - today.getTimezoneOffset() * 60000
    ).toISOString().split("T")[0];

    attendanceDate.value = localDate;
}


// LOAD PARTICIPANTS AND EXISTING DATE-WISE ATTENDANCE

if (loadAttendanceBtn) {

    loadAttendanceBtn.addEventListener("click", async function () {

        const workshop = attendanceWorkshop.value;
        const date = attendanceDate.value;

        if (!workshop || !date) {
            attendanceMessage.textContent =
                "Please select both a workshop and date.";
            return;
        }

        attendanceMessage.textContent = "Loading participants...";

        const { data: participants, error } =
            await window.supabaseClient
                .from("registrations")
                .select("id, participant_name, email")
                .eq("workshop_id", Number(workshop))
                .eq("status", "Registered")
                .order("created_at", { ascending: true });

        if (error) {
            console.error(error);
            attendanceMessage.textContent =
                "Unable to load participants.";
            return;
        }

        if (!participants || participants.length === 0) {

            attendanceTableBody.innerHTML =
                '<tr><td colspan="4">No active participants registered for this workshop.</td></tr>';

            attendanceMessage.textContent = "No participants found.";
            updateAttendanceSummary();
            return;
        }

        // GET ATTENDANCE ALREADY SAVED FOR THIS DATE

        const { data: savedAttendance, error: attendanceError } =
            await window.supabaseClient
                .from("attendance_records")
                .select("registration_id, status")
                .eq("workshop_id", Number(workshop))
                .eq("attendance_date", date);

        if (attendanceError) {

            console.error("Attendance error:", attendanceError);

            attendanceMessage.textContent =
                "Error: " + attendanceError.message;

            return;
        }

        attendanceTableBody.innerHTML = "";

        participants.forEach(function (person) {

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = person.participant_name;

            const emailCell = document.createElement("td");
            emailCell.textContent = person.email;

            const workshopCell = document.createElement("td");
            workshopCell.textContent =
                attendanceWorkshop.options[
                    attendanceWorkshop.selectedIndex
                ].text;

            const attendanceCell = document.createElement("td");

            const select = document.createElement("select");
            select.className = "attendance-status";
            select.dataset.participantId = person.id;

            const chooseOption = document.createElement("option");
            chooseOption.value = "";
            chooseOption.textContent = "Choose status";
            select.appendChild(chooseOption);

            ["Present", "Absent"].forEach(function (status) {

                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;

                select.appendChild(option);

            });

            // PREFILL ONLY FROM THE SELECTED DATE'S RECORDS

            const existingRecord = savedAttendance.find(
                record =>
                    Number(record.registration_id) === Number(person.id)
            );

            if (existingRecord) {
                select.value = existingRecord.status;
            }

            attendanceCell.appendChild(select);

            row.appendChild(nameCell);
            row.appendChild(emailCell);
            row.appendChild(workshopCell);
            row.appendChild(attendanceCell);

            attendanceTableBody.appendChild(row);

            select.addEventListener("change", updateAttendanceSummary);

        });

        updateAttendanceSummary();

        attendanceMessage.textContent =
            participants.length + " participant(s) loaded.";

    });
}


// SAVE DATE-WISE ATTENDANCE TO SUPABASE

if (saveAttendanceBtn) {

    saveAttendanceBtn.addEventListener("click", async function () {

        const workshop = attendanceWorkshop.value;
        const date = attendanceDate.value;

        const selects = attendanceTableBody.querySelectorAll(
            ".attendance-status"
        );

        if (!workshop || !date || selects.length === 0) {
            attendanceMessage.textContent =
                "Please select a workshop and load participants first.";
            return;
        }

        // VALIDATE THAT EVERY PARTICIPANT HAS A STATUS

        const incomplete = Array.from(selects).some(
            select => !select.value
        );

        if (incomplete) {
            attendanceMessage.textContent =
                "Please choose Present or Absent for every participant.";
            return;
        }

        attendanceMessage.textContent = "Saving attendance...";
        saveAttendanceBtn.disabled = true;

        const attendanceRecords = Array.from(selects).map(function (select) {

            return {
                registration_id: Number(select.dataset.participantId),
                workshop_id: Number(workshop),
                attendance_date: date,
                status: select.value,
                updated_at: new Date().toISOString()
            };

        });

        const { error } = await window.supabaseClient
            .from("attendance_records")
            .upsert(attendanceRecords, {
                onConflict: "registration_id,workshop_id,attendance_date"
            });

        saveAttendanceBtn.disabled = false;

        if (error) {
            console.error("Attendance save error:", error);
            attendanceMessage.textContent =
                "Error saving attendance. Please try again.";
            return;
        }

        attendanceMessage.textContent =
            "Attendance saved successfully!";

        updateAttendanceSummary();

    });
}


// DYNAMIC WORKSHOP SCHEDULE DISPLAY

const workshopSelect = document.getElementById("workshop");
const workshopSchedule = document.getElementById("workshopSchedule");
const scheduleDate = document.getElementById("scheduleDate");
const scheduleLocation = document.getElementById("scheduleLocation");
const scheduleTime = document.getElementById("scheduleTime");

if (workshopSelect && workshopSchedule) {

    workshopSelect.addEventListener("change", function () {

        const selectedWorkshop = registrationWorkshopData.find(
            workshop => Number(workshop.id) === Number(this.value)
        );

        if (!selectedWorkshop) {
            workshopSchedule.hidden = true;
            return;
        }

        const date = selectedWorkshop.date
            ? new Date(selectedWorkshop.date + "T00:00:00")
                .toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                })
            : "To be announced";

        function formatTime(time) {

            if (!time) return "To be announced";

            const [hours, minutes] = time.split(":");
            const date = new Date();

            date.setHours(Number(hours), Number(minutes), 0);

            return date.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        }

        scheduleDate.textContent = date;

        scheduleLocation.textContent =
            selectedWorkshop.location || "To be announced";

        scheduleTime.textContent =
            formatTime(selectedWorkshop.start_time) + " – " +
            formatTime(selectedWorkshop.end_time);

        workshopSchedule.hidden = false;

    });
}


// WORKSHOP SEAT AVAILABILITY

async function loadWorkshopAvailability() {

    const availabilityCard = document.getElementById("workshopAvailability");

    if (!availabilityCard) return;

    const workshopId = Number(
        availabilityCard.dataset.workshopId
    );

    const { data, error } = await window.supabaseClient.rpc(
        "get_workshop_availability"
    );

    if (error) {
        console.error("Seat availability error:", error);
        document.getElementById("seatStatus").textContent =
            "Unable to load seat availability.";
        return;
    }

    const workshop = data.find(
        item => Number(item.workshop_id) === workshopId
    );

    if (!workshop) {
        document.getElementById("seatStatus").textContent =
            "Workshop information unavailable.";
        return;
    }

    const registered = Number(workshop.registered_seats);
    const total = Number(workshop.total_seats);
    const remaining = Number(workshop.remaining_seats);

    const percentage = total > 0
        ? (registered / total) * 100
        : 0;

    document.getElementById("seatStatus").textContent =
        workshop.is_full ? "Workshop Full" : "Seats Available";

    document.getElementById("seatCount").textContent =
        `${registered} / ${total}`;

    document.getElementById("remainingSeats").textContent =
        workshop.is_full
            ? "No seats remaining"
            : `${remaining} seats remaining`;

    document.getElementById("seatProgress").style.width =
        `${percentage}%`;
}

loadWorkshopAvailability();


// REGISTRATION PAGE - LIVE SEAT AVAILABILITY

const registrationWorkshop = document.getElementById("workshop");

if (registrationWorkshop) {

    registrationWorkshop.addEventListener("change", async function () {

        const workshopId = Number(this.value);

        const status = document.getElementById("registrationSeatStatus");
        const count = document.getElementById("registrationSeatCount");
        const remaining = document.getElementById("registrationRemainingSeats");
        const progress = document.getElementById("registrationSeatProgress");

        if (!workshopId) {

            status.textContent =
                "Select a workshop to check seat availability.";

            count.textContent = "-- / 30";

            remaining.textContent =
                "Choose a workshop to see remaining seats.";

            progress.style.width = "0%";

            return;
        }

        status.textContent = "Loading availability...";

        try {

            const { data, error } = await window.supabaseClient.rpc(
                "get_workshop_availability"
            );

            if (error) throw error;

            const workshop = data.find(
                item => Number(item.workshop_id) === workshopId
            );

            if (!workshop) throw new Error("Workshop not found.");

            const registered = Number(workshop.registered_seats);
            const total = Number(workshop.total_seats);
            const left = Number(workshop.remaining_seats);

            status.textContent = workshop.is_full
                ? "Workshop Full"
                : "Seats Available";

            count.textContent = `${registered} / ${total}`;

            remaining.textContent = workshop.is_full
                ? "No seats remaining"
                : `${left} seats remaining`;

            progress.style.width =
                `${total > 0 ? (registered / total) * 100 : 0}%`;

        } catch (error) {

            console.error("Registration availability error:", error);
            status.textContent = "Unable to load availability.";

        }

    });
}


// ADMIN DASHBOARD - WORKSHOP SEAT AVAILABILITY

async function loadAdminSeatAvailability() {

    const container = document.getElementById("adminSeatCards");

    if (!container) return;

    container.innerHTML = "<p>Loading seat availability...</p>";

    try {

        const { data, error } = await window.supabaseClient.rpc(
            "get_workshop_availability"
        );

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = "<p>No active workshops found.</p>";
            return;
        }

        container.innerHTML = data.map(workshop => {

            const total = Number(workshop.total_seats);
            const registered = Number(workshop.registered_seats);
            const remaining = Number(workshop.remaining_seats);

            const percentage = total > 0
                ? Math.min((registered / total) * 100, 100)
                : 0;

            const full = Boolean(workshop.is_full);

            const safeTitle = String(workshop.workshop_title).replace(
                /[&<>"']/g,
                character => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                })[character]
            );

            return `
                <div class="dashboard-card seat-admin-card">
                    <h3>${safeTitle}</h3>

                    <p class="seat-admin-status ${full ? "full" : "available"}">
                        ${full ? "Workshop Full" : "Seats Available"}
                    </p>

                    <h2>${registered} / ${total}</h2>
                    <p>Registered / Total capacity</p>

                    <div class="seat-progress">
                        <div class="seat-progress-fill"
                             style="width: ${percentage}%"></div>
                    </div>

                    <h3>${remaining} seats remaining</h3>
                </div>
            `;

        }).join("");

    } catch (error) {

        console.error("Admin seat availability error:", error);

        container.innerHTML =
            "<p>Unable to load seat availability.</p>";

    }
}

loadAdminSeatAvailability();


// SHARED DYNAMIC WORKSHOP CARDS
// USED ON HOME PAGE AND WORKSHOPS PAGE

async function loadWorkshopCards(container, buttonText) {

    container.innerHTML = "<p>Loading available workshops...</p>";

    try {

        const { data: workshops, error } =
            await window.supabaseClient
                .from("workshops")
                .select("*")
                .eq("is_active", true)
                .order("date", { ascending: true });

        if (error) throw error;

        // REMOVE DUPLICATE WORKSHOP RECORDS BY ID

        const uniqueWorkshops = [
            ...new Map(
                (workshops || []).map(workshop => [
                    workshop.id,
                    workshop
                ])
            ).values()
        ];

        if (uniqueWorkshops.length === 0) {
            container.innerHTML =
                "<p>No workshops are currently available.</p>";
            return;
        }

        container.innerHTML = "";

        const originalImages = {
            1: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=700&q=80",
            2: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=700&q=80",
            3: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=700&q=80"
        };

        const originalTags = {
            1: "Health & Safety",
            2: "Digital Skills",
            3: "Personal Growth"
        };

        uniqueWorkshops.forEach(function (workshop) {

            const workshopId = Number(workshop.id);

            const card = document.createElement("div");
            card.className = "card";

            const image = document.createElement("img");
            image.className = "card-img";

            image.src =
                originalImages[workshopId] ||
                workshop.image_url ||
                "https://placehold.co/700x400?text=SkillConnect+Workshop";

            image.alt = workshop.title;

            const body = document.createElement("div");
            body.className = "card-body";

            const tag = document.createElement("span");
            tag.className = "tag";

            tag.textContent =
                originalTags[workshopId] || "Community Workshop";

            const title = document.createElement("h3");
            title.textContent = workshop.title;

            const description = document.createElement("p");
            description.textContent = workshop.description || "";

            const link = document.createElement("a");
            link.className = "card-link";
            link.textContent = buttonText;

            const detailPages = {
                1: "first-aid.html",
                2: "computer.html",
                3: "personality.html"
            };

            link.href = detailPages[workshopId] ||
                "workshop-details.html?id=" +
                encodeURIComponent(workshop.id);

            body.appendChild(tag);
            body.appendChild(title);
            body.appendChild(description);
            body.appendChild(link);

            card.appendChild(image);
            card.appendChild(body);

            container.appendChild(card);

        });

    } catch (error) {

        console.error("Workshop display error:", error);

        container.innerHTML =
            "<p>Unable to load workshops. Please refresh the page.</p>";

    }
}


// HOME PAGE

const homeWorkshopList =
    document.getElementById("homeWorkshopList");

if (homeWorkshopList) {
    loadWorkshopCards(homeWorkshopList, "Explore →");
}


// WORKSHOPS PAGE

const publicWorkshopList =
    document.getElementById("publicWorkshopList");

if (publicWorkshopList) {
    loadWorkshopCards(publicWorkshopList, "View Workshop →");
}


// DYNAMIC DETAILS FOR NEW WORKSHOPS

const detailsPage = document.getElementById("detailsContent");

if (detailsPage) {

    async function loadWorkshopDetails() {

        const params = new URLSearchParams(window.location.search);
        const workshopId = Number(params.get("id"));

        if (!workshopId) {
            document.getElementById("workshopTitle").textContent =
                "Workshop not found";
            return;
        }

        try {

            const { data: workshop, error } = await window.supabaseClient
                .from("workshops")
                .select("*")
                .eq("id", workshopId)
                .eq("is_active", true)
                .single();

            if (error) throw error;

            document.getElementById("workshopCategory").textContent =
                workshop.organizer || "COMMUNITY WORKSHOP";

            document.getElementById("workshopTitle").textContent =
                workshop.title;

            document.getElementById("workshopDescription").textContent =
                workshop.description || "";

            const image = document.getElementById("workshopImage");

            image.src = workshop.image_url ||
                "https://placehold.co/700x400?text=SkillConnect+Workshop";

            image.alt = workshop.title;

            document.getElementById("workshopLocation").textContent =
                workshop.location || "Location not specified";

            document.getElementById("workshopDate").textContent =
                workshop.date
                    ? new Date(workshop.date + "T00:00:00").toLocaleDateString(
                        "en-IN",
                        {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                        }
                    )
                    : "Date not announced";

            document.getElementById("workshopTime").textContent =
                `${workshop.start_time || "Time not announced"} - ${workshop.end_time || ""}`;

            const mapLink = document.getElementById("mapLink");

            mapLink.href =
                "https://www.google.com/maps/search/?api=1&query=" +
                encodeURIComponent(workshop.location || "");

            // DISPLAY WORKSHOP TOPICS

            const topicsContainer =
                document.getElementById("workshopTopics");

            topicsContainer.innerHTML = "";

            const topicDescriptions = {

                "Color Theory":
                    "Understand colour combinations and learn how different colours work together.",

                "Shading Techniques":
                    "Learn basic pencil shading methods to create depth, light and shadow in drawings.",

                "Color Illusion":
                    "Explore how colours and visual patterns create interesting optical effects."

            };

            if (workshop.topics && workshop.topics.length > 0) {

                workshop.topics.forEach(function (topic, index) {

                    const card = document.createElement("div");
                    card.className = "card";

                    const body = document.createElement("div");
                    body.className = "card-body";

                    const tag = document.createElement("span");
                    tag.className = "tag";
                    tag.textContent =
                        "Topic " + String(index + 1).padStart(2, "0");

                    const heading = document.createElement("h3");
                    heading.textContent = topic;

                    const description = document.createElement("p");

                    description.textContent =
                        topicDescriptions[topic] ||
                        "Explore this topic through simple explanations and practical activities.";

                    body.appendChild(tag);
                    body.appendChild(heading);
                    body.appendChild(description);

                    card.appendChild(body);
                    topicsContainer.appendChild(card);

                });

            } else {

                topicsContainer.textContent =
                    "Topics will be announced soon.";

            }

            // SET WORKSHOP ID FOR SEAT AVAILABILITY

            document.getElementById("workshopAvailability")
                .dataset.workshopId = workshop.id;

            await loadDynamicWorkshopAvailability(workshop.id);

            // REGISTRATION LINKS

            document.getElementById("registerButton").href =
                "register.html?workshop=" + workshop.id;

            document.getElementById("joinButton").href =
                "register.html?workshop=" + workshop.id;

        } catch (error) {

            console.error("Workshop details error:", error);

            document.getElementById("workshopTitle").textContent =
                "Workshop details unavailable";

            document.getElementById("workshopDescription").textContent =
                "This workshop may have been removed or is currently unavailable.";

        }

    }


    async function loadDynamicWorkshopAvailability(workshopId) {

        const { data, error } =
            await window.supabaseClient.rpc("get_workshop_availability");

        if (error) {
            document.getElementById("seatStatus").textContent =
                "Unable to load seat availability.";
            return;
        }

        const workshop = (data || []).find(
            item => Number(item.workshop_id) === Number(workshopId)
        );

        if (!workshop) {
            document.getElementById("seatStatus").textContent =
                "Workshop information unavailable.";
            return;
        }

        const registered = Number(workshop.registered_seats);
        const total = Number(workshop.total_seats);
        const remaining = Number(workshop.remaining_seats);

        const percentage = total > 0
            ? (registered / total) * 100
            : 0;

        document.getElementById("seatStatus").textContent =
            workshop.is_full ? "Workshop Full" : "Seats Available";

        document.getElementById("seatCount").textContent =
            `${registered} / ${total}`;

        document.getElementById("remainingSeats").textContent =
            workshop.is_full
                ? "No seats remaining"
                : `${remaining} seats remaining`;

        document.getElementById("seatProgress").style.width =
            `${percentage}%`;

    }

    loadWorkshopDetails();

}


// LOAD DATE FOR EXISTING STATIC WORKSHOP PAGES

document.addEventListener("DOMContentLoaded", async function () {

    // SKIP THE NEW DYNAMIC WORKSHOP DETAILS PAGE

    if (document.getElementById("detailsContent")) return;

    const dateElement = document.getElementById("workshopDate");
    const seatCard = document.getElementById("workshopAvailability");

    if (!dateElement || !seatCard || !window.supabaseClient) return;

    const workshopId = Number(seatCard.dataset.workshopId);

    const { data, error } = await window.supabaseClient
        .from("workshops")
        .select("date")
        .eq("id", workshopId)
        .single();

    if (error || !data || !data.date) {
        dateElement.textContent = "Date to be announced";
        return;
    }

    dateElement.textContent = new Date(data.date + "T00:00:00")
        .toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

});


// SCROLL REVEAL ANIMATION

document.addEventListener("DOMContentLoaded", function () {

    const revealSelector =
        ".section-head, .card, .cta-band, .workshop-schedule, .form-card";

    const observer = new IntersectionObserver(function (entries) {

        entries.forEach(function (entry) {

            if (entry.isIntersecting) {
                entry.target.classList.add("show");
                observer.unobserve(entry.target);
            }

        });

    }, {
        threshold: 0.15
    });

    function observeRevealElements(root) {

        if (root.matches && root.matches(revealSelector)) {

            if (!root.classList.contains("reveal")) {
                root.classList.add("reveal");
                observer.observe(root);
            }

        }

        root.querySelectorAll(revealSelector).forEach(function (element) {

            if (!element.classList.contains("reveal")) {
                element.classList.add("reveal");
                observer.observe(element);
            }

        });

    }

    // ANIMATE ELEMENTS ALREADY PRESENT

    observeRevealElements(document);

    // DETECT DYNAMICALLY LOADED WORKSHOP CARDS

    const mutationObserver = new MutationObserver(function (mutations) {

        mutations.forEach(function (mutation) {

            mutation.addedNodes.forEach(function (node) {

                if (node.nodeType === 1) {
                    observeRevealElements(node);
                }

            });

        });

    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

});


// ========================================
// SKILLCONNECT - ATTENDANCE HISTORY
// ========================================

(function () {

    const historyWorkshop = document.getElementById("historyWorkshop");
    const historyDateButtons = document.getElementById("historyDateButtons");
    const historyTableBody = document.getElementById("historyTableBody");
    const historyMessage = document.getElementById("historyMessage");

    const historyTotalCount = document.getElementById("historyTotalCount");
    const historyPresentCount = document.getElementById("historyPresentCount");
    const historyAbsentCount = document.getElementById("historyAbsentCount");

    const saveHistoryBtn = document.getElementById("saveHistoryBtn");
    const downloadHistoryBtn = document.getElementById("downloadHistoryBtn");

    let selectedHistoryDate = "";
    let selectedHistoryWorkshop = "";

    if (!historyWorkshop) return;


    // LOAD ALL WORKSHOPS INCLUDING DEACTIVATED ONES

    async function loadHistoryWorkshops() {

        const { data, error } = await window.supabaseClient
            .from("workshops")
            .select("id, title")
            .order("id", { ascending: true });

        if (error) {
            console.error("History workshop error:", error);

            historyWorkshop.innerHTML =
                '<option value="">Unable to load workshops</option>';

            return;
        }

        historyWorkshop.innerHTML =
            '<option value="">Choose Workshop</option>';

        data.forEach(workshop => {

            const option = document.createElement("option");
            option.value = workshop.id;
            option.textContent = workshop.title;

            historyWorkshop.appendChild(option);

        });

    }


    // LOAD AVAILABLE ATTENDANCE DATES

    async function loadHistoryDates(workshopId) {

        selectedHistoryWorkshop = workshopId;
        selectedHistoryDate = "";

        historyDateButtons.innerHTML = "<p>Loading dates...</p>";

        historyTableBody.innerHTML =
            '<tr><td colspan="2">Select an attendance date.</td></tr>';

        saveHistoryBtn.disabled = true;
        downloadHistoryBtn.disabled = true;

        historyTotalCount.textContent = "0";
        historyPresentCount.textContent = "0";
        historyAbsentCount.textContent = "0";

        const { data, error } = await window.supabaseClient
            .from("attendance_records")
            .select("attendance_date")
            .eq("workshop_id", Number(workshopId))
            .order("attendance_date", { ascending: false });

        if (error) {

            console.error("History dates error:", error);

            historyDateButtons.innerHTML =
                "<p>Unable to load attendance dates.</p>";

            historyMessage.textContent = error.message;

            return;
        }

        const dates = [...new Set(
            data.map(record => record.attendance_date)
        )];

        historyDateButtons.innerHTML = "";

        if (dates.length === 0) {

            historyDateButtons.innerHTML =
                "<p>No attendance history available for this workshop.</p>";

            return;
        }

        dates.forEach(date => {

            const button = document.createElement("button");

            button.type = "button";
            button.className = "btn btn-primary";

            const formattedDate = new Date(date + "T00:00:00")
                .toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                });

            button.textContent = formattedDate;
            button.style.margin = "5px";

            button.addEventListener("click", function () {
                loadHistoryForDate(date);
            });

            historyDateButtons.appendChild(button);

        });

        historyMessage.textContent =
            dates.length + " attendance date(s) available.";

    }


    // DISPLAY ATTENDANCE FOR SELECTED DATE

    async function loadHistoryForDate(date) {

        selectedHistoryDate = date;

        historyMessage.textContent = "Loading attendance history...";

        saveHistoryBtn.disabled = true;
        downloadHistoryBtn.disabled = true;

        const { data: participants, error: participantError } =
            await window.supabaseClient
                .from("registrations")
                .select("id, participant_name")
                .eq("workshop_id", Number(selectedHistoryWorkshop))
                .order("created_at", { ascending: true });

        if (participantError) {

            console.error(participantError);
            historyMessage.textContent = participantError.message;

            return;
        }

        const { data: records, error: recordsError } =
            await window.supabaseClient
                .from("attendance_records")
                .select("registration_id, status")
                .eq("workshop_id", Number(selectedHistoryWorkshop))
                .eq("attendance_date", date);

        if (recordsError) {

            console.error(recordsError);
            historyMessage.textContent = recordsError.message;

            return;
        }

        const recordMap = new Map(
            records.map(record => [
                Number(record.registration_id),
                record.status
            ])
        );

        historyTableBody.innerHTML = "";

        let present = 0;
        let absent = 0;

        participants.forEach(person => {

            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            nameCell.textContent = person.participant_name;

            const statusCell = document.createElement("td");

            const select = document.createElement("select");
            select.className = "history-attendance-status";
            select.dataset.participantId = person.id;

            const chooseOption = document.createElement("option");
            chooseOption.value = "";
            chooseOption.textContent = "Choose status";

            select.appendChild(chooseOption);

            ["Present", "Absent"].forEach(status => {

                const option = document.createElement("option");
                option.value = status;
                option.textContent = status;

                select.appendChild(option);

            });

            select.value = recordMap.get(Number(person.id)) || "";

            if (select.value === "Present") present++;
            if (select.value === "Absent") absent++;

            select.addEventListener("change", updateHistorySummary);

            statusCell.appendChild(select);

            row.appendChild(nameCell);
            row.appendChild(statusCell);

            historyTableBody.appendChild(row);

        });

        historyTotalCount.textContent = participants.length;
        historyPresentCount.textContent = present;
        historyAbsentCount.textContent = absent;

        saveHistoryBtn.disabled = participants.length === 0;
        downloadHistoryBtn.disabled = participants.length === 0;

        const formattedDate = new Date(date + "T00:00:00")
            .toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });

        historyMessage.textContent =
            "Attendance history loaded for " + formattedDate + ".";

    }


    // UPDATE HISTORY SUMMARY

    function updateHistorySummary() {

        const selects = historyTableBody.querySelectorAll(
            ".history-attendance-status"
        );

        let present = 0;
        let absent = 0;

        selects.forEach(select => {

            if (select.value === "Present") present++;
            if (select.value === "Absent") absent++;

        });

        historyTotalCount.textContent = selects.length;
        historyPresentCount.textContent = present;
        historyAbsentCount.textContent = absent;

    }


    // SAVE EDITED HISTORICAL ATTENDANCE

    saveHistoryBtn.addEventListener("click", async function () {

        const selects = historyTableBody.querySelectorAll(
            ".history-attendance-status"
        );

        if (!selectedHistoryDate || !selectedHistoryWorkshop ||
            selects.length === 0) {
            return;
        }

        const incomplete = Array.from(selects).some(
            select => !select.value
        );

        if (incomplete) {

            historyMessage.textContent =
                "Please choose Present or Absent for every participant.";

            return;
        }

        saveHistoryBtn.disabled = true;
        historyMessage.textContent = "Saving changes...";

        const records = Array.from(selects).map(select => ({

            registration_id: Number(select.dataset.participantId),
            workshop_id: Number(selectedHistoryWorkshop),
            attendance_date: selectedHistoryDate,
            status: select.value,
            updated_at: new Date().toISOString()

        }));

        const { error } = await window.supabaseClient
            .from("attendance_records")
            .upsert(records, {
                onConflict: "registration_id,workshop_id,attendance_date"
            });

        saveHistoryBtn.disabled = false;

        if (error) {

            console.error(error);
            historyMessage.textContent = error.message;

            return;
        }

        historyMessage.textContent =
            "Historical attendance updated successfully!";

        updateHistorySummary();

    });


    // WORKSHOP SELECTION EVENT

    historyWorkshop.addEventListener("change", function () {

        if (!this.value) {

            selectedHistoryWorkshop = "";
            selectedHistoryDate = "";

            historyDateButtons.innerHTML =
                "<p>Select a workshop to view available dates.</p>";

            historyTableBody.innerHTML =
                '<tr><td colspan="2">Select a workshop and attendance date.</td></tr>';

            historyTotalCount.textContent = "0";
            historyPresentCount.textContent = "0";
            historyAbsentCount.textContent = "0";

            saveHistoryBtn.disabled = true;
            downloadHistoryBtn.disabled = true;

            return;
        }

        loadHistoryDates(this.value);

    });

    loadHistoryWorkshops();


    // DOWNLOAD ATTENDANCE HISTORY PDF

    downloadHistoryBtn.addEventListener("click", function () {

        if (!selectedHistoryDate || !selectedHistoryWorkshop) {

            historyMessage.textContent =
                "Please select an attendance date first.";

            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {

            historyMessage.textContent =
                "PDF library could not load. Please check your internet connection.";

            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const workshopName =
            historyWorkshop.options[
                historyWorkshop.selectedIndex
            ].text;

        const formattedDate = new Date(
            selectedHistoryDate + "T00:00:00"
        ).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        const selects = historyTableBody.querySelectorAll(
            ".history-attendance-status"
        );

        const participants = Array.from(selects);

        if (participants.length === 0) {

            historyMessage.textContent =
                "No attendance records available.";

            return;
        }

        const incomplete = participants.some(
            select => !select.value
        );

        if (incomplete) {

            historyMessage.textContent =
                "Please complete all attendance statuses before downloading.";

            return;
        }

        const total = participants.length;

        const present = participants.filter(
            select => select.value === "Present"
        ).length;

        const absent = participants.filter(
            select => select.value === "Absent"
        ).length;

        const percentage = total > 0
            ? ((present / total) * 100).toFixed(1)
            : "0.0";

        // REPORT HEADING

        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");

        doc.text("SkillConnect", 105, 20, {
            align: "center"
        });

        doc.setFontSize(14);

        doc.text("Workshop Attendance Report", 105, 30, {
            align: "center"
        });

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");

        doc.text("Workshop: " + workshopName, 15, 45);
        doc.text("Attendance Date: " + formattedDate, 15, 53);

        // SUMMARY

        doc.setFont("helvetica", "bold");
        doc.text("Attendance Summary", 15, 68);

        doc.setFont("helvetica", "normal");

        doc.text("Total Participants: " + total, 15, 78);
        doc.text("Present: " + present, 15, 86);
        doc.text("Absent: " + absent, 15, 94);
        doc.text("Attendance Percentage: " + percentage + "%", 15, 102);

        // PARTICIPANT TABLE

        let y = 120;

        doc.setFont("helvetica", "bold");

        doc.text("Sl. No.", 15, y);
        doc.text("Participant Name", 40, y);
        doc.text("Attendance Status", 145, y);

        doc.line(15, y + 3, 195, y + 3);

        y += 12;

        doc.setFont("helvetica", "normal");

        participants.forEach((select, index) => {

            if (y > 275) {
                doc.addPage();
                y = 20;
            }

            const row = select.closest("tr");

            const participantName =
                row.cells[0].textContent.trim();

            doc.text(String(index + 1), 15, y);
            doc.text(participantName, 40, y);
            doc.text(select.value, 145, y);

            y += 10;

        });

        // FOOTER

        doc.setFontSize(9);

        doc.text(
            "Generated by SkillConnect Workshop Management System",
            105,
            290,
            { align: "center" }
        );

        // DOWNLOAD

        const safeName = workshopName.replace(
            /[^a-z0-9]/gi,
            "_"
        );

        doc.save(
            "SkillConnect_" + safeName + "_" +
            selectedHistoryDate + ".pdf"
        );

        historyMessage.textContent =
            "Attendance PDF downloaded successfully!";

    });

})();
