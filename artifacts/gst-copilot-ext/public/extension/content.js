// GST Copilot - content.js
// Extracts GSTIN and GST-related text from the active web page

(function () {
  // GSTIN pattern: 2 digits, 5 uppercase letters, 4 digits, 1 letter, 1 alphanumeric, Z, 1 alphanumeric
  const GSTIN_REGEX = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g;

  function extractGSTIN(text) {
    const matches = text.match(GSTIN_REGEX);
    if (matches && matches.length > 0) {
      return matches[0]; // Return first found GSTIN
    }
    return null;
  }

  function getPageText() {
    // Get all visible text from the page
    const body = document.body;
    const walker = document.createTreeWalker(
      body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          // Skip hidden elements and scripts/styles
          if (['script', 'style', 'noscript', 'meta', 'head'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node;
    while ((node = walker.nextNode())) {
      text += ' ' + node.nodeValue;
    }
    return text;
  }

  function fillInputField(gstin) {
    // Try to fill any visible GSTIN/GST input field on the page
    const selectors = [
      'input[name*="gstin" i]',
      'input[id*="gstin" i]',
      'input[placeholder*="gstin" i]',
      'input[name*="gst" i]',
      'input[id*="gst" i]',
      'input[placeholder*="gst" i]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.value = gstin;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractGST') {
      const pageText = getPageText();
      const gstin = extractGSTIN(pageText);

      if (gstin) {
        // Try to also fill any GSTIN input on the current page
        fillInputField(gstin);
        sendResponse({ gstin: gstin, found: true });
      } else {
        sendResponse({ gstin: null, found: false });
      }
    }

    if (message.action === 'fillGSTIN' && message.gstin) {
      const filled = fillInputField(message.gstin);
      sendResponse({ success: filled });
    }

    return true; // Keep message channel open for async response
  });

})();
