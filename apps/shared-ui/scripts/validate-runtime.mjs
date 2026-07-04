import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const sourceIndexFile = path.join(packageDir, "src", "index.ts").replace(/\\/g, "\\\\");
const tempDir = await mkdtemp(path.join(packageDir, ".shared-ui-smoke-"));
const entryFile = path.join(tempDir, "smoke-entry.tsx");
const bundleFile = path.join(tempDir, "smoke-bundle.cjs");

const source = `
  import React from "react";
  import { renderToStaticMarkup } from "react-dom/server";
  import {
    AppShell,
    Badge,
    Button,
    Card,
    CardDescription,
    CardTitle,
    Input,
    PageHero,
    PanelHeader,
    Select,
    SettingsField,
    StatCard,
    StatRow,
    Textarea,
  } from "${sourceIndexFile}";

  const samples = [
    <Button key="button">Save</Button>,
    <Badge key="badge" variant="active">active</Badge>,
    <Input key="input" value="http://localhost:4000" readOnly />,
    <Textarea key="textarea" value="Slack" readOnly />,
    <Select key="select" defaultValue="1">
      <option value="1">Last 24 hours</option>
    </Select>,
    <SettingsField key="field" label="Backend API URL">
      <Input value="https://api.example.com" readOnly />
    </SettingsField>,
    <PanelHeader key="panel" title="Devices" caption="Runtime smoke test" />,
    <StatCard key="stat-card" label="Active devices" value={12} />,
    <StatRow key="stat-row" label="Device" value="Windows Device" />,
    <Card key="card">
      <CardTitle>Shared UI</CardTitle>
      <CardDescription>Atomic components render without runtime crashes.</CardDescription>
    </Card>,
    <PageHero
      key="hero"
      eyebrow="Microfrontend"
      title="Shared UI runtime check"
      description="This smoke test renders representative components from the shared package."
    />,
    <AppShell key="shell" contentClassName="max-w-4xl">
      <div>Shared shell</div>
    </AppShell>,
  ];

  for (const sample of samples) {
    const html = renderToStaticMarkup(sample);
    if (!html || html.length === 0) {
      throw new Error("Rendered markup was empty during shared UI validation.");
    }
  }

  console.log("Shared UI runtime validation passed.");
`;

await writeFile(entryFile, source, "utf8");

try {
  await build({
    entryPoints: [entryFile],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: bundleFile,
    jsx: "automatic",
    absWorkingDir: packageDir,
  });

  await import(pathToFileURL(bundleFile).href);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
