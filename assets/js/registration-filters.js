
document.addEventListener("DOMContentLoaded", function () {

    const tableBody = document.getElementById("registrationTableBody");
    const searchInput = document.getElementById("registrationSearch");
    const workshopFilter = document.getElementById("registrationWorkshopFilter");
    const statusFilter = document.getElementById("registrationStatusFilter");
    const clearButton = document.getElementById("clearRegistrationFilters");

    if (
        !tableBody ||
        !searchInput ||
        !workshopFilter ||
        !statusFilter ||
        !clearButton
    ) {
        return;
    }

    // Populate workshop filter using the workshops in the table
    function populateWorkshopOptions() {

        const previousSelection = workshopFilter.value;

        
const workshops = [
    ...new Set(
        [...tableBody.querySelectorAll("tr")]
            .filter(row => row.cells.length >= 6)
            .map(row => row.cells[3].textContent.trim())
            .filter(name => name && name !== "Unknown Workshop")
    )
].sort();


        workshopFilter.innerHTML = '<option value="">All Workshops</option>';

        workshops.forEach(function (workshop) {

            const option = document.createElement("option");
            option.value = workshop;
            option.textContent = workshop;

            workshopFilter.appendChild(option);
        });

        if (workshops.includes(previousSelection)) {
            workshopFilter.value = previousSelection;
        }
    }

    // Check whether a row contains an actual registration
    // Apply search and filters without rebuilding the table
    function applyRegistrationFilters() {

        const searchText = searchInput.value.trim().toLowerCase();
        const selectedWorkshop = workshopFilter.value;
        const selectedStatus = statusFilter.value;

        const rows = [...tableBody.querySelectorAll("tr")];

        rows.forEach(function (row) {

            // Keep loading and empty-state messages visible
            if (!row.cells || row.cells.length < 6) {
                row.style.display = "";
                return;
            }

            const registrationId = row.cells[0].textContent.toLowerCase();
            const participantName = row.cells[1].textContent.toLowerCase();
            const email = row.cells[2].textContent.toLowerCase();
            const workshop = row.cells[3].textContent.trim();
            const status = row.cells[4].textContent.trim();

            const matchesSearch =
                !searchText ||
                registrationId.includes(searchText) ||
                participantName.includes(searchText) ||
                email.includes(searchText);

            const matchesWorkshop =
                !selectedWorkshop || workshop === selectedWorkshop;

            const matchesStatus =
                !selectedStatus || status === selectedStatus;

            row.style.display =
                matchesSearch && matchesWorkshop && matchesStatus
                    ? ""
                    : "none";
        });
    }

    function refreshRegistrationFilters() {
        populateWorkshopOptions();
        applyRegistrationFilters();
    }

    // Search while typing
    searchInput.addEventListener("input", applyRegistrationFilters);

    // Workshop and status filters
    workshopFilter.addEventListener("change", applyRegistrationFilters);
    statusFilter.addEventListener("change", applyRegistrationFilters);

    // Clear all filters
    clearButton.addEventListener("click", function () {

        searchInput.value = "";
        workshopFilter.value = "";
        statusFilter.value = "";

        applyRegistrationFilters();
    });

    // Watch for registrations being loaded or refreshed
    const observer = new MutationObserver(function () {
        refreshRegistrationFilters();
    });

    observer.observe(tableBody, {
        childList: true,
        subtree: true
    });

    refreshRegistrationFilters();

});
