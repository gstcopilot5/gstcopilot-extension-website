// ================= CONFIG =================
const API_BASE = "https://gstcopilot-backend-1.onrender.com/api/validate-gstin/";
const LICENSE_API = "https://gstcopilot-backend-1.onrender.com/api/verify-license";
const FREE_LIMIT = 5;

// ================= STATE =================
let checksUsed = parseInt(localStorage.getItem("gst_checks_used") || "0");

// ================= HELPERS =================
function isValidGSTIN(gstin) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/.test(gstin);
}

function showToast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.innerText = msg;
  el.className = "toast show " + type;
  setTimeout(() => el.classList.remove("show"), 2500);
}

function updateLimitUI() {
  const el = document.getElementById("checks-counter");
  if (!el) return;

  const hasLicense = localStorage.getItem("gst_license_key");
  if (hasLicense) {
    el.innerText = "Pro Unlimited";
    return;
  }

  const left = Math.max(0, FREE_LIMIT - checksUsed);
  el.innerText = `${left} free checks left`;
}

function consumeCheck() {
  checksUsed++;
  localStorage.setItem("gst_checks_used", checksUsed.toString());
  updateLimitUI();
}

function canUse() {
  return checksUsed < FREE_LIMIT || localStorage.getItem("gst_license_key");
}

// ================= API =================
async function fetchGST(gstin) {
  const licenseKey = localStorage.getItem("gst_license_key") || "free_user";

  const res = await fetch(API_BASE + gstin, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-license-key": licenseKey
    }
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "API error");
  }

  return res.json();
}

// ================= VALIDATE =================
async function validateGSTIN() {
  const gstin = document.getElementById("gstin-input").value.trim().toUpperCase();

  if (!gstin) return showToast("Enter GSTIN", "error");
  if (!isValidGSTIN(gstin)) return showToast("Invalid GSTIN", "error");

  if (!canUse()) {
    showToast("Free limit reached. Upgrade to Pro.", "error");
    return;
  }

  const btn = document.getElementById("validate-btn");
  btn.disabled = true;
  btn.innerText = "Validating...";

  try {
    const data = await fetchGST(gstin);

    showResult({
      gstin,
      name: data.legalName || data.tradeName || "N/A",
      status: data.status || "Active",
      state: data.state || "N/A",
      regDate: data.registrationDate || "N/A"
    });

    consumeCheck();

  } catch (err) {
    showToast(err.message || "Error", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Validate";
  }
}

// ================= RESULT =================
function showResult(data) {
  document.getElementById("results").style.display = "block";

  document.getElementById("res-gstin").innerText = data.gstin;
  document.getElementById("res-name").innerText = data.name;
  document.getElementById("res-status").innerText = data.status;
  document.getElementById("res-state").innerText = data.state;
  document.getElementById("res-date").innerText = data.regDate;
}

// ================= LICENSE =================
async function verifyLicense() {
  const key = document.getElementById("license-input").value.trim();

  if (!key) return showToast("Enter license key", "error");

  try {
    const res = await fetch(LICENSE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ key })
    });

    const data = await res.json();

    if (!res.ok) {
      return showToast("Invalid license", "error");
    }

    localStorage.setItem("gst_license_key", key);

    showToast("Pro Activated", "success");
    updateLimitUI();

  } catch {
    showToast("Server error", "error");
  }
}

// ================= EVENTS =================
document.addEventListener("DOMContentLoaded", () => {
  updateLimitUI();

  document.getElementById("validate-btn")
    ?.addEventListener("click", validateGSTIN);

  document.getElementById("gstin-input")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") validateGSTIN();
    });

  document.getElementById("license-btn")
    ?.addEventListener("click", verifyLicense);
});
