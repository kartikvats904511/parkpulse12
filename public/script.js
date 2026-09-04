// ==========================================
// PARK PULSE FRONTEND CONNECTION
// ==========================================

// ===============================
// SUBMIT FORM
// ===============================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('Service Worker registered'))
    .catch((err) => console.log('SW registration failed:', err));
}
document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("park-form");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');

        const name = document.getElementById("name")?.value || "";
        const phone = document.getElementById("phone")?.value || "";
        const email = document.getElementById("email")?.value || "";
        const dob = document.getElementById("dob")?.value || "";
        const gender = document.getElementById("gender")?.value || "";
        const slotId = document.getElementById("slotId")?.value || "";
        const vehicleDistance = document.getElementById("vehicleDistance")?.value || "";
        const liveStatus = document.getElementById("liveStatus")?.value || "";
        const comments = document.getElementById("comments")?.value || "";
        const likeApp = document.getElementById("likeApp")?.checked || false;

        const vehicleInput = document.querySelector('input[name="vehicle"]:checked');
        const vehicle = vehicleInput ? vehicleInput.value : "";

        const subscriptionInput = document.querySelector('input[name="subscription"]:checked');
        const subscription = subscriptionInput ? subscriptionInput.value : "";

        const capacityInput = document.querySelector('input[name="CAPACITY"]:checked');
        const capacity = capacityInput ? capacityInput.value : "";

        const terms = document.getElementById("terms");
        const termsAccepted = terms ? terms.checked : false;

        if (!name) {
            alert("Please enter your name.");
            return;
        }

        if (!phone) {
            alert("Please enter your phone number.");
            return;
        }

        if (!email) {
            alert("Please enter your email.");
            return;
        }

        if (!termsAccepted) {
            alert("Please accept the terms and conditions.");
            return;
        }

        const userData = {
            name, phone, email, dob, gender, slotId, vehicleDistance,
            liveStatus, vehicle, subscription, capacity, comments,
            likeApp, termsAccepted,
        };

        try {

            submitButton.disabled = true;
            submitButton.innerText = "Saving...";

            const response = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Server error");
            }

            alert("✅ Park Pulse data saved successfully!");
            console.log("Backend response:", result);

            if (slotId && vehicle && liveStatus) {
                await fetch("/api/parking", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        slot: slotId,
                        vehicle: vehicle.toUpperCase(),
                        status: liveStatus.toLowerCase(),
                    }),
                });
            }

            loadParking();
            loadDashboard();

        } catch (error) {

            console.error(error);
            alert("❌ Could not connect to backend.\n\n" + error.message);

        } finally {

            submitButton.disabled = false;
            submitButton.innerText = "Submit";

        }

    });

});

// ==========================================
// INTERACTIVE PARKING SLOT PICKER
// ==========================================

const CANCEL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

let selectedSlot = null;
let latestParkingData = [];

function getSelectedVehiclePrice() {
    const select = document.getElementById("slot-vehicle-type");
    if (!select) {
        return { vehicle: "car", price: 40 };
    }
    const option = select.options[select.selectedIndex];
    return {
        vehicle: select.value,
        price: Number(option.dataset.price) || 0,
    };
}

async function loadParking() {

    try {

        const response = await fetch("/api/parking");
        const result = await response.json();

        latestParkingData = result.data;

        const grid = document.getElementById("parking-grid");

        if (grid) {

            grid.innerHTML = "";

            result.data.forEach(parking => {

                const isOccupied = parking.status === "occupied";
                const isSelected = parking.slot === selectedSlot;

                const card = document.createElement("div");
                card.className =
                    "parking-slot" +
                    (isOccupied ? " occupied" : "") +
                    (isSelected ? " selected" : "");

                card.innerHTML = `
                    <div class="slot-name">${parking.slot}</div>
                    <div class="slot-status">${isSelected ? "Selected" : parking.status}</div>
                `;

                if (!isOccupied) {
                    card.addEventListener("click", () => selectSlot(parking.slot));
                }

                grid.appendChild(card);

            });

        }

        updateBookingBox();
        renderBookingsList();

    } catch (error) {
        console.error("Parking loading error:", error);
    }

}

function selectSlot(slot) {
    selectedSlot = slot;
    loadParking();
}

function updateBookingBox() {

    const bookingBox = document.getElementById("booking-box");
    const bookingText = document.getElementById("booking-text");
    const bookingPrice = document.getElementById("booking-price");

    if (!bookingBox || !bookingText) {
        return;
    }

    if (selectedSlot) {
        const { vehicle, price } = getSelectedVehiclePrice();
        bookingBox.style.display = "block";
        bookingText.innerText = `Slot ${selectedSlot} selected (${vehicle.toUpperCase()}).`;
        if (bookingPrice) {
            bookingPrice.innerText = `₹${price}/hour`;
        }
    } else {
        bookingBox.style.display = "none";
    }

}

