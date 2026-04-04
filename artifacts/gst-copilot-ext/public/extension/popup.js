// GST Copilot Pro — popup.js

// ── Constants ─────────────────────────────────────────────────────────────
const FREE_CHECKS_LIMIT = 5;
const VALIDATE_API_BASE = 'https://e0915252-d539-4a59-8808-3df47d3b08ed-00-fh2jo8edcz1x.spock.replit.dev/api/validate-gstin/';
const LICENSE_API       = 'https://e0915252-d539-4a59-8808-3df47d3b08ed-00-fh2jo8edcz1x.spock.replit.dev/api/auth/verify-license';
const PRICING_URL       = 'https://gst-copilot-ext.replit.app/#pricing';
const TIMEOUT_MS        = 12000;

// ── Checks counter ────────────────────────────────────────────────────────
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
    el.textContent = '0 checks remaining';
    el.style.color = '#f87171';
  }
}

function canCheck() { return checksUsed < FREE_CHECKS_LIMIT; }
function consumeCheck() {
  checksUsed++;
  localStorage.setItem('gst_checks_used', checksUsed.toString());
  updateChecksDisplay();
}

// ── Toast (supports type: 'error' | 'success' | 'info') ──────────────────
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show toast-' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.remove('show'); }, type === 'error' ? 4000 : 2500);
}

