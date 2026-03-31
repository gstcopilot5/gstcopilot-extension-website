// GST Copilot Pro - popup.js

const FREE_CHECKS_LIMIT = 3;
let checksUsed = parseInt(localStorage.getItem('gst_checks_used') || '0');
updateChecksDisplay();

function updateChecksDisplay() {
  const remaining = Math.max(0, FREE_CHECKS_LIMIT - checksUsed);
  const el = document.getElementById('checks-counter');
  if (!el) return;
  if (remaining > 0) {
    el.textContent = remaining + ' free check' + (remaining === 1 ? '' : 's') + ' remaining';
    el.style.color = '#475569';
  } else {
    el.textContent = 'Upgrade for unlimited';
    el.style.color = '#f87171';
  }
}

function canCheck() { return checksUsed < FREE_CHECKS_LIMIT; }
function consumeCheck() {
  checksUsed++;
  localStorage.setItem('gst_checks_used', checksUsed.toString());
  updateChecksDisplay();
}

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  const tabs = ['gstin', 'hsn', 'calc', 'upgrade'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
}

// ── State codes ────────────────────────────────────────────────────────────
const STATE_CODES = {
  '01':'J&K','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan',
  '09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh',
  '13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
  '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand',
  '21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
  '27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka','30':'Goa',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','36':'Telangana','37':'Andhra Pradesh (New)'
};

function isValidGSTIN(gstin) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

function parseGSTIN(gstin) {
  return {
    stateCode: gstin.substring(0, 2),
    pan: gstin.substring(2, 12),
    entityCode: gstin[12],
    checkChar: gstin[13],
    checkDigit: gstin[14]
  };
}

function entityType(code) {
  return { '1': 'Proprietorship', '2': 'Partnership', '3': 'HUF',
           '4': 'Company', '5': 'Public Co.', '6': 'Govt.' }[code] || 'Private Ltd.';
}

