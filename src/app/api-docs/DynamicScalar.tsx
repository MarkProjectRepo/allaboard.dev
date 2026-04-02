"use client";

import dynamic from "next/dynamic";

// `ssr: false` is only permitted inside a Client Component.
// This wrapper lets page.tsx remain a Server Component (for metadata export)
// while still preventing Scalar from rendering on the server.
const ScalarClient = dynamic(() => import("./ScalarClient"), { ssr: false });

export default function DynamicScalar() {
  return <ScalarClient />;
}
