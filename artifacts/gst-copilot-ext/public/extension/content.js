// GST Copilot - content.js (Enhanced)
// Auto-detects, highlights, validates GSTINs on any webpage

(function () {
  if (window.__gstCopilotInjected) return;
  window.__gstCopilotInjected = true;

  const GSTIN_REGEX = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g;

  const STATE_CODES = {
    '01': 'J&K', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
    '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana',
    '37': 'Andhra Pradesh (New)'
  };

  function isValidGSTIN(gstin) {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  }

  function getStateFromGSTIN(gstin) {
    return STATE_CODES[gstin.substring(0, 2)] || 'Unknown State';
  }

  function getPANFromGSTIN(gstin) {
    return gstin.substring(2, 12);
  }

  // ─── Inject Styles ────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('gst-copilot-styles')) return;
    const style = document.createElement('style');
    style.id = 'gst-copilot-styles';
    style.textContent = `
      .gst-highlight-valid {
        background: linear-gradient(135deg, #dcfce7, #bbf7d0) !important;
        border: 1.5px solid #16a34a !important;
        border-radius: 4px !important;
        padding: 1px 4px !important;
        cursor: pointer !important;
        font-family: 'Courier New', monospace !important;
        font-weight: 600 !important;
        color: #14532d !important;
        position: relative !important;
        display: inline-block !important;
        transition: all 0.2s !important;
      }
      .gst-highlight-valid:hover {
        background: linear-gradient(135deg, #bbf7d0, #86efac) !important;
        box-shadow: 0 2px 8px rgba(22,163,74,0.3) !important;
        transform: translateY(-1px) !important;
      }
      .gst-highlight-invalid {
        background: linear-gradient(135deg, #fee2e2, #fecaca) !important;
        border: 1.5px solid #ef4444 !important;
        border-radius: 4px !important;
        padding: 1px 4px !important;
        font-family: 'Courier New', monospace !important;
        font-weight: 600 !important;
        color: #7f1d1d !important;
        display: inline-block !important;
        position: relative !important;
      }

      /* Tooltip */
      .gst-tooltip {
        position: fixed;
        z-index: 2147483647;
        background: #0f172a;
        color: #f8fafc;
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        line-height: 1.5;
        box-shadow: 0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
        pointer-events: none;
        min-width: 220px;
        max-width: 280px;
        transition: opacity 0.15s;
      }
      .gst-tooltip-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        padding-bottom: 7px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .gst-tooltip-icon {
        width: 22px;
        height: 22px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .gst-tooltip-icon.valid { background: #16a34a; }
      .gst-tooltip-icon.invalid { background: #ef4444; }
      .gst-tooltip-title {
        font-weight: 700;
        font-size: 12px;
        letter-spacing: -0.2px;
      }
      .gst-tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 2px 0;
      }
      .gst-tooltip-label { color: #94a3b8; font-size: 11px; }
      .gst-tooltip-value {
        color: #e2e8f0;
        font-size: 11px;
        font-weight: 500;
        text-align: right;
        font-family: 'Courier New', monospace;
        word-break: break-all;
      }
      .gst-tooltip-value.green { color: #4ade80; }
      .gst-tooltip-value.red { color: #f87171; }
      .gst-tooltip-footer {
        margin-top: 8px;
        padding-top: 7px;
        border-top: 1px solid rgba(255,255,255,0.08);
        color: #64748b;
        font-size: 10px;
        text-align: center;
      }

      /* Floating Badge */
      #gst-copilot-badge {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483646;
        background: linear-gradient(135deg, #0f172a, #1e293b);
        color: #f8fafc;
        border-radius: 12px;
        padding: 10px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.07);
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        min-width: 190px;
        user-select: none;
      }
      #gst-copilot-badge:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1);
      }
      #gst-copilot-badge.gst-badge-hidden {
        transform: translateY(80px);
        opacity: 0;
        pointer-events: none;
      }
      .gst-badge-header {
        display: flex;
        align-items: center;
        gap: 7px;
        margin-bottom: 6px;
      }
      .gst-badge-logo {
        width: 20px;
        height: 20px;
        background: #16a34a;
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      }
      .gst-badge-title {
        font-weight: 700;
        font-size: 12px;
        letter-spacing: -0.2px;
        flex: 1;
      }
      .gst-badge-close {
        color: #475569;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        padding: 0 2px;
        transition: color 0.15s;
      }
      .gst-badge-close:hover { color: #94a3b8; }
      .gst-badge-stats {
        display: flex;
        gap: 6px;
      }
      .gst-stat {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border-radius: 7px;
        padding: 5px 8px;
        text-align: center;
        border: 1px solid rgba(255,255,255,0.06);
      }
      .gst-stat-num {
        font-size: 16px;
        font-weight: 800;
        line-height: 1.2;
      }
      .gst-stat-num.green { color: #4ade80; }
      .gst-stat-num.red { color: #f87171; }
      .gst-stat-label { font-size: 9px; color: #64748b; margin-top: 1px; letter-spacing: 0.3px; text-transform: uppercase; }
      .gst-badge-tag {
        margin-top: 6px;
        background: rgba(22,163,74,0.15);
        border: 1px solid rgba(22,163,74,0.3);
        color: #4ade80;
        font-size: 10px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 20px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Tooltip ─────────────────────────────────────────────────────────────
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
    const state = getStateFromGSTIN(gstin);
    const pan = getPANFromGSTIN(gstin);
    const entityCode = gstin[12];
    const entityType = entityCode === '1' ? 'Proprietor' : entityCode === '2' ? 'Partnership' : entityCode === '4' ? 'Public Company' : 'Private Company';

    if (isValid) {
      tooltip.innerHTML = `
        <div class="gst-tooltip-header">
          <div class="gst-tooltip-icon valid">✓</div>
          <span class="gst-tooltip-title">Valid GSTIN</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">GSTIN</span>
          <span class="gst-tooltip-value green">${gstin}</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">State</span>
          <span class="gst-tooltip-value">${state}</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">PAN</span>
          <span class="gst-tooltip-value">${pan}</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">Entity Type</span>
          <span class="gst-tooltip-value">${entityType}</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">State Code</span>
          <span class="gst-tooltip-value">${gstin.substring(0, 2)}</span>
        </div>
        <div class="gst-tooltip-footer">🧾 GST Copilot · Click to copy</div>
      `;
    } else {
      tooltip.innerHTML = `
        <div class="gst-tooltip-header">
          <div class="gst-tooltip-icon invalid">✗</div>
          <span class="gst-tooltip-title">Invalid GSTIN Format</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">Found</span>
          <span class="gst-tooltip-value red">${gstin}</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">Issue</span>
          <span class="gst-tooltip-value red">Format mismatch</span>
        </div>
        <div class="gst-tooltip-row">
          <span class="gst-tooltip-label">Expected</span>
          <span class="gst-tooltip-value">XX·AAAAA9999A·1Z9</span>
        </div>
        <div class="gst-tooltip-footer">🧾 GST Copilot · Verify with your vendor</div>
      `;
    }

    positionTooltip(el);
    tooltip.style.opacity = '1';
  }

  function positionTooltip(el) {
    const rect = el.getBoundingClientRect();
    const tipW = 260;
    const tipH = 160;
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;

    if (left + tipW > window.innerWidth - 10) left = window.innerWidth - tipW - 10;
    if (top + tipH > window.scrollY + window.innerHeight - 10) {
      top = rect.top + window.scrollY - tipH - 8;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.opacity = '0';
  }

  // ─── Badge ────────────────────────────────────────────────────────────────
  let badge = null;

  function createBadge(validCount, invalidCount, totalCount) {
    if (badge) badge.remove();

    badge = document.createElement('div');
    badge.id = 'gst-copilot-badge';
    badge.innerHTML = `
      <div class="gst-badge-header">
        <div class="gst-badge-logo">🧾</div>
        <span class="gst-badge-title">GST Copilot</span>
        <span class="gst-badge-close" id="gst-badge-close-btn">✕</span>
      </div>
      <div class="gst-badge-stats">
        <div class="gst-stat">
          <div class="gst-stat-num green">${validCount}</div>
          <div class="gst-stat-label">Valid</div>
        </div>
        <div class="gst-stat">
          <div class="gst-stat-num red">${invalidCount}</div>
          <div class="gst-stat-label">Invalid</div>
        </div>
        <div class="gst-stat">
          <div class="gst-stat-num" style="color:#94a3b8">${totalCount}</div>
          <div class="gst-stat-label">Total</div>
        </div>
      </div>
      <div>
        <span class="gst-badge-tag">
          <span>●</span> GST Checked
        </span>
      </div>
    `;

    document.body.appendChild(badge);

    document.getElementById('gst-badge-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      badge.classList.add('gst-badge-hidden');
    });

    // Animate in
    setTimeout(() => badge.classList.remove('gst-badge-hidden'), 50);
  }

  // ─── Highlight GSTINs in text nodes ──────────────────────────────────────
  function highlightGSTINsInNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || !text.match(GSTIN_REGEX)) return false;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    const regex = new RegExp(GSTIN_REGEX.source, 'g');

    while ((match = regex.exec(text)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const gstin = match[0];
      const valid = isValidGSTIN(gstin);
      const span = document.createElement('span');
      span.className = valid ? 'gst-highlight-valid' : 'gst-highlight-invalid';
      span.textContent = gstin;
      span.dataset.gstin = gstin;
      span.dataset.valid = valid;
      span.title = valid ? `✓ Valid GSTIN — ${getStateFromGSTIN(gstin)}` : '✗ Invalid GSTIN format';

      // Hover tooltip
      span.addEventListener('mouseenter', () => showTooltip(span, gstin, valid));
      span.addEventListener('mouseleave', hideTooltip);

      // Click to copy valid GSTIN
      if (valid) {
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.clipboard && navigator.clipboard.writeText(gstin);
          showCopiedFeedback(span);
        });
      }

      fragment.appendChild(span);
      lastIndex = regex.lastIndex;
    }

    // Remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
    return true;
  }

  function showCopiedFeedback(span) {
    const original = span.textContent;
    span.textContent = '✓ Copied!';
    setTimeout(() => { span.textContent = original; }, 1200);
  }

  // ─── Scan Page ────────────────────────────────────────────────────────────
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'textarea', 'input', 'select', 'code', 'pre', 'head', 'meta', 'link']);

  function scanNode(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName.toLowerCase())) return NodeFilter.FILTER_REJECT;
          if (parent.classList.contains('gst-highlight-valid') || parent.classList.contains('gst-highlight-invalid')) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    let found = false;
    for (const node of nodes) {
      if (highlightGSTINsInNode(node)) found = true;
    }
    return found;
  }

  function countHighlights() {
    const valid = document.querySelectorAll('.gst-highlight-valid').length;
    const invalid = document.querySelectorAll('.gst-highlight-invalid').length;
    return { valid, invalid, total: valid + invalid };
  }

  // ─── Auto-extract text for popup ─────────────────────────────────────────
  function extractFirstGSTIN() {
    const allText = document.body.innerText || '';
    const matches = allText.match(new RegExp(GSTIN_REGEX.source, 'g'));
    return matches ? matches[0] : null;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    createTooltip();

    // Auto-scan page
    const found = scanNode(document.body);
    const { valid, invalid, total } = countHighlights();

    if (total > 0) {
      createBadge(valid, invalid, total);
    }

    // Watch for dynamic content (SPAs, lazy-loaded sections)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scanNode(node);
          }
        }
      }
      // Update badge
      const counts = countHighlights();
      if (badge && counts.total > 0) {
        const nums = badge.querySelectorAll('.gst-stat-num');
        if (nums[0]) nums[0].textContent = counts.valid;
        if (nums[1]) nums[1].textContent = counts.invalid;
        if (nums[2]) nums[2].textContent = counts.total;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay so page has finished rendering
    setTimeout(init, 300);
  }

  // ─── Message listener (from popup) ────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractGST') {
      const gstin = extractFirstGSTIN();
      sendResponse({ gstin, found: !!gstin });
    }

    if (message.action === 'fillGSTIN' && message.gstin) {
      const selectors = [
        'input[name*="gstin" i]', 'input[id*="gstin" i]', 'input[placeholder*="gstin" i]',
        'input[name*="gst" i]', 'input[id*="gst" i]', 'input[placeholder*="gst" i]'
      ];
      let filled = false;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.value = message.gstin;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filled = true;
          break;
        }
      }
      sendResponse({ success: filled });
    }

    return true;
  });

})();
