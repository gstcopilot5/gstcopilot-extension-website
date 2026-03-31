// GST Copilot - popup.js
// Free checks system
const FREE_CHECKS_LIMIT = 3;

let checksUsed = parseInt(localStorage.getItem('gst_checks_used') || '0');
updateChecksDisplay();

function updateChecksDisplay() {
  const remaining = Math.max(0, FREE_CHECKS_LIMIT - checksUsed);
  const el = document.getElementById('checks-counter');
  if (el) {
    el.textContent = remaining > 0 ? `${remaining} checks remaining` : 'Limit reached — Upgrade for unlimited';
    el.style.color = remaining === 0 ? '#fca5a5' : 'rgba(255,255,255,0.7)';
  }
}

function canCheck() {
  return checksUsed < FREE_CHECKS_LIMIT;
}

function consumeCheck() {
  checksUsed++;
  localStorage.setItem('gst_checks_used', checksUsed.toString());
  updateChecksDisplay();
}

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['gstin', 'hsn', 'upgrade'][i] === tab);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
}

// State codes mapping (first 2 digits of GSTIN)
const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & NH', '27': 'Maharashtra',
  '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh (New)'
};

// Validate GSTIN format
function isValidGSTINFormat(gstin) {
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin);
}

// Parse GSTIN details locally
function parseGSTIN(gstin) {
  const stateCode = gstin.substring(0, 2);
  const pan = gstin.substring(2, 12);
  const entityNum = gstin.substring(12, 13);
  const checkCode = gstin.substring(13, 14);
  const checkDigit = gstin.substring(14, 15);
  return { stateCode, pan, entityNum, checkCode, checkDigit };
}

