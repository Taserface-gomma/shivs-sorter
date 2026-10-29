import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

export interface DetectionResult {
  detectedTemplate: "integrated" | "non-lab";
  signals: string[];
}

export function detectTemplate(data: any): DetectionResult {
  const signals: string[] = [];
  const creditsStr = String(data.credits || "");
  const courseType = String(data.courseType || "").toLowerCase();

  // Rule 1: Non-zero Practical value in credit structure (e.g., L:T:P or "3:0:1" -> P=1)
  const parts = creditsStr.split(/[:\-\/]/).map((s) => s.trim());
  let practicalValue = 0;
  if (parts.length >= 3) {
    practicalValue = parseInt(parts[2], 10) || 0;
  }

  if (practicalValue > 0) {
    signals.push(`Practical credit P=${practicalValue} > 0 in structure '${creditsStr}'`);
  }

  // Rule 2: Course type containing 'laboratory' or 'integrated'
  if (courseType.includes("laboratory") || courseType.includes("lab")) {
    signals.push(`Course type contains 'laboratory' ('${data.courseType}')`);
  } else if (courseType.includes("integrated")) {
    signals.push(`Course type contains 'integrated' ('${data.courseType}')`);
  }

  const isIntegrated = signals.length > 0;
  return {
    detectedTemplate: isIntegrated ? "integrated" : "non-lab",
    signals: signals.length > 0 ? signals : ["No practical credits or laboratory markers found in course metadata"],
  };
}

export function fillTemplate(
  chosenTemplate: "integrated" | "non-lab",
  specData: any,
  blueprintData?: any
): { html: string; sampleStrings: string[] } {
  const filename = chosenTemplate === "integrated" ? "integrated_lab.html" : "non_lab.html";
  const templatePath = path.resolve(process.cwd(), "templates", filename);
  const rawHtml = fs.readFileSync(templatePath, "utf-8");

  const $ = cheerio.load(rawHtml);
  const sampleStrings: string[] = [];

  // Helper: Harvest existing sample string before updating
  function updateTableRow(labelSubstr: string, newVal: string | undefined) {
    if (!newVal) return;
    $("tr").each((_, tr) => {
      const staticTd = $(tr).find("td.static");
      if (staticTd.text().toLowerCase().includes(labelSubstr.toLowerCase())) {
        const targetTd = $(tr).find("td[contenteditable='true']");
        if (targetTd.length > 0) {
          const sampleText = targetTd.text().trim();
          if (sampleText && !sampleStrings.includes(sampleText)) {
            sampleStrings.push(sampleText);
          }
          targetTd.text(newVal);
        }
      }
    });
  }

  // Priority: Units and Course Outcomes come from blueprint if present
  const activeUnits = (blueprintData?.units && blueprintData.units.length > 0)
    ? blueprintData.units
    : (specData?.units || []);

  const activeCOs = (blueprintData?.courseOutcomes && blueprintData.courseOutcomes.length > 0)
    ? blueprintData.courseOutcomes
    : (specData?.courseOutcomes || []);

  // 1. Fill basic metadata
  updateTableRow("Course Title", specData.title);
  updateTableRow("Course Code", specData.courseCode);
  updateTableRow("Course Type", specData.courseType);
  updateTableRow("Department", specData.department);
  updateTableRow("Credits", specData.credits);
  updateTableRow("Number of Credits", specData.credits);

  // 2. Harvest sample unit strings and replace
  $("span.unit-label").each((_, labelSpan) => {
    const parentContainer = $(labelSpan).parent();
    const editableSpan = parentContainer.find("span[contenteditable='true']");
    if (editableSpan.length > 0) {
      const sample = editableSpan.text().trim();
      if (sample && !sampleStrings.includes(sample)) {
        sampleStrings.push(sample);
      }
    }
  });

  // Inject parsed units into the units container
  const firstUnitLabel = $("span.unit-label").first();
  if (firstUnitLabel.length > 0 && activeUnits.length > 0) {
    const unitsParent = firstUnitLabel.closest("div, td, section");
    if (unitsParent.length > 0) {
      unitsParent.empty();
      activeUnits.forEach((u: any, idx: number) => {
        const uNum = u.unitNumber || idx + 1;
        const uTitle = u.title ? `${u.title}: ` : "";
        const uContent = u.content || "";
        const uHours = u.hours ? ` (${u.hours} hrs)` : "";
        unitsParent.append(
          `<p style="margin-bottom: 8px;">
            <span class="static unit-label" style="padding: 1px 3px; border-radius: 2px; font-weight: bold;">Unit ${uNum}:</span>
            <span contenteditable="true">${uTitle}${uContent}${uHours}</span>
          </p>`
        );
      });
    }
  }

  // 3. Harvest sample CO rows and populate
  let coTable = $("table").filter((_, t) => {
    return $(t).text().toLowerCase().includes("course outcomes") || $(t).text().includes("CO1");
  }).first();

  if (coTable.length > 0 && activeCOs.length > 0) {
    const headerRow = coTable.find("tr").first();
    coTable.find("tr").slice(1).each((_, tr) => {
      const coText = $(tr).text().trim();
      if (coText && !sampleStrings.includes(coText)) {
        sampleStrings.push(coText);
      }
    });

    coTable.find("tr").slice(1).remove();
    activeCOs.forEach((co: any, idx: number) => {
      const code = co.code || `CO${idx + 1}`;
      const statement = co.statement || "";
      const bloom = co.bloomsLevel || co.leadingVerb || "";
      coTable.append(
        `<tr>
          <td class="static" style="font-weight: bold; width: 15%;">${code}</td>
          <td contenteditable="true" style="width: 70%;">${statement}</td>
          <td contenteditable="true" style="width: 15%; text-align: center;">${bloom}</td>
        </tr>`
      );
    });
  }

  return {
    html: $.html(),
    sampleStrings,
  };
}