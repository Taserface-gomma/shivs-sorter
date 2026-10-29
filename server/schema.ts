import { z } from "zod";

export const CourseOutcomeSchema = z.object({
  code: z.string(), // e.g. CO1
  statement: z.string(),
  leadingVerb: z.string(),
  bloomsLevel: z.string() // e.g. L2 - Understand, L3 - Apply
});

export const UnitSchema = z.object({
  unitNumber: z.number().or(z.string()),
  title: z.string(),
  content: z.string(),
  hours: z.number().or(z.string())
});

export const AssessmentItemSchema = z.object({
  component: z.string(),
  marks: z.number().or(z.string()),
  weightagePercent: z.number().or(z.string())
});

export const CourseSpecSchema = z.object({
  courseCode: z.string(),
  title: z.string(),
  department: z.string(),
  credits: z.string(), // e.g. "3:0:1"
  courseType: z.string(), // Integrated or Non-Lab
  courseOutcomes: z.array(CourseOutcomeSchema).default([]),
  units: z.array(UnitSchema).default([]),
  existingCoPoMap: z.record(z.string(), z.any()).optional().default({}),
  teachingHoursTable: z.record(z.string(), z.any()).optional().default({}),
  assessmentTable: z.array(AssessmentItemSchema).optional().default([]),
  resources: z.array(z.string()).optional().default([])
});

export type CourseSpec = z.infer<typeof CourseSpecSchema>;
export type CourseOutcome = z.infer<typeof CourseOutcomeSchema>;
export type Unit = z.infer<typeof UnitSchema>;