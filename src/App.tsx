import React, { useState } from "react";

export default function App() {
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [blueprintFile, setBlueprintFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [showJson, setShowJson] = useState(false);

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
          const parsedSettings = JSON.parse(rawLlmSettings);
          storedKey = parsedSettings.key || "";
          storedProvider = parsedSettings.provider || "gemini";
          storedModel = parsedSettings.model || "gemini-3.5-flash-lite";
        } catch (e) {
          console.error("Failed to parse specforge.llm from localStorage", e);
        }
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

      setParsedData(result.data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during parsing");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setParsedData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 font-sans text-gray-900">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold">Course Specification Intake</h1>
        <p className="text-sm text-gray-500">Upload a messy course spec and optional blueprint to parse and validate.</p>
      </div>

      <form onSubmit={handleUpload} className="p-5 border rounded-lg bg-gray-50 space-y-4 shadow-sm">
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

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Extracting & Parsing with AI..." : "Upload & Parse"}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
            <strong>Error:</strong> {error}
          </div>
        )}
      </form>

      {parsedData && (
        <div className="space-y-6">
          <div className="p-5 border rounded-lg bg-white shadow-sm space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Course Specification (Editable Form)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Course Code</label>
                <input
                  type="text"
                  value={parsedData.courseCode || ""}
                  onChange={(e) => handleFieldChange("courseCode", e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Course Title</label>
                <input
                  type="text"
                  value={parsedData.title || ""}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                <input
                  type="text"
                  value={parsedData.department || ""}
                  onChange={(e) => handleFieldChange("department", e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Credits (L:T:P)</label>
                <input
                  type="text"
                  value={parsedData.credits || ""}
                  onChange={(e) => handleFieldChange("credits", e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Course Type</label>
                <input
                  type="text"
                  value={parsedData.courseType || ""}
                  onChange={(e) => handleFieldChange("courseType", e.target.value)}
                  className="w-full border p-2 rounded text-sm"
                />
              </div>
            </div>

            {parsedData.units?.length > 0 && (
              <div className="pt-3">
                <h3 className="text-sm font-semibold mb-2">Extracted Units ({parsedData.units.length})</h3>
                <div className="space-y-2">
                  {parsedData.units.map((u: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded text-xs bg-gray-50">
                      <div className="font-semibold text-sm">Unit {u.unitNumber}: {u.title} ({u.hours} hrs)</div>
                      <div className="text-gray-600 mt-1 line-clamp-2">{u.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedData.courseOutcomes?.length > 0 && (
              <div className="pt-3">
                <h3 className="text-sm font-semibold mb-2">Course Outcomes ({parsedData.courseOutcomes.length})</h3>
                <div className="space-y-2">
                  {parsedData.courseOutcomes.map((co: any, idx: number) => (
                    <div key={idx} className="p-2 border rounded text-xs flex justify-between items-center bg-gray-50">
                      <div>
                        <span className="font-bold mr-2">{co.code}</span>
                        <span>{co.statement}</span>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] whitespace-nowrap ml-2">
                        {co.bloomsLevel || co.leadingVerb}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
        </div>
      )}
    </div>
  );
}