import { detectTemplate, fillTemplate } from "./templateFiller.js";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import mammoth from "mammoth";
// @ts-ignore
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import * as cheerio from "cheerio";
// @ts-ignore
import WordExtractor from "word-extractor";
import { ApiError, fail, ok } from "./envelope.js";
import { configFromRequest, generateJson } from "./llm.js";
import { CourseSpecSchema } from "./schema.js";
const app = express();
app.use(express.json({ limit: "10mb" }));

const api = express.Router();

api.get("/health", (_req, res) => ok(res, { status: "up" }));

// "Test key" button in Settings. Proves the key and model work, nothing more.
api.get("/llm-check", async (req, res, next) => {
  try {
    const cfg = configFromRequest(req);
    const out = await generateJson('Return exactly {"pong": true}', z.object({ pong: z.boolean() }), cfg);
    ok(res, { provider: cfg.provider, model: cfg.model, reply: out });
  } catch (e) {
    next(e);
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Helper to extract plain text based on file format
async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  const ext = file.originalname.split(".").pop()?.toLowerCase();
  try {
    if (ext === "docx") {
      const res = await mammoth.extractRawText({ buffer: file.buffer });
      return res.value;
    } else if (ext === "doc") {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(file.buffer);
      return extracted.getBody();
    } else if (ext === "pdf") {
      const data = await (pdfParse as any)(file.buffer);
      return data.text;
    } else if (ext === "html" || ext === "htm") {
      const $ = cheerio.load(file.buffer.toString("utf-8"));
      return $("body").text() || $.text();
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }
  } catch (err: any) {
    throw new ApiError(400, "PARSE_ERROR", `Failed to read ${file.originalname}: ${err.message}`);
  }
}

// Level 1: POST /api/v1/parse
api.post(
  "/parse",
  upload.fields([
    { name: "spec", maxCount: 1 },
    { name: "blueprint", maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const specFile = files?.spec?.[0];

      if (!specFile) {
        return fail(res, 400, "MISSING_FILE", "Required field 'spec' document is missing.");
      }

      const specText = await extractTextFromFile(specFile);
      let blueprintText = "";
      if (files?.blueprint?.[0]) {
        blueprintText = await extractTextFromFile(files.blueprint[0]);
      }

      const prompt = `
Extract and sanitize the course specification details from the text below.
Return a structured JSON object strictly matching the required schema:
- courseCode: string
- title: string
- department: string
- credits: string formatted as L:T:P (e.g. "3:0:1" or "3:0:0")
- courseType: "Integrated" if practical/lab credits > 0, otherwise "Non-Lab"
- courseOutcomes: array of objects with { code, statement, leadingVerb, bloomsLevel }
- units: array of objects with { unitNumber, title, content, hours }
- existingCoPoMap: object representing the extracted CO-PO map table
- teachingHoursTable: object with lecture/tutorial/practical hour breakdown
- assessmentTable: array of { component, marks, weightagePercent }
- resources: array of strings

SPECIFICATION DOCUMENT:
${specText}

${blueprintText ? `BLUEPRINT DOCUMENT:\n${blueprintText}` : ""}
`;

      const cfg = configFromRequest(req);
      const parsedData = await generateJson(prompt, CourseSpecSchema, cfg);

      return ok(res, parsedData);
    } catch (err) {
      next(err);
    }
  }
);

// Level 3: POST /api/v1/generate
api.post("/generate", upload.fields([{ name: "spec", maxCount: 1 }, { name: "blueprint", maxCount: 1 }]), (_req, res) => {
  fail(res, 501, "NOT_BUILT", "POST /api/v1/generate is not built yet (Level 3).");
});

app.use("/api/v1", api);
app.use("/api", (_req, res) => fail(res, 404, "NOT_FOUND", "No such route"));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) return fail(res, err.status, err.code, err.message);
  console.error("Unhandled:", err instanceof Error ? err.message : "unknown error");
  fail(res, 500, "SERVER_ERROR", "Something went wrong on the server.");
});
api.post("/generate-template", (req: Request, res: Response) => {
  try {
    const { specData, blueprintData, overrideTemplate, overrideReason } = req.body;
    if (!specData) {
      return fail(res, 400, "MISSING_DATA", "Missing specData in request body");
    }

    const detection = detectTemplate(specData);
    const chosenTemplate = (overrideTemplate || detection.detectedTemplate) as "integrated" | "non-lab";

    const { html, sampleStrings } = fillTemplate(chosenTemplate, specData, blueprintData);

    return ok(res, {
      html,
      detectedTemplate: detection.detectedTemplate,
      appliedTemplate: chosenTemplate,
      signals: detection.signals,
      isOverridden: Boolean(overrideTemplate && overrideTemplate !== detection.detectedTemplate),
      overrideReason: overrideReason || "",
      sampleStrings,
    });
  } catch (err: any) {
    return fail(res, 500, "TEMPLATE_ERROR", err.message || "Failed to render template");
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API on http://localhost:${port}/api/v1`));