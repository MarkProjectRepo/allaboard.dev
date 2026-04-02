export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // In development, watch API route files and regenerate openapi.yaml on
    // every save.  The initial generation is handled by the `dev` npm script
    // (runs before `next dev`), so we only need the watcher here.
    //
    // fs.watch with { recursive: true } is supported on macOS and Windows.
    // On Linux dev boxes it will throw; in that case we skip watching silently
    // (the spec can still be refreshed manually with `npm run generate:openapi`).
    if (process.env.NODE_ENV === "development") {
      const { execSync } = await import("child_process");
      const path = await import("path");
      const { watch } = await import("fs");

      const generator = path.join(process.cwd(), "scripts", "generate-openapi.mjs");
      const apiDir    = path.join(process.cwd(), "src", "app", "api");

      try {
        watch(apiDir, { recursive: true }, (_event: string, filename: string | null) => {
          if (filename?.endsWith(".ts")) {
            try {
              execSync(`node ${generator}`, { stdio: "pipe" });
              console.log(`[openapi] Regenerated (${filename} changed)`);
            } catch {
              // Don't crash the dev server on a transient parse error
            }
          }
        });
      } catch {
        // fs.watch with recursive is not supported on this platform; skip watching.
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