// ── Limit-reached banner ──────────────────────────────────────────────────
function showLimitBanner() {
  const banner = document.getElementById('limit-banner');
  if (banner) banner.style.display = 'flex';
}
function hideLimitBanner() {
  const banner = document.getElementById('limit-banner');
  if (banner) banner.style.display = 'none';
}

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(tab) {
  const tabs = ['gstin', 'hsn', 'calc', 'upgrade'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
}

// ── State codes ───────────────────────────────────────────────────────────
const STATE_CODES = {
  '01':'J&K','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan',
  '09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh',
  '13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura',
  '17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand',
  '21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
  '27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka','30':'Goa',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','36':'Telangana',
  '37':'Andhra Pradesh (New)'
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

// ── Fetch with timeout ────────────────────────────────────────────────────
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

// ── API call ──────────────────────────────────────────────────────────────
async function fetchValidateAPI(gstin) {
  const res = await fetchWithTimeout(VALIDATE_API_BASE + gstin, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status === 429) throw Object.assign(new Error('limit_exceeded'), { code: 'LIMIT' });
  if (!res.ok) throw Object.assign(new Error('server_error_' + res.status), { code: 'SERVER' });
  return res.json();
}

// ── Mock fallback ─────────────────────────────────────────────────────────
function getMockData(gstin) {
  const p = parseGSTIN(gstin);
  const state = STATE_CODES[p.stateCode] || 'Unknown';
  const names = ['Bharat Tech Solutions Pvt Ltd', 'Sunrise Enterprises',
                  'Apex Traders LLP', 'National Commerce Co', 'Vrindavan Industries'];
  const name = names[parseInt(p.stateCode) % names.length];
  return {
    legalName: name, tradeName: name.split(' ')[0] + ' Traders',
    state, status: 'Active', taxpayerType: entityType(p.entityCode),
    registrationDate: '01/04/' + (2018 + (parseInt(p.stateCode) % 5)),
    pan: p.pan, _isMock: true
  };
}

// ── Classify error ────────────────────────────────────────────────────────
function classifyError(err) {
  if (err.code === 'LIMIT')  return 'limit';
  if (err.name === 'AbortError') return 'timeout';
  if (!navigator.onLine)     return 'offline';
  if (err.code === 'SERVER') return 'server';
  // Failed to fetch = network unreachable
  if (err.message && (err.message.includes('fetch') || err.message.includes('network'))) return 'network';
  return 'unknown';
}

// ── Validate GSTIN ────────────────────────────────────────────────────────
async function validateGSTIN() {
  const input = document.getElementById('gstin-input');
  const gstin = input.value.trim().toUpperCase();

  if (!gstin) { showToast('Please enter a GSTIN number', 'error'); return; }
  if (!isValidGSTIN(gstin)) {
    showResult(false, null, gstin, 'Invalid format — a GSTIN must be 15 characters (2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric).');
    return;
  }

  // Monthly limit check
  if (!canCheck()) {
    showLimitBanner();
    showResult(false, null, gstin, 'Monthly limit reached. Upgrade to Pro for unlimited GSTIN checks.');
    showToast('Monthly limit reached — upgrade for unlimited checks', 'error');
    return;
  }

  const btn = document.getElementById('validate-btn');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="loader"></div>Validating…';
  hideLimitBanner();

  try {
    let data;
    let usingFallback = false;

    try {
      const api = await fetchValidateAPI(gstin);

      const companyName =
        api.company_name || api.companyName || api.legalName ||
        api.legal_name   || api.tradeName   || api.trade_name ||
        api.tradeNam     || api.name         || 'N/A';

      const status =
        api.status       || api.gstin_status || api.gstinStatus ||
        api.sts          || api.filing_status || 'Active';

      data = {
        legalName:        companyName,
        tradeName:        api.tradeName || api.trade_name || api.tradeNam || companyName,
        state:            api.state || api.stj || STATE_CODES[gstin.substring(0, 2)] || 'N/A',
        status:           status,
        taxpayerType:     api.taxpayerType || api.dty || api.type || 'Regular',
        registrationDate: api.registrationDate || api.rgdt || api.reg_date || 'N/A',
        pan:              api.pan || gstin.substring(2, 12),
        _source:          'api'
      };
    } catch (apiErr) {
      const kind = classifyError(apiErr);

      if (kind === 'limit') {
        showLimitBanner();
        showResult(false, null, gstin, 'Monthly limit reached. Upgrade to Pro for unlimited GSTIN checks.');
        showToast('Monthly limit reached!', 'error');
        return;
      }

      // Network / server issues → fall back to demo data with status badge
      usingFallback = true;
      data = getMockData(gstin);
      data._errorKind = kind;

      if (kind === 'timeout' || kind === 'offline' || kind === 'network') {
        showToast('Server temporarily offline — showing demo data', 'error');
      } else {
        showToast('Could not validate GSTIN — showing demo data', 'error');
      }
    }

    consumeCheck();
    showResult(true, data, gstin, null);

  } catch (outerErr) {
    showResult(false, null, gstin, 'Could not validate GSTIN. Please try again.');
    showToast('Validation failed. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

// ── Show Result ───────────────────────────────────────────────────────────
function showResult(isValid, data, gstin, errorMsg) {
  const resultsDiv   = document.getElementById('results');
  const card         = document.getElementById('gstin-result-card');
  const statusBadge  = document.getElementById('gstin-status');
  const serverNote   = document.getElementById('server-note');
  const taxCard      = document.getElementById('tax-mismatch-card');

  resultsDiv.style.display = 'block';

  const saveRow = document.getElementById('save-client-row');
  const saveBtn = document.getElementById('save-client-btn');

  if (!isValid) {
    card.style.borderColor = '#fecaca';
    statusBadge.textContent = 'Invalid';
    statusBadge.className = 'pill pill-red';
    document.getElementById('res-gstin').textContent = gstin || '—';
    document.getElementById('res-name').textContent = errorMsg || 'Validation failed';
    ['res-trade','res-state','res-status','res-type','res-date','res-pan'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
    if (serverNote) serverNote.style.display = 'none';
    if (saveRow) saveRow.style.display = 'none';
    taxCard.style.display = 'none';
    return;
  }

  card.style.borderColor = '';

  // Status badge — live / demo / amber
  if (data._isMock) {
    statusBadge.textContent = 'Demo Data';
    statusBadge.className = 'pill pill-amber';
  } else {
    const s = (data.status || 'Active').toLowerCase();
    statusBadge.textContent = data.status || 'Active';
    statusBadge.className = s === 'active' || s === 'registered' ? 'pill pill-green' : 'pill pill-amber';
  }

  // Server note (shown only for fallback data)
  if (serverNote) {
    if (data._isMock) {
      const msgs = {
        timeout:  'GSTCopilot server is temporarily offline. Please try again in a few minutes.',
        offline:  'GSTCopilot server is temporarily offline. Please try again in a few minutes.',
        network:  'GSTCopilot server is temporarily offline. Please try again in a few minutes.',
        server:   'Could not validate GSTIN. Showing estimated data — please try again.',
        unknown:  'Could not reach validation server. Showing estimated data.'
      };
      serverNote.textContent = msgs[data._errorKind] || msgs.unknown;
      serverNote.style.display = 'block';
    } else {
      serverNote.style.display = 'none';
    }
  }

  const p = parseGSTIN(gstin);
  document.getElementById('res-gstin').textContent  = gstin;
  document.getElementById('res-name').textContent   = data.legalName;
  document.getElementById('res-trade').textContent  = data.tradeName;
  document.getElementById('res-state').textContent  = (data.state || STATE_CODES[p.stateCode] || '?') + ' · Code ' + p.stateCode;
  document.getElementById('res-status').textContent = data.status;
  document.getElementById('res-type').textContent   = data.taxpayerType;
  document.getElementById('res-date').textContent   = data.registrationDate;
  document.getElementById('res-pan').textContent    = data.pan || p.pan;

  // Show "Save to Clients" button only for live (non-mock) results
  if (saveRow) {
    if (!data._isMock) {
      saveRow.style.display = 'flex';
      if (saveBtn) { saveBtn.innerHTML = '💾 Save to Client List'; saveBtn.disabled = false; }
    } else {
      saveRow.style.display = 'none';
    }
  }

  taxCard.style.display = 'block';
  const chargedRate = 18, correctRate = 12, diff = chargedRate - correctRate;
  document.getElementById('charged-rate').textContent  = chargedRate + '%';
  document.getElementById('correct-rate').textContent  = correctRate + '%';
  document.getElementById('overcharge-amt').textContent = '+' + diff + '%';
  document.getElementById('dispute-content').textContent =
    `Dear ${data.legalName}, as per applicable GST notification, the correct GST rate for this supply is ${correctRate}%. ` +
    `You have charged ${chargedRate}% GST against GSTIN ${gstin}, resulting in an excess charge of ${diff}%. ` +
    `Under Section 31 of the CGST Act 2017, you are required to issue a revised tax invoice reflecting the correct rate of ${correctRate}%, ` +
    `or refund the excess GST of ${diff}% collected.`;
}

// ── Save current validated client to list ─────────────────────────────────
function saveCurrentClient() {
  const gstin = document.getElementById('res-gstin').textContent.trim();
  const name  = document.getElementById('res-name').textContent.trim();
  if (!gstin || gstin === '—') return;

  chrome.storage.local.get('gst_clients', r => {
    const list = r.gst_clients || [];
    if (list.some(c => c.gstin === gstin)) {
      showToast('Client already in your list', 'info');
      const btn = document.getElementById('save-client-btn');
      if (btn) { btn.innerHTML = '✓ Already saved'; btn.disabled = true; }
      return;
    }
    list.unshift({ name: name && name !== '—' ? name : gstin, gstin, added: Date.now() });
    chrome.storage.local.set({ gst_clients: list }, () => {
      const btn = document.getElementById('save-client-btn');
      if (btn) { btn.innerHTML = '✓ Saved!'; btn.disabled = true; }
      showToast((name && name !== '—' ? name : gstin) + ' saved to client list', 'success');
    });
  });
}

// ── Copy dispute ──────────────────────────────────────────────────────────
function copyDispute() {
  const text = document.getElementById('dispute-content').textContent;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Dispute notice copied!', 'success'))
      .catch(() => legacyCopy(text));
  } else {
    legacyCopy(text);
  }
}
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta);
  ta.select(); document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('Copied!', 'success');
}

// ── License key verification ──────────────────────────────────────────────
async function verifyLicense() {
  const input  = document.getElementById('license-input');
  const btn    = document.getElementById('license-btn');
  const status = document.getElementById('license-status');
  if (!input || !btn || !status) return;

  const key = input.value.trim();
  if (!key) {
    showStatus(status, 'Please enter your license key.', 'error');
    return;
  }

  const origText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spin"></span> Verifying…';
  showStatus(status, '', '');

  try {
    const res = await fetchWithTimeout(LICENSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    const data = await res.json();

    if (res.status === 404 || res.status === 401 || res.status === 403) {
      showStatus(status, 'Invalid license key. Please check your email or contact support at gstcopilot@gmail.com', 'error');
      return;
    }
    if (!res.ok) {
      showStatus(status, 'Could not verify your key right now. Please try again in a moment.', 'error');
      return;
    }

    // Success — store license
    localStorage.setItem('gst_license_key', key);
    localStorage.setItem('gst_license_plan', data.plan || 'starter');
    localStorage.removeItem('gst_checks_used');
    checksUsed = 0;
    updateChecksDisplay();
    hideLimitBanner();

    showStatus(status, '✓ License activated! Your ' + (data.plan || 'Starter') + ' plan is now active.', 'success');
    showToast('License activated successfully!', 'success');

    // Update badge
    const badge = document.querySelector('.free-badge');
    if (badge) { badge.textContent = (data.plan || 'PRO').toUpperCase(); badge.style.color = '#4ade80'; }

  } catch (err) {
    const kind = classifyError(err);
    if (kind === 'timeout' || kind === 'offline' || kind === 'network') {
      showStatus(status, 'GSTCopilot server is temporarily offline. Please try again in a few minutes.', 'error');
    } else {
      showStatus(status, 'Invalid license key. Please check your email or contact support at gstcopilot@gmail.com', 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function showStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = 'license-status license-status-' + type;
  el.style.display = msg ? 'block' : 'none';
}

// ── Open upgrade page ─────────────────────────────────────────────────────
function openPricing() {
  chrome.tabs.create({ url: PRICING_URL });
}

// ── HSN database ──────────────────────────────────────────────────────────
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
  if (!code || code.length < 4) { showToast('Please enter at least 4 digits', 'error'); return; }

  let found = null, foundCode = null;
  for (const [k, v] of Object.entries(HSN_DB)) {
    if (k.startsWith(code) || code.startsWith(k)) { found = v; foundCode = k; break; }
  }

  const resultDiv = document.getElementById('hsn-result');
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

// ── Tax Calculator ────────────────────────────────────────────────────────
function calculateTax() {
  const amount = parseFloat(document.getElementById('calc-amount').value);
  const rate   = parseFloat(document.getElementById('calc-rate').value);
  const type   = document.querySelector('input[name="calc-type"]:checked').value;

  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid amount', 'error'); return; }
  if (isNaN(rate) || rate < 0 || rate > 100) { showToast('Please enter a valid GST rate (0–100)', 'error'); return; }

  let taxable, gstAmt;
  if (type === 'exclusive') {
    taxable = amount;
    gstAmt = (taxable * rate) / 100;
  } else {
    taxable = (amount * 100) / (100 + rate);
    gstAmt = amount - taxable;
  }

  const total = taxable + gstAmt;
  const half  = gstAmt / 2;
  const fmt   = n => '₹' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  document.getElementById('cr-taxable').textContent = fmt(taxable);
  document.getElementById('cr-gst').textContent     = fmt(gstAmt);
  document.getElementById('cr-cgst').textContent    = fmt(half);
  document.getElementById('cr-sgst').textContent    = fmt(half);
  document.getElementById('cr-total').textContent   = fmt(total);
  document.getElementById('cr-igst').textContent    = fmt(gstAmt) + ' (interstate)';
  document.getElementById('calc-result').style.display = 'block';
}

// ── Extract from page ─────────────────────────────────────────────────────
function extractFromPage() {
  const btn = document.getElementById('extract-btn');
  btn.textContent = '…';
  btn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'extractGST' }, (response) => {
      btn.textContent = '⚡ Extract';
      btn.disabled = false;
      if (chrome.runtime.lastError || !response) {
        showToast('Cannot read this page', 'error');
        return;
      }
      if (response.gstin) {
        document.getElementById('gstin-input').value = response.gstin;
        showToast('Extracted: ' + response.gstin, 'success');
      } else {
        showToast('No GSTIN found on this page', 'info');
      }
    });
  });
}

// ── Key listeners ─────────────────────────────────────────────────────────
document.getElementById('gstin-input').addEventListener('keypress', e => { if (e.key === 'Enter') validateGSTIN(); });
document.getElementById('gstin-input').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
document.getElementById('hsn-input').addEventListener('keypress', e => { if (e.key === 'Enter') checkHSN(); });
document.getElementById('calc-amount').addEventListener('keypress', e => { if (e.key === 'Enter') calculateTax(); });

const licenseInput = document.getElementById('license-input');
if (licenseInput) {
  licenseInput.addEventListener('keypress', e => { if (e.key === 'Enter') verifyLicense(); });
}
