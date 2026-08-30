import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist);
await Promise.all([".nojekyll", "favicon.svg", "index.html", "styles.css"].map((file) => cp(join(root, file), join(dist, file))));

const result = await build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: ["app.js"],
  format: "esm",
  legalComments: "none",
  metafile: true,
  minify: true,
  outfile: "dist/app.js",
});

const packageRoots = new Map([["esbuild", join(root, "node_modules", "esbuild")]]);
for (const input of Object.keys(result.metafile.inputs)) {
  const parts = input.split("/");
  const marker = parts.lastIndexOf("node_modules");
  if (marker < 0) continue;
  const end = parts[marker + 1].startsWith("@") ? marker + 3 : marker + 2;
  packageRoots.set(parts.slice(marker + 1, end).join("/"), resolve(root, ...parts.slice(0, end)));
}

const notices = ["Third-party software bundled with Mattershot", ""];
for (const [name, packageRoot] of [...packageRoots].sort(([left], [right]) => left.localeCompare(right))) {
  const metadata = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
  const licenceFile = (await readdir(packageRoot)).find((file) => /^(licen[cs]e|copying)(\..*)?$/i.test(file));
  if (!licenceFile) throw new Error(`No licence file found for ${name}`);
  notices.push(`${metadata.name} ${metadata.version} (${metadata.license})`, "-".repeat(72), await readFile(join(packageRoot, licenceFile), "utf8"), "");
}
await writeFile(join(dist, "THIRD_PARTY_NOTICES.txt"), notices.join("\n"));
