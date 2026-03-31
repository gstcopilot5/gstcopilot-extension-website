import { useState } from "react";

const FILES = [
  { name: "manifest.json", desc: "Chrome Manifest V3 configuration" },
  { name: "popup.html", desc: "400×600 green UI popup" },
  { name: "popup.js", desc: "GSTIN validation, HSN lookup, dispute text" },
  { name: "content.js", desc: "Page GST extractor & form filler" },
];

export default function GSTCopilotPage() {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function downloadZip() {
    setDownloading(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder("gst-copilot-extension")!;

      // Fetch each file from /extension/
      const fileNames = ["manifest.json", "popup.html", "popup.js", "content.js"];
      const base = import.meta.env.BASE_URL;

      await Promise.all(
        fileNames.map(async (fname) => {
          const res = await fetch(`${base}extension/${fname}`);
          const text = await res.text();
          folder.file(fname, text);
        })
      );

      // Add icons placeholder note
      folder.file(
        "icons/README.txt",
        "Add icon16.png (16x16), icon48.png (48x48), icon128.png (128x128) here.\nYou can use any green GST-themed icons."
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gst-copilot-extension.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  function copyInstall() {
    const text = `1. Extract gst-copilot-extension.zip\n2. Open Chrome → chrome://extensions\n3. Enable "Developer mode" (top right)\n4. Click "Load unpacked" → select the extracted folder\n5. GST Copilot icon appears in toolbar!`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 text-white px-6 py-5 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🧾</div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">GST Copilot</h1>
              <p className="text-green-200 text-sm">Chrome Extension · Manifest V3</p>
            </div>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/30">
            v1.0.0
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Download Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 text-white text-center">
            <div className="text-4xl mb-2">📦</div>
            <h2 className="text-xl font-bold">Download Extension ZIP</h2>
            <p className="text-green-100 text-sm mt-1">Ready to install in Chrome — all 4 files included</p>
          </div>
          <div className="px-6 py-5">
            <button
              onClick={downloadZip}
              disabled={downloading}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold text-lg rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:transform-none"
            >
              {downloading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Building ZIP...
                </span>
              ) : (
                "⬇ Download gst-copilot-extension.zip"
              )}
            </button>

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-amber-800 font-semibold text-sm mb-1">📋 Install Instructions</p>
                  <ol className="text-amber-700 text-xs space-y-1 list-decimal list-inside">
                    <li>Extract the downloaded ZIP file</li>
                    <li>Open Chrome → <code className="bg-amber-100 px-1 rounded">chrome://extensions</code></li>
                    <li>Enable <strong>Developer mode</strong> (toggle top-right)</li>
                    <li>Click <strong>"Load unpacked"</strong> → select extracted folder</li>
                    <li>GST Copilot icon appears in your toolbar ✓</li>
                  </ol>
                </div>
                <button
                  onClick={copyInstall}
                  className="shrink-0 text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-200 transition-colors font-medium"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Files Included */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 px-6 py-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>🗂</span> Files Included
          </h3>
          <div className="space-y-3">
            {FILES.map((f) => (
              <div key={f.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-700 font-mono text-xs font-bold shrink-0">
                  {f.name.split(".")[1].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{f.name}</p>
                  <p className="text-gray-500 text-xs">{f.desc}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 text-xs font-bold shrink-0">
                ICO
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">icons/</p>
                <p className="text-gray-500 text-xs">Add icon16.png, icon48.png, icon128.png (green themed)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 px-6 py-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>✨</span> Features
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "🔍", title: "GSTIN Validation", desc: "Format check + GSTZen API lookup" },
              { icon: "📋", title: "HSN Code Lookup", desc: "Rate check with dispute text gen" },
              { icon: "⚡", title: "Page Extraction", desc: "Auto-detects GSTIN on any webpage" },
              { icon: "💬", title: "Dispute Text", desc: "1-click copy for tax rate disputes" },
              { icon: "🔢", title: "Free 3 Checks", desc: "Freemium with Razorpay ₹499 upgrade" },
              { icon: "📑", title: "State Decoder", desc: "Extracts state, PAN, entity from GSTIN" },
            ].map((f) => (
              <div key={f.title} className="p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="text-xl mb-1">{f.icon}</div>
                <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Razorpay note */}
        <div className="bg-slate-800 rounded-2xl px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">💳</span>
            <div>
              <h3 className="font-bold">Monetization Ready</h3>
              <p className="text-slate-400 text-xs">Razorpay ₹499 upgrade button is pre-wired in popup</p>
            </div>
          </div>
          <p className="text-slate-300 text-sm">
            The Razorpay payment link (<code className="bg-slate-700 text-green-400 px-1.5 py-0.5 rounded text-xs">rzp.io/rzp/VPKO7Nvp</code>) is already wired into the{" "}
            <code className="bg-slate-700 text-green-400 px-1.5 py-0.5 rounded text-xs">popup.html</code> upgrade button and ready to accept payments.
          </p>
        </div>

      </div>
    </div>
  );
}
