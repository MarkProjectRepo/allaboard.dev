import type { Grade } from "./types";

/**
 * Maps Font-scale grade strings to V-scale Grade values.
 * Some Font grades share a V-grade (e.g. 6a and 6a+ are both V3).
 * Keys are stored in lowercase for case-insensitive lookup.
 */
const FONT_TO_V: Record<string, Grade> = {
  "4":   "V0",
  "5":   "V1",
  "5+":  "V2",
  "6a":  "V3",
  "6a+": "V3",
  "6b":  "V4",
  "6b+": "V4",
  "6c":  "V5",
  "6c+": "V5+",
  "7a":  "V6",
  "7a+": "V7",
  "7b":  "V8",
  "7b+": "V8+",
  "7c":  "V9",
  "7c+": "V10",
  "8a":  "V11",
  "8a+": "V12",
  "8b":  "V13",
  "8b+": "V14",
  "8c":  "V15",
  "8c+": "V16",
  "9a":  "V17",
  "9a+": "V18",
};

/**
 * Normalise a raw Font-scale grade string before lookup:
 * - Grades starting with "4" (e.g. "4a", "4b", "4c") → "4"
 * - Grades starting with "5" but NOT "5+" (e.g. "5a", "5b", "5c") → "5"
 * - Everything else is left unchanged.
 */
function normalise(grade: string): string {
  if (/^4[a-z]/i.test(grade)) return "4";
  if (/^5[a-z]/i.test(grade) && !grade.endsWith("+")) return "5";
  return grade;
}

/**
 * Convert a Font-scale grade string to a V-scale Grade.
 * Returns `null` if the grade is not recognised.
 */
export function fontToVGrade(fontGrade: string): Grade | null {
  const key = normalise(fontGrade.trim().toLowerCase());
  return FONT_TO_V[key] ?? null;
}
