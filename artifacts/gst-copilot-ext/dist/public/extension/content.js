// GST Copilot — content.js
// Auto-detects, highlights, validates GSTINs + autofill on GST portals

(function () {
  if (window.__gstCopilotInjected) return;
  window.__gstCopilotInjected = true;

  const GSTIN_REGEX  = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g;
  const IS_GST_PORTAL = /gst\.gov\.in/i.test(location.hostname);

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

  function isValidGSTIN(g) {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g);
  }
  function getState(g)  { return STATE_CODES[g.substring(0,2)] || 'Unknown'; }
  function getPAN(g)    { return g.substring(2,12); }
  function getEntity(g) {
    return {'1':'Proprietor','2':'Partnership','3':'HUF','4':'Public Co.','6':'Govt.'}[g[12]] || 'Private Ltd.';
  }

  // ── Chrome storage helpers ─────────────────────────────────────────────────
  function getClients(cb) {
    chrome.storage.local.get('gst_clients', r => cb(r.gst_clients || []));
  }
  function saveClient(name, gstin, cb) {
    getClients(list => {
      const exists = list.some(c => c.gstin === gstin);
      if (!exists) list.unshift({ name: name || gstin, gstin, added: Date.now() });
      chrome.storage.local.set({ gst_clients: list }, cb);
    });
  }
  function removeClient(gstin, cb) {
    getClients(list => {
      chrome.storage.local.set({ gst_clients: list.filter(c => c.gstin !== gstin) }, cb);
    });
  }

  // ── Inject CSS ──────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('gst-copilot-styles')) return;
    const s = document.createElement('style');
    s.id = 'gst-copilot-styles';
    s.textContent = `
      /* ── Text highlights ── */
      .gst-highlight-valid {
        background: linear-gradient(135deg,#dcfce7,#bbf7d0)!important;
        border:1.5px solid #16a34a!important; border-radius:4px!important;
        padding:1px 4px!important; cursor:pointer!important;
        font-family:'Courier New',monospace!important; font-weight:600!important;
        color:#14532d!important; display:inline-block!important; position:relative!important;
        transition:all .2s!important;
      }
      .gst-highlight-valid:hover { background:linear-gradient(135deg,#bbf7d0,#86efac)!important; box-shadow:0 2px 8px rgba(22,163,74,.3)!important; transform:translateY(-1px)!important; }
      .gst-highlight-invalid {
        background:linear-gradient(135deg,#fee2e2,#fecaca)!important;
        border:1.5px solid #ef4444!important; border-radius:4px!important;
        padding:1px 4px!important; font-family:'Courier New',monospace!important;
        font-weight:600!important; color:#7f1d1d!important; display:inline-block!important;
      }

      /* ── Validate icon next to highlighted GSTINs ── */
      .gst-validate-btn {
        display:inline-flex; align-items:center; justify-content:center;
        width:16px; height:16px; margin-left:3px; vertical-align:middle;
        background:#16a34a; color:white; border-radius:50%;
        font-size:9px; font-weight:800; cursor:pointer;
        border:none; padding:0; line-height:1;
        transition:all .15s; flex-shrink:0;
        box-shadow:0 1px 4px rgba(22,163,74,.35);
      }
      .gst-validate-btn:hover { background:#15803d; transform:scale(1.15); }
      .gst-validate-btn[title] { cursor:help; }

      /* ── Tooltip ── */
      .gst-tooltip {
        position:fixed; z-index:2147483647;
        background:#0f172a; color:#f8fafc; border-radius:10px;
        padding:12px 14px; font-size:12px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        line-height:1.5; box-shadow:0 8px 30px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.05);
        pointer-events:none; min-width:220px; max-width:280px; transition:opacity .15s;
      }
      .gst-tooltip-header { display:flex; align-items:center; gap:6px; margin-bottom:8px; padding-bottom:7px; border-bottom:1px solid rgba(255,255,255,.08); }
      .gst-tooltip-icon { width:22px; height:22px; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; }
      .gst-tooltip-icon.valid { background:#16a34a; }
      .gst-tooltip-icon.invalid { background:#ef4444; }
      .gst-tooltip-title { font-weight:700; font-size:12px; letter-spacing:-.2px; }
      .gst-tooltip-row { display:flex; justify-content:space-between; gap:8px; padding:2px 0; }
      .gst-tooltip-label { color:#94a3b8; font-size:11px; }
      .gst-tooltip-value { color:#e2e8f0; font-size:11px; font-weight:500; text-align:right; font-family:'Courier New',monospace; word-break:break-all; }
      .gst-tooltip-value.green { color:#4ade80; }
      .gst-tooltip-value.red { color:#f87171; }
      .gst-tooltip-footer { margin-top:8px; padding-top:7px; border-top:1px solid rgba(255,255,255,.08); color:#64748b; font-size:10px; text-align:center; }

      /* ── Autofill button (next to input fields) ── */
      .gst-autofill-wrap { position:relative; display:inline-block; width:100%; }
      .gst-autofill-btn {
        position:absolute; right:6px; top:50%; transform:translateY(-50%);
        background:#16a34a; color:white; border:none; border-radius:6px;
        font-size:11px; font-weight:700; padding:4px 10px; cursor:pointer;
        font-family:-apple-system,sans-serif; letter-spacing:.2px;
        box-shadow:0 2px 8px rgba(22,163,74,.35); transition:all .15s; white-space:nowrap;
        display:flex; align-items:center; gap:4px; z-index:100;
      }
      .gst-autofill-btn:hover { background:#15803d; box-shadow:0 3px 12px rgba(22,163,74,.5); transform:translateY(-50%) scale(1.02); }
      .gst-autofill-btn .af-icon { font-size:12px; }

      /* ── Client list panel ── */
      .gst-client-panel {
        position:absolute; z-index:2147483647;
        background:#0f172a; border:1px solid rgba(255,255,255,.1);
        border-radius:12px; padding:0; min-width:280px; max-width:320px;
        box-shadow:0 16px 48px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        overflow:hidden;
      }
      .gcp-header {
        background:#1e293b; padding:10px 14px;
        display:flex; align-items:center; justify-content:space-between;
        border-bottom:1px solid rgba(255,255,255,.07);
      }
      .gcp-title { font-size:12px; font-weight:700; color:#f8fafc; }
      .gcp-close { background:none; border:none; cursor:pointer; color:#64748b; font-size:16px; line-height:1; padding:0; }
      .gcp-close:hover { color:#94a3b8; }
      .gcp-search {
        padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.06);
      }
      .gcp-search input {
        width:100%; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
        border-radius:7px; padding:7px 10px; color:#f8fafc; font-size:12px;
        outline:none; font-family:inherit;
      }
      .gcp-search input:focus { border-color:rgba(22,163,74,.5); }
      .gcp-search input::placeholder { color:#475569; }
      .gcp-list { max-height:220px; overflow-y:auto; }
      .gcp-list::-webkit-scrollbar { width:4px; }
      .gcp-list::-webkit-scrollbar-track { background:transparent; }
      .gcp-list::-webkit-scrollbar-thumb { background:#1e293b; border-radius:2px; }
      .gcp-item {
        display:flex; align-items:center; gap:10px;
        padding:9px 14px; cursor:pointer; transition:background .12s;
        border-bottom:1px solid rgba(255,255,255,.04);
      }
      .gcp-item:last-child { border-bottom:none; }
      .gcp-item:hover { background:rgba(255,255,255,.05); }
      .gcp-avatar {
        width:30px; height:30px; background:rgba(22,163,74,.15);
        border:1px solid rgba(22,163,74,.25); border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:700; color:#4ade80; flex-shrink:0; text-transform:uppercase;
      }
      .gcp-info { flex:1; min-width:0; }
      .gcp-name { font-size:12px; font-weight:600; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gcp-gstin { font-size:10px; color:#64748b; font-family:'Courier New',monospace; letter-spacing:.5px; }
      .gcp-fill-btn {
        background:rgba(22,163,74,.2); border:1px solid rgba(22,163,74,.35);
        color:#4ade80; border-radius:6px; font-size:10px; font-weight:700;
        padding:4px 9px; cursor:pointer; white-space:nowrap; transition:all .12s;
      }
      .gcp-fill-btn:hover { background:rgba(22,163,74,.35); }
      .gcp-empty { padding:20px 14px; text-align:center; color:#475569; font-size:12px; }
      .gcp-empty-icon { font-size:24px; margin-bottom:6px; }
      .gcp-add-row {
        padding:10px 14px; border-top:1px solid rgba(255,255,255,.07);
        display:flex; gap:7px; align-items:center;
      }
      .gcp-add-input {
        flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
        border-radius:7px; padding:6px 9px; color:#f8fafc; font-size:11px;
        outline:none; font-family:inherit;
      }
      .gcp-add-input:focus { border-color:rgba(22,163,74,.5); }
      .gcp-add-input::placeholder { color:#475569; }
      .gcp-save-btn {
        background:#16a34a; color:white; border:none; border-radius:7px;
        font-size:11px; font-weight:700; padding:6px 12px; cursor:pointer; white-space:nowrap;
      }
      .gcp-save-btn:hover { background:#15803d; }

      /* ── Floating Badge ── */
      #gst-copilot-badge {
        position:fixed; bottom:20px; right:20px; z-index:2147483646;
        background:linear-gradient(135deg,#0f172a,#1e293b); color:#f8fafc;
        border-radius:12px; padding:10px 14px;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:12px; box-shadow:0 4px 20px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.07);
        cursor:pointer; transition:all .25s cubic-bezier(.4,0,.2,1); min-width:190px; user-select:none;
      }
      #gst-copilot-badge:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.1); }
      #gst-copilot-badge.gst-badge-hidden { transform:translateY(80px); opacity:0; pointer-events:none; }
      .gst-badge-header { display:flex; align-items:center; gap:7px; margin-bottom:6px; }
      .gst-badge-logo { width:20px; height:20px; background:#16a34a; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:11px; }
      .gst-badge-title { font-weight:700; font-size:12px; letter-spacing:-.2px; flex:1; }
      .gst-badge-close { color:#475569; font-size:14px; line-height:1; cursor:pointer; padding:0 2px; transition:color .15s; }
      .gst-badge-close:hover { color:#94a3b8; }
      .gst-badge-stats { display:flex; gap:6px; }
      .gst-stat { flex:1; background:rgba(255,255,255,.05); border-radius:7px; padding:5px 8px; text-align:center; border:1px solid rgba(255,255,255,.06); }
      .gst-stat-num { font-size:16px; font-weight:800; line-height:1.2; }
      .gst-stat-num.green { color:#4ade80; }
      .gst-stat-num.red { color:#f87171; }
      .gst-stat-label { font-size:9px; color:#64748b; margin-top:1px; letter-spacing:.3px; text-transform:uppercase; }
      .gst-badge-tag { margin-top:6px; background:rgba(22,163,74,.15); border:1px solid rgba(22,163,74,.3); color:#4ade80; font-size:10px; font-weight:600; padding:3px 8px; border-radius:20px; display:inline-flex; align-items:center; gap:4px; }
    `;
    document.head.appendChild(s);
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────────
  let tooltip = null;

  function createTooltip() {
    if (document.getElementById('gst-copilot-tooltip')) return;
    tooltip = document.createElement('div');
    tooltip.id = 'gst-copilot-tooltip';
    tooltip.className = 'gst-tooltip';
    tooltip.style.opacity = '0';
    document.body.appendChild(tooltip);
  }

  function showTooltip(el, gstin, isValid) {
    if (!tooltip) return;
    const state = getState(gstin), pan = getPAN(gstin);
    if (isValid) {
      tooltip.innerHTML = `
        <div class="gst-tooltip-header">
          <div class="gst-tooltip-icon valid">✓</div>
          <span class="gst-tooltip-title">Valid GSTIN</span>
        </div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">GSTIN</span><span class="gst-tooltip-value green">${gstin}</span></div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">State</span><span class="gst-tooltip-value">${state}</span></div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">PAN</span><span class="gst-tooltip-value">${pan}</span></div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">Entity</span><span class="gst-tooltip-value">${getEntity(gstin)}</span></div>
        <div class="gst-tooltip-footer">🧾 GST Copilot · Click to copy · ✚ to save client</div>`;
    } else {
      tooltip.innerHTML = `
        <div class="gst-tooltip-header">
          <div class="gst-tooltip-icon invalid">✗</div>
          <span class="gst-tooltip-title">Invalid GSTIN Format</span>
        </div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">Found</span><span class="gst-tooltip-value red">${gstin}</span></div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">Issue</span><span class="gst-tooltip-value red">Format mismatch</span></div>
        <div class="gst-tooltip-row"><span class="gst-tooltip-label">Expected</span><span class="gst-tooltip-value">XX·AAAAA9999A·1Z9</span></div>
        <div class="gst-tooltip-footer">🧾 GST Copilot · Verify with your vendor</div>`;
    }
    positionTooltip(el);
    tooltip.style.opacity = '1';
  }

  function positionTooltip(el) {
    const r = el.getBoundingClientRect(), W = 260, H = 170;
    let left = r.left + window.scrollX;
    let top = r.bottom + window.scrollY + 8;
    if (left + W > window.innerWidth - 10) left = window.innerWidth - W - 10;
    if (top + H > window.scrollY + window.innerHeight - 10) top = r.top + window.scrollY - H - 8;
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() { if (tooltip) tooltip.style.opacity = '0'; }

  // ── Text GSTIN highlighting ──────────────────────────────────────────────────
  function highlightGSTINsInNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || !GSTIN_REGEX.test(text)) return false;
    GSTIN_REGEX.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0, match;
    const re = new RegExp(GSTIN_REGEX.source, 'g');

    while ((match = re.exec(text)) !== null) {
      if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));

      const gstin = match[0];
      const valid = isValidGSTIN(gstin);

      // Highlighted GSTIN span
      const span = document.createElement('span');
      span.className = valid ? 'gst-highlight-valid' : 'gst-highlight-invalid';
      span.textContent = gstin;
      span.dataset.gstin = gstin;
      span.title = valid ? `✓ Valid GSTIN — ${getState(gstin)}` : '✗ Invalid GSTIN format';
      span.addEventListener('mouseenter', () => showTooltip(span, gstin, valid));
      span.addEventListener('mouseleave', hideTooltip);
      if (valid) {
        span.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          navigator.clipboard && navigator.clipboard.writeText(gstin);
          span.textContent = '✓ Copied!';
          setTimeout(() => { span.textContent = gstin; }, 1200);
        });
      }
      frag.appendChild(span);

      // Validate icon button next to valid GSTINs
      if (valid) {
        const vBtn = document.createElement('button');
        vBtn.className = 'gst-validate-btn';
        vBtn.textContent = '✓';
        vBtn.title = `Validate ${gstin} in GSTCopilot`;
        vBtn.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          chrome.runtime.sendMessage({ action: 'openPopupAndValidate', gstin });
          // Visual feedback
          vBtn.textContent = '⟳';
          vBtn.style.background = '#d97706';
          setTimeout(() => { vBtn.textContent = '✓'; vBtn.style.background = ''; }, 1500);
        });
        frag.appendChild(vBtn);
      }

      last = re.lastIndex;
    }

    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
    return true;
  }

  // ── Scan page text ───────────────────────────────────────────────────────────
  const SKIP_TAGS = new Set(['script','style','noscript','textarea','input','select','code','pre','head','meta','link']);

  function scanNode(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName.toLowerCase())) return NodeFilter.FILTER_REJECT;
        if (p.classList.contains('gst-highlight-valid') || p.classList.contains('gst-highlight-invalid')) return NodeFilter.FILTER_REJECT;
        if (p.classList.contains('gst-validate-btn') || p.classList.contains('gst-autofill-btn')) return NodeFilter.FILTER_REJECT;
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    let found = false;
    for (const node of nodes) if (highlightGSTINsInNode(node)) found = true;
    return found;
  }

  function countHighlights() {
    const valid = document.querySelectorAll('.gst-highlight-valid').length;
    const invalid = document.querySelectorAll('.gst-highlight-invalid').length;
    return { valid, invalid, total: valid + invalid };
  }

  // ── Autofill buttons for GSTIN input fields ──────────────────────────────────
  const GSTIN_INPUT_SELECTORS = [
    'input[name*="gstin" i]', 'input[id*="gstin" i]', 'input[placeholder*="gstin" i]',
    'input[name*="gst" i]',   'input[id*="gst" i]',   'input[placeholder*="gst" i]',
    'input[maxlength="15"]',  'input[data-gstin]',
    'input[placeholder*="taxpayer" i]', 'input[id*="taxpayer" i]'
  ];

  let activeClientPanel = null;

  function isGSTINInput(el) {
    if (el.tagName !== 'INPUT') return false;
    if (el.dataset.gstAutofillDone) return false;
    const combined = (el.name + el.id + el.placeholder + (el.className || '')).toLowerCase();
    return /gstin|gst[^a-z]|taxpayer|15.digit/.test(combined) ||
           (el.maxLength === 15 && el.type !== 'hidden');
  }

  function addAutofillButton(input) {
    if (input.dataset.gstAutofillDone) return;
    input.dataset.gstAutofillDone = '1';

    // Wrap the input if it's not already wrapped
    const parent = input.parentElement;
    if (!parent) return;

    const btn = document.createElement('button');
    btn.className = 'gst-autofill-btn';
    btn.type = 'button';
    btn.innerHTML = '<span class="af-icon">📋</span> Autofill';
    btn.title = 'Fill from your client list';

    // Position absolutely relative to the input
    btn.style.position = 'absolute';
    btn.style.right = '6px';
    btn.style.top = '50%';
    btn.style.transform = 'translateY(-50%)';
    btn.style.zIndex = '2147483640';

    // Make parent relative if needed
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === 'static') parent.style.position = 'relative';

    // Add right padding to input so text isn't hidden under button
    const btnWidth = 90;
    const curPad = parseInt(window.getComputedStyle(input).paddingRight) || 0;
    input.style.paddingRight = Math.max(curPad, btnWidth + 10) + 'px';
    input.style.boxSizing = 'border-box';

    parent.appendChild(btn);

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      toggleClientPanel(input, btn);
    });
  }

  function toggleClientPanel(input, anchorBtn) {
    if (activeClientPanel) {
      activeClientPanel.remove();
      activeClientPanel = null;
      if (activeClientPanel) return;
    }
    openClientPanel(input, anchorBtn);
  }

  function openClientPanel(input, anchorBtn) {
    const panel = document.createElement('div');
    panel.className = 'gst-client-panel';
    activeClientPanel = panel;

    // Position below the input
    const rect = input.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = (rect.bottom + 6) + 'px';
    panel.style.left = Math.min(rect.left, window.innerWidth - 330) + 'px';

    panel.innerHTML = `
      <div class="gcp-header">
        <span class="gcp-title">📋 Client List — Autofill</span>
        <button class="gcp-close" id="gcp-close-btn">✕</button>
      </div>
      <div class="gcp-search">
        <input id="gcp-search-input" placeholder="Search client name or GSTIN…" autocomplete="off" />
      </div>
      <div class="gcp-list" id="gcp-list">
        <div class="gcp-empty"><div class="gcp-empty-icon">⏳</div>Loading clients…</div>
      </div>
      <div class="gcp-add-row">
        <input class="gcp-add-input" id="gcp-add-name" placeholder="Client name (optional)" />
        <input class="gcp-add-input" id="gcp-add-gstin" placeholder="GSTIN" maxlength="15" style="max-width:130px;text-transform:uppercase;font-family:'Courier New',monospace;font-size:11px" />
        <button class="gcp-save-btn" id="gcp-add-btn">+ Add</button>
      </div>`;

    document.body.appendChild(panel);

    // Close on outside click
    const outsideClose = e => {
      if (!panel.contains(e.target) && e.target !== anchorBtn) {
        panel.remove();
        activeClientPanel = null;
        document.removeEventListener('mousedown', outsideClose, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', outsideClose, true), 100);

    panel.querySelector('#gcp-close-btn').addEventListener('click', () => {
      panel.remove(); activeClientPanel = null;
    });

    // Load and render clients
    function renderClients(filter = '') {
      getClients(clients => {
        const list = panel.querySelector('#gcp-list');
        const f = filter.toLowerCase().trim();
        const filtered = f ? clients.filter(c => c.name.toLowerCase().includes(f) || c.gstin.toLowerCase().includes(f)) : clients;

        if (!filtered.length) {
          list.innerHTML = `<div class="gcp-empty">
            <div class="gcp-empty-icon">${clients.length ? '🔍' : '👥'}</div>
            ${clients.length ? 'No matching clients' : 'No clients saved yet.<br>Add one below or validate a GSTIN in the extension.'}
          </div>`;
          return;
        }

        list.innerHTML = filtered.map(c => `
          <div class="gcp-item" data-gstin="${c.gstin}">
            <div class="gcp-avatar">${c.name.charAt(0)}</div>
            <div class="gcp-info">
              <div class="gcp-name">${c.name}</div>
              <div class="gcp-gstin">${c.gstin}</div>
            </div>
            <button class="gcp-fill-btn" data-gstin="${c.gstin}">Fill ↵</button>
          </div>`).join('');

        list.querySelectorAll('.gcp-fill-btn').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            fillInput(input, btn.dataset.gstin);
            panel.remove(); activeClientPanel = null;
            document.removeEventListener('mousedown', outsideClose, true);
          });
        });
        list.querySelectorAll('.gcp-item').forEach(item => {
          item.addEventListener('click', () => {
            fillInput(input, item.dataset.gstin);
            panel.remove(); activeClientPanel = null;
            document.removeEventListener('mousedown', outsideClose, true);
          });
        });
      });
    }

    renderClients();

    // Search
    const searchInput = panel.querySelector('#gcp-search-input');
    searchInput.addEventListener('input', () => renderClients(searchInput.value));
    setTimeout(() => searchInput.focus(), 50);

    // Auto-uppercase GSTIN add input
    const addGSTIN = panel.querySelector('#gcp-add-gstin');
    addGSTIN.addEventListener('input', () => { addGSTIN.value = addGSTIN.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });

    // Add new client
    panel.querySelector('#gcp-add-btn').addEventListener('click', () => {
      const name  = panel.querySelector('#gcp-add-name').value.trim();
      const gstin = addGSTIN.value.trim().toUpperCase();
      if (!gstin || !isValidGSTIN(gstin)) {
        addGSTIN.style.borderColor = 'rgba(239,68,68,.6)';
        setTimeout(() => { addGSTIN.style.borderColor = ''; }, 1500);
        return;
      }
      saveClient(name || gstin, gstin, () => {
        panel.querySelector('#gcp-add-name').value = '';
        addGSTIN.value = '';
        renderClients(searchInput.value);
      });
    });
  }

  function fillInput(input, gstin) {
    input.value = gstin;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    input.focus();
    // Flash green
    const orig = input.style.borderColor;
    input.style.borderColor = '#16a34a';
    input.style.boxShadow = '0 0 0 3px rgba(22,163,74,.25)';
    setTimeout(() => { input.style.borderColor = orig; input.style.boxShadow = ''; }, 1200);
  }

  // ── Detect GSTIN inputs on page ─────────────────────────────────────────────
  function detectAndInjectAutofill() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      if (isGSTINInput(input)) addAutofillButton(input);
    });
  }

  // ── Floating badge ────────────────────────────────────────────────────────────
  let badge = null;

  function createBadge(validCount, invalidCount) {
    if (badge) badge.remove();
    badge = document.createElement('div');
    badge.id = 'gst-copilot-badge';
    badge.classList.add('gst-badge-hidden');
    badge.innerHTML = `
      <div class="gst-badge-header">
        <div class="gst-badge-logo">🧾</div>
        <span class="gst-badge-title">GST Copilot</span>
        <span class="gst-badge-close" id="gst-badge-close-btn">✕</span>
      </div>
      <div class="gst-badge-stats">
        <div class="gst-stat"><div class="gst-stat-num green">${validCount}</div><div class="gst-stat-label">Valid</div></div>
        <div class="gst-stat"><div class="gst-stat-num red">${invalidCount}</div><div class="gst-stat-label">Invalid</div></div>
        <div class="gst-stat"><div class="gst-stat-num" style="color:#94a3b8">${validCount+invalidCount}</div><div class="gst-stat-label">Total</div></div>
      </div>
      <div><span class="gst-badge-tag"><span>●</span> GST Checked</span></div>`;
    document.body.appendChild(badge);
    document.getElementById('gst-badge-close-btn').addEventListener('click', e => {
      e.stopPropagation();
      badge.classList.add('gst-badge-hidden');
    });
    setTimeout(() => badge.classList.remove('gst-badge-hidden'), 50);
  }

  function updateBadge() {
    if (!badge) return;
    const { valid, invalid } = countHighlights();
    const nums = badge.querySelectorAll('.gst-stat-num');
    if (nums[0]) nums[0].textContent = valid;
    if (nums[1]) nums[1].textContent = invalid;
    if (nums[2]) nums[2].textContent = valid + invalid;
  }

  // ── Extract first GSTIN from page ─────────────────────────────────────────
  function extractFirstGSTIN() {
    const text = document.body.innerText || '';
    const m = text.match(new RegExp(GSTIN_REGEX.source, 'g'));
    return m ? m[0] : null;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    createTooltip();

    // Scan text on all pages
    const found = scanNode(document.body);
    const { valid, invalid, total } = countHighlights();
    if (total > 0) createBadge(valid, invalid);

    // Autofill buttons — always inject but especially useful on gst.gov.in
    detectAndInjectAutofill();

    // MutationObserver for dynamic content (SPAs)
    const observer = new MutationObserver(mutations => {
      let needsBadgeUpdate = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scanNode(node);
            // Check for new GSTIN inputs
            if (node.tagName === 'INPUT' && isGSTINInput(node)) {
              addAutofillButton(node);
            } else {
              node.querySelectorAll && node.querySelectorAll('input').forEach(input => {
                if (isGSTINInput(input)) addAutofillButton(input);
              });
            }
            needsBadgeUpdate = true;
          }
        }
      }
      if (needsBadgeUpdate) {
        const counts = countHighlights();
        if (counts.total > 0 && !badge) createBadge(counts.valid, counts.invalid);
        else updateBadge();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }

  // ── Message listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.action === 'extractGST') {
      sendResponse({ gstin: extractFirstGSTIN(), found: true });
    }

    if (message.action === 'fillGSTIN' && message.gstin) {
      const selectors = [
        'input[name*="gstin" i]', 'input[id*="gstin" i]', 'input[placeholder*="gstin" i]',
        'input[name*="gst" i]',   'input[id*="gst" i]',
        'input[maxlength="15"]'
      ];
      let filled = false;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { fillInput(el, message.gstin); filled = true; break; }
      }
      sendResponse({ success: filled });
    }

    if (message.action === 'saveClient') {
      saveClient(message.name, message.gstin, () => sendResponse({ success: true }));
      return true; // async
    }

    if (message.action === 'getClients') {
      getClients(list => sendResponse({ clients: list }));
      return true; // async
    }

    return true;
  });

})();