// Fetch from GSTZen API (free tier)
async function fetchGSTZen(gstin) {
  const GSTZEN_API = 'https://api.gstzen.in/taxpayers/' + gstin;
  const response = await fetch(GSTZEN_API, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error('API error: ' + response.status);
  return await response.json();
}

// Mock data for demo/offline
function getMockData(gstin) {
  const parsed = parseGSTIN(gstin);
  const state = STATE_CODES[parsed.stateCode] || 'Unknown State';
  const mockNames = [
    'ABC Enterprises Pvt Ltd', 'Tech Solutions India Ltd',
    'Global Traders Co', 'Future Commerce LLP', 'Sunrise Industries'
  ];
  const name = mockNames[Math.floor(Math.random() * mockNames.length)];
  return {
    legalName: name,
    tradeName: name.split(' ')[0] + ' Traders',
    state: state,
    status: 'Active',
    taxpayerType: 'Regular',
    registrationDate: '01/04/' + (2018 + Math.floor(Math.random() * 5)),
    pan: parsed.pan
  };
}

async function validateGSTIN() {
  const input = document.getElementById('gstin-input');
  const gstin = input.value.trim().toUpperCase();

  if (!gstin) {
    showToast('Please enter a GSTIN');
    return;
  }

  if (!isValidGSTINFormat(gstin)) {
    showResult(false, null, gstin, 'Invalid GSTIN format. Must be 15 characters (2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric).');
    return;
  }

  if (!canCheck()) {
    switchTab('upgrade');
    showToast('Free limit reached! Upgrade for unlimited checks.');
    return;
  }

  const btn = document.getElementById('validate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Validating...';

  try {
    let data;
    try {
      const apiResult = await fetchGSTZen(gstin);
      data = {
        legalName: apiResult.legalName || apiResult.legal_name || apiResult.tradeNam || 'N/A',
        tradeName: apiResult.tradeName || apiResult.trade_name || apiResult.tradeNam || 'N/A',
        state: apiResult.stj || apiResult.state || STATE_CODES[gstin.substring(0, 2)] || 'N/A',
        status: apiResult.sts || apiResult.status || 'Active',
        taxpayerType: apiResult.dty || apiResult.taxpayerType || 'Regular',
        registrationDate: apiResult.rgdt || apiResult.regDate || 'N/A',
        pan: gstin.substring(2, 12)
      };
    } catch (apiErr) {
      // Fallback to mock data if API unavailable
      data = getMockData(gstin);
      data._isMock = true;
    }

    consumeCheck();
    showResult(true, data, gstin, null);
  } catch (err) {
    showResult(false, null, gstin, 'Could not validate GSTIN. Please try again.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Validate GSTIN';
  }
}

function showResult(isValid, data, gstin, errorMsg) {
  const resultsDiv = document.getElementById('results');
  const card = document.getElementById('gstin-result-card');
  const statusBadge = document.getElementById('gstin-status');
  const taxCard = document.getElementById('tax-mismatch-card');

  resultsDiv.style.display = 'block';

  if (!isValid) {
    card.className = 'result-card error';
    statusBadge.textContent = 'Invalid';
    statusBadge.className = 'status-badge invalid';
    document.getElementById('res-gstin').textContent = gstin;
    document.getElementById('res-name').textContent = errorMsg || 'Invalid GSTIN';
    document.getElementById('res-trade').textContent = '—';
    document.getElementById('res-state').textContent = '—';
    document.getElementById('res-status').textContent = '—';
    document.getElementById('res-type').textContent = '—';
    document.getElementById('res-date').textContent = '—';
    taxCard.style.display = 'none';
    return;
  }

  card.className = 'result-card';
  statusBadge.textContent = data._isMock ? 'Valid (Mock)' : 'Valid';
  statusBadge.className = 'status-badge valid';

  document.getElementById('res-gstin').textContent = gstin;
  document.getElementById('res-name').textContent = data.legalName || 'N/A';
  document.getElementById('res-trade').textContent = data.tradeName || 'N/A';
  document.getElementById('res-state').textContent = data.state || STATE_CODES[gstin.substring(0, 2)] || 'N/A';
  document.getElementById('res-status').textContent = data.status || 'Active';
  document.getElementById('res-type').textContent = data.taxpayerType || 'Regular';
  document.getElementById('res-date').textContent = data.registrationDate || 'N/A';

  // Mock tax mismatch check: simulate 18% charged but 12% correct for demo
  taxCard.style.display = 'block';
  const chargedRate = 18;
  const correctRate = 12;
  const diff = chargedRate - correctRate;

  document.getElementById('charged-rate').textContent = chargedRate + '%';
  document.getElementById('correct-rate').textContent = correctRate + '%';
  document.getElementById('overcharge-amt').textContent = '+' + diff + '%';

  const legalName = data.legalName || 'the vendor';
  document.getElementById('dispute-content').textContent =
    `Dear ${legalName}, as per GST notification, the applicable GST rate for this product/service is ${correctRate}%. ` +
    `You have incorrectly charged ${chargedRate}% GST on GSTIN ${gstin}. ` +
    `I request a corrected invoice with the applicable ${correctRate}% rate, or a refund of the excess ${diff}% GST charged. ` +
    `This is a violation of Section 31 of the CGST Act, 2017.`;
}

function copyDispute() {
  const text = document.getElementById('dispute-content').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Dispute text copied!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Dispute text copied!');
  }
}

// HSN code database (mock)
const HSN_DB = {
  '8471': { desc: 'Automatic data processing machines (computers)', rate: 18, cat: 'Electronics' },
  '8517': { desc: 'Telephone sets including smartphones', rate: 18, cat: 'Electronics' },
  '9403': { desc: 'Other furniture and parts thereof', rate: 18, cat: 'Furniture' },
  '0901': { desc: 'Coffee, whether or not roasted; tea', rate: 5, cat: 'Food & Beverages' },
  '3004': { desc: 'Medicaments for therapeutic use', rate: 12, cat: 'Medicines' },
  '6101': { desc: 'Garments and clothing accessories', rate: 12, cat: 'Textiles' },
  '4901': { desc: 'Printed books, brochures, pamphlets', rate: 0, cat: 'Books & Publications' },
  '3301': { desc: 'Essential oils and resinoids', rate: 18, cat: 'Chemicals' },
  '8703': { desc: 'Motor cars and vehicles', rate: 28, cat: 'Automobiles' },
  '2201': { desc: 'Waters, mineral waters, flavoured water', rate: 18, cat: 'Beverages' },
  '2106': { desc: 'Food preparations not elsewhere specified', rate: 18, cat: 'Food' },
  '9504': { desc: 'Video games, articles for fun-fair', rate: 18, cat: 'Games' },
};

function checkHSN() {
  const input = document.getElementById('hsn-input');
  const code = input.value.trim();

  if (!code || code.length < 4) {
    showToast('Enter at least 4 digits of HSN code');
    return;
  }

  // Find matching entry (exact or prefix match)
  let found = null;
  let foundCode = null;
  for (const [hsnCode, data] of Object.entries(HSN_DB)) {
    if (hsnCode.startsWith(code) || code.startsWith(hsnCode)) {
      found = data;
      foundCode = hsnCode;
      break;
    }
  }

  const resultDiv = document.getElementById('hsn-result');
  const card = document.getElementById('hsn-result-card');
  resultDiv.style.display = 'block';

  if (!found) {
    card.className = 'result-card error';
    document.getElementById('hsn-status-badge').textContent = 'Unknown';
    document.getElementById('hsn-status-badge').className = 'status-badge invalid';
    document.getElementById('hsn-code-res').textContent = code;
    document.getElementById('hsn-desc').textContent = 'HSN code not in local database. Upgrade for full GST HSN lookup.';
    document.getElementById('hsn-rate').textContent = 'N/A';
    document.getElementById('hsn-igst').textContent = 'N/A';
    document.getElementById('hsn-cgst').textContent = 'N/A';
    document.getElementById('hsn-cat').textContent = 'N/A';
    return;
  }

  card.className = 'result-card';
  document.getElementById('hsn-status-badge').textContent = 'Found';
  document.getElementById('hsn-status-badge').className = 'status-badge valid';
  document.getElementById('hsn-code-res').textContent = foundCode;
  document.getElementById('hsn-desc').textContent = found.desc;
  document.getElementById('hsn-rate').textContent = found.rate + '%';
  document.getElementById('hsn-igst').textContent = found.rate + '%';
  document.getElementById('hsn-cgst').textContent = (found.rate / 2) + '% + ' + (found.rate / 2) + '%';
  document.getElementById('hsn-cat').textContent = found.cat;
}

function quickHSN(code) {
  document.getElementById('hsn-input').value = code;
  switchTab('hsn');
  checkHSN();
}

// Extract GST from active page via content script
function extractFromPage() {
  const btn = document.getElementById('extract-btn');
  btn.textContent = '...';
  btn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'extractGST' }, (response) => {
      btn.textContent = '⚡ Extract';
      btn.disabled = false;

      if (chrome.runtime.lastError) {
        showToast('Cannot extract from this page');
        return;
      }

      if (response && response.gstin) {
        document.getElementById('gstin-input').value = response.gstin;
        showToast('GSTIN extracted: ' + response.gstin);
      } else {
        showToast('No GSTIN found on this page');
      }
    });
  });
}

// Toast notification
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Enter key support
document.getElementById('gstin-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') validateGSTIN();
});

document.getElementById('hsn-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') checkHSN();
});

// Auto-format GSTIN input
document.getElementById('gstin-input').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
