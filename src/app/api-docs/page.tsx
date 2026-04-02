import type { Metadata } from "next";
import DynamicScalar from "./DynamicScalar";

export const metadata: Metadata = {
  title: "API Reference — allaboard",
  description: "Interactive REST API documentation for the Allaboard climbing community platform.",
};

export default function ApiDocsPage() {
  return <DynamicScalar />;
}