function renderBookingsList() {

    const list = document.getElementById("bookings-list");

    if (!list) {
        return;
    }

    const myBookings = latestParkingData.filter(p => p.bookedAt);

    if (myBookings.length === 0) {
        list.innerHTML = `<p class="no-bookings">No active bookings yet — select a slot above to book one.</p>`;
        return;
    }

    list.innerHTML = "";

    myBookings.forEach(booking => {

        const elapsed = Date.now() - booking.bookedAt;
        const canCancel = elapsed <= CANCEL_WINDOW_MS;
        const bookedTimeText = new Date(booking.bookedAt).toLocaleTimeString();

        const item = document.createElement("div");
        item.className = "booking-item" + (canCancel ? "" : " expired");

        item.innerHTML = `
            <div class="booking-item-info">
                <strong>Slot ${booking.slot} — ${(booking.vehicle || "").toUpperCase()}</strong>
                <span>₹${booking.price || 0}/hour · Booked at ${bookedTimeText}</span>
            </div>
            <button class="cancel-btn" type="button" ${canCancel ? "" : "disabled"}>
                ${canCancel ? "Cancel" : "Window expired"}
            </button>
        `;

        const cancelBtn = item.querySelector("button");

        cancelBtn.addEventListener("click", () => cancelBooking(booking.slot));

        list.appendChild(item);

    });

}

async function cancelBooking(slot) {

    const reallyWantsToCancel = confirm(
        `Do you really want to cancel this booking? (Slot ${slot})`
    );

    if (!reallyWantsToCancel) {
        return;
    }

    try {

        const response = await fetch("/api/parking/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slot }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            alert("❌ " + (result.message || "Could not cancel this booking."));
            return;
        }

        alert(`Booking for slot ${slot} has been cancelled.`);

        loadParking();
        loadDashboard();

    } catch (error) {
        console.error(error);
        alert("❌ Could not connect to backend.");
    }

}

document.addEventListener("DOMContentLoaded", () => {

    const confirmBtn = document.getElementById("confirm-book-btn");
    const cancelSelectBtn = document.getElementById("cancel-select-btn");
    const vehicleTypeSelect = document.getElementById("slot-vehicle-type");

    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {

            if (!selectedSlot) {
                return;
            }

            const { vehicle, price } = getSelectedVehiclePrice();

            try {

                confirmBtn.disabled = true;
                confirmBtn.innerText = "Booking...";

                const response = await fetch("/api/parking/book", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slot: selectedSlot, vehicle, price }),
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    alert("❌ " + (result.message || "Could not book this slot."));
                    return;
                }

                alert(`✅ Yes! Your slot ${selectedSlot} has been booked successfully.\nVehicle: ${vehicle.toUpperCase()}\nPrice: ₹${price}/hour`);

                selectedSlot = null;
                loadParking();
                loadDashboard();

            } catch (error) {
                console.error(error);
                alert("❌ Could not connect to backend.");
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerText = "Submit & Book";
            }

        });
    }

    if (cancelSelectBtn) {
        cancelSelectBtn.addEventListener("click", () => {
            selectedSlot = null;
            loadParking();
        });
    }

    if (vehicleTypeSelect) {
        vehicleTypeSelect.addEventListener("change", updateBookingBox);
    }

});

// ==========================================
// LOAD DASHBOARD
// ==========================================

async function loadDashboard() {

    try {

        const response = await fetch("/api/dashboard");
        const data = await response.json();

        const progress = document.querySelector(".progress-bar");
        const progressText = document.querySelector(".progress-bar span");
        const description = document.querySelector(".progress-section p");

        if (progress) {
            progress.style.width = data.occupancy + "%";
        }

        if (progressText) {
            progressText.innerText = data.occupancy + "%";
        }

        if (description) {
            description.innerText = data.occupancy + "% Slots Occupied";
        }

    } catch (error) {
        console.error("Dashboard error:", error);
    }

}

// ==========================================
// LOGIN
// ==========================================

async function login() {

    const phone = prompt("Enter your phone number:");

    if (!phone) {
        return;
    }

    try {

        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message);
            return;
        }

        alert("Your OTP is: " + result.otp);

        const otp = prompt("Enter OTP:");

        if (!otp) {
            return;
        }

        const verifyResponse = await fetch("/api/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, otp }),
        });

        const verification = await verifyResponse.json();

        if (verification.success) {
            alert("✅ Login successful!");
        } else {
            alert("❌ " + verification.message);
        }

    } catch (error) {
        console.error(error);
        alert("Backend connection failed.");
    }

}

window.login = login;

// ==========================================
// START
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    loadParking();
    loadDashboard();
});

// ==========================================
// AUTO UPDATE EVERY 10 SECONDS
// ==========================================

setInterval(() => {
    loadParking();
    loadDashboard();
}, 10000);