// ── GSTZen API fetch ───────────────────────────────────────────────────────
async function fetchGSTZen(gstin) {
  const res = await fetch('https://api.gstzen.in/taxpayers/' + gstin, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

function getMockData(gstin) {
  const p = parseGSTIN(gstin);
  const state = STATE_CODES[p.stateCode] || 'Unknown';
  const names = ['Bharat Tech Solutions Pvt Ltd','Sunrise Enterprises','Apex Traders LLP',
                  'National Commerce Co','Vrindavan Industries'];
  const name = names[parseInt(p.stateCode) % names.length];
  return {
    legalName: name, tradeName: name.split(' ')[0] + ' Traders',
    state, status: 'Active', taxpayerType: entityType(p.entityCode),
    registrationDate: '01/04/' + (2018 + (parseInt(p.stateCode) % 5)),
    pan: p.pan, _isMock: true
  };
}

// ── Validate GSTIN ─────────────────────────────────────────────────────────
async function validateGSTIN() {
  const input = document.getElementById('gstin-input');
  const gstin = input.value.trim().toUpperCase();

  if (!gstin) { showToast('Enter a GSTIN number'); return; }
  if (!isValidGSTIN(gstin)) {
    showResult(false, null, gstin, 'Invalid format. GSTIN must be 15 characters: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric.');
    return;
  }
  if (!canCheck()) { switchTab('upgrade'); showToast('Free limit reached — Upgrade for unlimited checks'); return; }

  const btn = document.getElementById('validate-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="loader"></div>Validating via GSTZen...';

  try {
    let data;
    try {
      const api = await fetchGSTZen(gstin);
      data = {
        legalName: api.legalName || api.tradeNam || api.legal_name || 'N/A',
        tradeName: api.tradeName || api.trade_name || api.tradeNam || 'N/A',
        state: api.stj || api.state || STATE_CODES[gstin.substring(0, 2)] || 'N/A',
        status: api.sts || api.status || 'Active',
        taxpayerType: api.dty || api.taxpayerType || 'Regular',
        registrationDate: api.rgdt || api.regDate || 'N/A',
        pan: gstin.substring(2, 12)
      };
    } catch {
      data = getMockData(gstin);
    }
    consumeCheck();
    showResult(true, data, gstin, null);
  } catch (err) {
    showResult(false, null, gstin, 'Validation failed. Please try again.');
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
    card.style.borderColor = '#fecaca';
    statusBadge.textContent = 'Invalid';
    statusBadge.className = 'pill pill-red';
    document.getElementById('res-gstin').textContent = gstin;
    document.getElementById('res-name').textContent = errorMsg || 'Invalid';
    ['res-trade','res-state','res-status','res-type','res-date','res-pan'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    taxCard.style.display = 'none';
    return;
  }

  card.style.borderColor = '';
  statusBadge.textContent = data._isMock ? 'Valid (Demo)' : 'Active';
  statusBadge.className = 'pill pill-green';

  const p = parseGSTIN(gstin);
  document.getElementById('res-gstin').textContent = gstin;
  document.getElementById('res-name').textContent = data.legalName;
  document.getElementById('res-trade').textContent = data.tradeName;
  document.getElementById('res-state').textContent = (data.state || STATE_CODES[p.stateCode] || '?') + ' · Code ' + p.stateCode;
  document.getElementById('res-status').textContent = data.status;
  document.getElementById('res-type').textContent = data.taxpayerType;
  document.getElementById('res-date').textContent = data.registrationDate;
  document.getElementById('res-pan').textContent = data.pan || p.pan;

  // Tax mismatch (mock demo: 18% charged vs 12% correct)
  taxCard.style.display = 'block';
  const chargedRate = 18, correctRate = 12, diff = chargedRate - correctRate;
  document.getElementById('charged-rate').textContent = chargedRate + '%';
  document.getElementById('correct-rate').textContent = correctRate + '%';
  document.getElementById('overcharge-amt').textContent = '+' + diff + '%';
  document.getElementById('dispute-content').textContent =
    `Dear ${data.legalName}, as per applicable GST notification, the correct GST rate for this supply is ${correctRate}%. ` +
    `You have charged ${chargedRate}% GST against GSTIN ${gstin}, resulting in an excess charge of ${diff}%. ` +
    `Under Section 31 of the CGST Act 2017, you are required to issue a revised tax invoice reflecting the correct rate of ${correctRate}%, ` +
    `or refund the excess GST of ${diff}% collected.`;
}

function copyDispute() {
  const text = document.getElementById('dispute-content').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Dispute notice copied to clipboard'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied!');
  }
}

// ── HSN database ───────────────────────────────────────────────────────────
const HSN_DB = {
  '8471': { desc: 'Automatic data processing machines (computers, laptops)', rate: 18, cat: 'Electronics' },
  '8517': { desc: 'Telephone sets including smartphones and cellular handsets', rate: 18, cat: 'Electronics' },
  '8528': { desc: 'Television sets and monitors', rate: 28, cat: 'Electronics' },
  '9403': { desc: 'Other furniture and parts thereof', rate: 18, cat: 'Furniture' },
  '0901': { desc: 'Coffee, tea, mate and spices', rate: 5, cat: 'Food & Beverages' },
  '2106': { desc: 'Food preparations not elsewhere specified', rate: 18, cat: 'Food' },
  '3004': { desc: 'Medicaments for therapeutic or prophylactic use', rate: 12, cat: 'Pharma' },
  '3301': { desc: 'Essential oils and resinoids; perfumery', rate: 18, cat: 'Chemicals' },
  '4901': { desc: 'Printed books, brochures, leaflets and similar printed matter', rate: 0, cat: 'Publications' },
  '6101': { desc: 'Overcoats, car-coats, garments and clothing accessories', rate: 12, cat: 'Textiles' },
  '8703': { desc: 'Motor cars and other motor vehicles for transport of persons', rate: 28, cat: 'Automobiles' },
  '2201': { desc: 'Waters including mineral waters and aerated waters', rate: 18, cat: 'Beverages' },
  '9504': { desc: 'Video games of a kind used with a television receiver', rate: 18, cat: 'Recreation' },
  '8414': { desc: 'Air or vacuum pumps, air or gas compressors and fans', rate: 18, cat: 'Machinery' },
};

function checkHSN() {
  const code = document.getElementById('hsn-input').value.trim();
  if (!code || code.length < 4) { showToast('Enter at least 4 digits'); return; }

  let found = null, foundCode = null;
  for (const [k, v] of Object.entries(HSN_DB)) {
    if (k.startsWith(code) || code.startsWith(k)) { found = v; foundCode = k; break; }
  }

  const resultDiv = document.getElementById('hsn-result');
  const card = document.getElementById('hsn-result-card');
  resultDiv.style.display = 'block';

  if (!found) {
    document.getElementById('hsn-status-badge').textContent = 'Not Found';
    document.getElementById('hsn-status-badge').className = 'pill pill-red';
    document.getElementById('hsn-code-res').textContent = code;
    document.getElementById('hsn-desc').textContent = 'Not in local database. Upgrade for full 18,000+ HSN coverage.';
    document.getElementById('hsn-rate').textContent = 'N/A';
    document.getElementById('hsn-igst').textContent = 'N/A';
    document.getElementById('hsn-cgst').textContent = 'N/A';
    document.getElementById('hsn-cat').textContent = 'N/A';
    return;
  }

  document.getElementById('hsn-status-badge').textContent = 'Found';
  document.getElementById('hsn-status-badge').className = 'pill pill-green';
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

// ── Tax Calculator ─────────────────────────────────────────────────────────
function calculateTax() {
  const amount = parseFloat(document.getElementById('calc-amount').value);
  const rate = parseFloat(document.getElementById('calc-rate').value);
  const type = document.querySelector('input[name="calc-type"]:checked').value;

  if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount'); return; }
  if (isNaN(rate) || rate < 0 || rate > 100) { showToast('Enter a valid GST rate (0–100)'); return; }

  let taxable, gstAmt;
  if (type === 'exclusive') {
    taxable = amount;
    gstAmt = (taxable * rate) / 100;
  } else {
    taxable = (amount * 100) / (100 + rate);
    gstAmt = amount - taxable;
  }

  const total = taxable + gstAmt;
  const half = gstAmt / 2;
  const fmt = n => '₹' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  document.getElementById('cr-taxable').textContent = fmt(taxable);
  document.getElementById('cr-gst').textContent = fmt(gstAmt);
  document.getElementById('cr-cgst').textContent = fmt(half);
  document.getElementById('cr-sgst').textContent = fmt(half);
  document.getElementById('cr-total').textContent = fmt(total);
  document.getElementById('cr-igst').textContent = fmt(gstAmt) + ' (interstate)';
  document.getElementById('calc-result').style.display = 'block';
}

// ── Extract from page ──────────────────────────────────────────────────────
function extractFromPage() {
  const btn = document.getElementById('extract-btn');
  btn.textContent = '...';
  btn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'extractGST' }, (response) => {
      btn.textContent = '⚡ Extract';
      btn.disabled = false;
      if (chrome.runtime.lastError || !response) {
        showToast('Cannot read this page');
        return;
      }
      if (response.gstin) {
        document.getElementById('gstin-input').value = response.gstin;
        showToast('Extracted: ' + response.gstin);
      } else {
        showToast('No GSTIN found on page');
      }
    });
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Key listeners ──────────────────────────────────────────────────────────
document.getElementById('gstin-input').addEventListener('keypress', e => { if (e.key === 'Enter') validateGSTIN(); });
document.getElementById('gstin-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
document.getElementById('hsn-input').addEventListener('keypress', e => { if (e.key === 'Enter') checkHSN(); });
document.getElementById('calc-amount').addEventListener('keypress', e => { if (e.key === 'Enter') calculateTax(); });
