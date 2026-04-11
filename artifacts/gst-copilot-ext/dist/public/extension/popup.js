// ================= CONFIG =================
const API_BASE = "https://gstcopilot-backend-1.onrender.com/api/validate-gstin/";
const LICENSE_API = "https://gstcopilot-backend-1.onrender.com/api/verify-license";
const FREE_LIMIT = 5;

// ================= STATE =================
let checksUsed = parseInt(localStorage.getItem("gst_checks_used") || "0");

// ================= HELPERS =================
function showToast(msg) {
  const el = document.getElementById("toast");
  el.innerText = msg;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 2000);
}

function updateLimitUI() {
  const hasLicense = localStorage.getItem("gst_license_key");
  if (hasLicense) return;

  const left = Math.max(0, FREE_LIMIT - checksUsed);
  showToast(left + " free checks left");
}

function consumeCheck() {
  checksUsed++;
  localStorage.setItem("gst_checks_used", checksUsed.toString());
}

function canUse() {
  return checksUsed < FREE_LIMIT || localStorage.getItem("gst_license_key");
}

// ================= GST FETCH =================
async function fetchGST(gstin) {
  const licenseKey = localStorage.getItem("gst_license_key") || "free_user";

  const res = await fetch(API_BASE + gstin, {
    headers: {
      "x-license-key": licenseKey
    }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");

  return data;
}

// ================= VALIDATE =================
async function validateGSTIN() {
  const gstin = document.getElementById("gstin-input").value.trim().toUpperCase();

  if (!gstin) return showToast("Enter GSTIN");

  if (!canUse()) return showToast("Limit reached");

  try {
    const data = await fetchGST(gstin);

    document.getElementById("results").style.display = "block";
    document.getElementById("res-gstin").innerText = data.gstin;
    document.getElementById("res-name").innerText = data.legalName;
    document.getElementById("res-status").innerText = data.status;
    document.getElementById("res-state").innerText = data.state;
    document.getElementById("res-date").innerText = data.registrationDate;

    consumeCheck();

  } catch (err) {
    showToast(err.message);
  }
}

// ================= LICENSE =================
async function verifyLicense() {
  const key = document.getElementById("license-input").value.trim();

  if (!key) return showToast("Enter license");

  try {
    const res = await fetch(LICENSE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });

    const data = await res.json();

    if (!data.ok) return showToast("Invalid license");

    localStorage.setItem("gst_license_key", key);
    showToast("Pro Activated");

  } catch {
    showToast("Server error");
  }
}

// ================= EXTRACT =================
function extractFromPage() {
  showToast("Coming soon");
}

// ================= EVENTS =================
document.addEventListener("DOMContentLoaded", () => {

  document.getElementById("validate-btn")
    ?.addEventListener("click", validateGSTIN);

  document.getElementById("license-btn")
    ?.addEventListener("click", verifyLicense);

  document.getElementById("extract-btn")
    ?.addEventListener("click", extractFromPage);

});
