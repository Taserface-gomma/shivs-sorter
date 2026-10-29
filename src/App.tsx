import React, { useState } from "react";

export default function App() {
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [blueprintFile, setBlueprintFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [blueprintData, setBlueprintData] = useState<any>(null);
  const [showJson, setShowJson] = useState(false);

  // Level 2 Template States
  const [detectedTemplate, setDetectedTemplate] = useState<string>("");
  const [signals, setSignals] = useState<string[]>([]);
  const [chosenTemplate, setChosenTemplate] = useState<string>("non-lab");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [renderedHtml, setRenderedHtml] = useState<string>("");

  const fetchRenderedTemplate = async (spec: any, bp: any, templateType: string, reason: string) => {
    try {
      const res = await fetch("/api/v1/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specData: spec,
          blueprintData: bp,
          overrideTemplate: templateType,
          overrideReason: reason,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error?.message || "Failed to generate template");
      }

      setDetectedTemplate(resData.data.detectedTemplate);
      setSignals(resData.data.signals || []);
      setRenderedHtml(resData.data.html);
    } catch (err: any) {
      console.error("Template rendering failed:", err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specFile) {
      setError("Please select the required Course Specification file.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("spec", specFile);
    if (blueprintFile) {
      formData.append("blueprint", blueprintFile);
    }

    try {
      let storedKey = "";
      let storedProvider = "gemini";
      let storedModel = "gemini-3.5-flash-lite";

      const rawLlmSettings = localStorage.getItem("specforge.llm");
      if (rawLlmSettings) {
        try {
          const parsed = JSON.parse(rawLlmSettings);
          storedKey = parsed.key || "";
          storedProvider = parsed.provider || "gemini";
          storedModel = parsed.model || "gemini-3.5-flash-lite";
        } catch (e) {}
      }

      if (!storedModel || storedModel === "gemini-2.5-flash-lite") {
        storedModel = "gemini-3.5-flash-lite";
      }

      const headers: Record<string, string> = {
        "x-llm-key": storedKey.trim(),
        "x-llm-provider": storedProvider.trim(),
        "x-llm-model": storedModel.trim(),
      };

      const res = await fetch("/api/v1/parse", {
        method: "POST",
        body: formData,
        headers,
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || result.error || result.message || "Failed to parse files");
      }

      const spec = result.data.spec || result.data;
      const bp = result.data.blueprint || null;

      setParsedData(spec);
      setBlueprintData(bp);

      // Detection rule
      const credits = String(spec.credits || "");
      const cType = String(spec.courseType || "").toLowerCase();
      const parts = credits.split(/[:\-\/]/).map((s: string) => s.trim());
      const pVal = parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
      const isInt = pVal > 0 || cType.includes("laboratory") || cType.includes("lab") || cType.includes("integrated");
      const initialTemplate = isInt ? "integrated" : "non-lab";

      setChosenTemplate(initialTemplate);
      await fetchRenderedTemplate(spec, bp, initialTemplate, "");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during parsing");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (newTemplate: string) => {
    setChosenTemplate(newTemplate);
    if (parsedData) {
      fetchRenderedTemplate(parsedData, blueprintData, newTemplate, overrideReason);
    }
  };

  const handleReasonChange = (reason: string) => {
    setOverrideReason(reason);
    if (parsedData) {
      fetchRenderedTemplate(parsedData, blueprintData, chosenTemplate, reason);
    }
  };

  const handleExportSpec = () => {
    if (!renderedHtml) return;
    const blob = new Blob([renderedHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "spec.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 font-sans text-gray-900">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">Course Specification Intake & Templating</h1>
        <p className="text-sm text-gray-500">
          Upload specification & blueprint, auto-detect template, fill with cheerio, and export spec.html.
        </p>
      </div>

      <form onSubmit={handleUpload} className="p-5 border rounded-lg bg-gray-50 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Course Specification (.docx, .pdf, .html, .doc) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".docx,.pdf,.html,.htm,.doc"
              onChange={(e) => setSpecFile(e.target.files?.[0] || null)}
              className="block w-full text-sm border p-2 rounded bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Question-Paper Blueprint (.docx, .pdf, .html, .doc) <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="file"
              accept=".docx,.pdf,.html,.htm,.doc"
              onChange={(e) => setBlueprintFile(e.target.files?.[0] || null)}
              className="block w-full text-sm border p-2 rounded bg-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Extracting & Templating..." : "Upload & Parse"}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </form>

      {/* Level 2 Template Section */}
      {parsedData && (
        <div className="p-5 border rounded-lg bg-white shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
            <div>
              <h2 className="text-lg font-bold">Template Selection</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">Auto-Detection:</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                    detectedTemplate === "integrated"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  Detected: {detectedTemplate === "integrated" ? "Integrated" : "Non-Lab"}
                </span>
              </div>
            </div>

            <button
              onClick={handleExportSpec}
              disabled={!renderedHtml}
              className="px-4 py-2 bg-emerald-600 text-white rounded font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
            >
              Export spec (spec.html)
            </button>
          </div>

          <div className="bg-gray-50 p-3 rounded border text-xs text-gray-700 space-y-1">
            <span className="font-semibold block text-gray-800">Signals used:</span>
            {signals.map((sig, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-blue-500 font-bold">•</span>
                <span>{sig}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Manual Override Template</label>
              <select
                value={chosenTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full border p-2 rounded text-sm bg-white"
              >
                <option value="non-lab">Non-Lab Template (non_lab.html)</option>
                <option value="integrated">Integrated Lab Template (integrated_lab.html)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Override</label>
              <input
                type="text"
                placeholder="e.g., Department mandates integrated structure for this cohort"
                value={overrideReason}
                onChange={(e) => handleReasonChange(e.target.value)}
                className="w-full border p-2 rounded text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Live HTML Preview */}
      {renderedHtml && (
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="bg-gray-100 p-3 border-b flex justify-between items-center text-sm font-semibold">
            <span>Filled Document Preview (spec.html)</span>
            <span className="text-xs text-gray-500">Live preview of cheerio-populated HTML</span>
          </div>
          <iframe
            srcDoc={renderedHtml}
            title="Spec Preview"
            className="w-full h-[650px] border-none bg-white"
          />
        </div>
      )}

      {/* Collapsible Raw JSON */}
      {parsedData && (
        <div className="border rounded-lg bg-gray-50 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="w-full p-3 font-semibold text-sm flex justify-between items-center bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <span>Structured Spec JSON</span>
            <span className="text-xs text-gray-600">{showJson ? "▲ Collapse" : "▼ Expand to View"}</span>
          </button>
          {showJson && (
            <pre className="p-4 bg-gray-950 text-emerald-400 text-xs overflow-x-auto max-h-96">
              {JSON.stringify(parsedData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
