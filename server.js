// ==========================================
// PARK PULSE BACKEND (server.js)
// ==========================================

const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Parse incoming JSON request bodies (needed for POST requests)
app.use(express.json());

// Serve everything inside /public as static files (index.html, script.js, css, images)
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// IN-MEMORY "DATABASE"
// (resets every time the server restarts — swap for a real DB later)
// ==========================================

let users = [];

let parkingSlots = [
  { slot: "A1", status: "occupied" },
  { slot: "A2", status: "occupied" },
  { slot: "A3", status: "vacant" },
  { slot: "A4", status: "occupied" },
  { slot: "A5", status: "vacant" },
  { slot: "A6", status: "occupied" },
  { slot: "A7", status: "vacant" },
  { slot: "A8", status: "occupied" },
  { slot: "A9", status: "vacant" },
  { slot: "A10", status: "occupied" },
  { slot: "A11", status: "vacant" },
  { slot: "A12", status: "vacant" },
];

// phone -> otp, used only during login
let otpStore = {};

// ==========================================
// USERS
// ==========================================

// Save a new user (from the big signup/parking form)
app.post("/api/users", (req, res) => {
  const {
    name, phone, email, dob, gender, slotId, vehicleDistance,
    liveStatus, vehicle, subscription, capacity, comments, termsAccepted,
  } = req.body;

  if (!name || !phone || !email) {
    return res.status(400).json({ message: "Name, phone and email are required." });
  }

  const newUser = {
    id: users.length + 1,
    name, phone, email, dob, gender, slotId, vehicleDistance,
    liveStatus, vehicle, subscription, capacity, comments, termsAccepted,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  res.json({ message: "User saved successfully", user: newUser });
});

// (Optional) list all users - handy for debugging
app.get("/api/users", (req, res) => {
  res.json({ data: users });
});

// ==========================================
// PARKING
// ==========================================

// Get current parking table
app.get("/api/parking", (req, res) => {
  res.json({ data: parkingSlots });
});

// Update / add a slot's status
app.post("/api/parking", (req, res) => {
  const { slot, vehicle, status } = req.body;

  if (!slot || !status) {
    return res.status(400).json({ message: "slot and status are required." });
  }

  const existing = parkingSlots.find(p => p.slot === slot);

  if (existing) {
    existing.vehicle = vehicle || existing.vehicle;
    existing.status = status;
  } else {
    parkingSlots.push({ slot, vehicle: vehicle || "-", status });
  }

  res.json({ message: "Parking slot updated", data: parkingSlots });
});

const CANCEL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Book a specific vacant slot
app.post("/api/parking/book", (req, res) => {
  const { slot, vehicle, price } = req.body;

  const target = parkingSlots.find(p => p.slot === slot);

  if (!target) {
    return res.status(404).json({ success: false, message: "Slot not found." });
  }

  if (target.status === "occupied") {
    return res.status(400).json({ success: false, message: "This slot is already occupied." });
  }

  target.status = "occupied";
  target.vehicle = vehicle || "-";
  target.price = Number(price) || 0;
  target.bookedAt = Date.now();

  res.json({ success: true, message: `Slot ${slot} booked successfully!`, data: parkingSlots });
});

// Cancel a booking — only allowed within 5 minutes of booking it
app.post("/api/parking/cancel", (req, res) => {
  const { slot } = req.body;

  const target = parkingSlots.find(p => p.slot === slot);

  if (!target) {
    return res.status(404).json({ success: false, message: "Slot not found." });
  }

  if (!target.bookedAt) {
    return res.status(400).json({ success: false, message: "This slot wasn't booked through the app." });
  }

  const elapsed = Date.now() - target.bookedAt;

  if (elapsed > CANCEL_WINDOW_MS) {
    return res.status(400).json({
      success: false,
      message: "Cancellation window (5 minutes) has expired for this booking.",
    });
  }

  target.status = "vacant";
  delete target.vehicle;
  delete target.price;
  delete target.bookedAt;

  res.json({ success: true, message: `Booking for slot ${slot} cancelled.`, data: parkingSlots });
});

// ==========================================
// DASHBOARD (occupancy % for the progress bar)
// ==========================================

app.get("/api/dashboard", (req, res) => {
  const total = parkingSlots.length;
  const occupiedCount = parkingSlots.filter(p => p.status === "occupied").length;
  const occupancy = total === 0 ? 0 : Math.round((occupiedCount / total) * 100);

  res.json({
    occupancy,
    total,
    occupied: occupiedCount,
    available: total - occupiedCount,
  });
});

// ==========================================
// LOGIN (simple OTP flow, for development only)
// ==========================================

app.post("/api/login", (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: "Phone number required." });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = otp;

  // NOTE: In production you would SMS this, never return it in the response.
  res.json({ success: true, message: "OTP generated", otp });
});

app.post("/api/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: "Phone and OTP required." });
  }

  if (otpStore[phone] && otpStore[phone] === otp) {
    delete otpStore[phone];
    return res.json({ success: true, message: "Login successful" });
  }

  res.status(401).json({ success: false, message: "Invalid OTP" });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Park Pulse server running at http://localhost:${PORT}`);
});