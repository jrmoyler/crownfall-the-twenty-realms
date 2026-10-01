// Downloads the realm's source assets and bakes phone-sized versions into public/realm.
//   node tools/assets/build.mjs            build everything missing
//   node tools/assets/build.mjs --force    rebuild everything
// Sources are cached in tools/assets/.cache (git-ignored).
import { mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, simplify, textureCompress, metalRough, quantize, meshopt, resample, unpartition } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { CHARACTERS, WEAPONS, PROPS, REALMS } from "./sources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const cache = join(here, ".cache");
const out = join(root, "public/realm");
const force = process.argv.includes("--force");
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const exists = (path) => access(path).then(() => true, () => false);

async function fetchTo(url, path) {
  if (await exists(path)) return path;
  await mkdir(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      await writeFile(path, Buffer.from(await response.arrayBuffer()));
      return path;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
  }
  throw new Error(`Could not download ${url}`);
}

async function polyhavenFiles(id) {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!response.ok) throw new Error(`Poly Haven has no ${id}`);
  return response.json();
}

async function sourceDocument(source) {
  if (source.kind === "objaverse") {
    const file = await fetchTo(`https://huggingface.co/datasets/allenai/objaverse/resolve/main/${source.path}`, join(cache, "objaverse", `${source.uid}.glb`));
    return io.read(file);
  }
  const files = await polyhavenFiles(source.id);
  const gltf = files.gltf["1k"].gltf;
  const dir = join(cache, "polyhaven", source.id);
  const main = await fetchTo(gltf.url, join(dir, `${source.id}.gltf`));
  await Promise.all(Object.entries(gltf.include).map(([rel, file]) => fetchTo(file.url, join(dir, rel))));
  return io.read(main);
}

function triangleCount(document) {
  let tris = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      tris += indices ? indices.getCount() / 3 : (prim.getAttribute("POSITION")?.getCount() ?? 0) / 3;
    }
  }
  return tris;
}

async function bake(document, { tris, tex, keepSkin, drop }, target) {
  const rootNode = document.getRoot();
  if (drop) {
    const pattern = new RegExp(drop);
    rootNode.listNodes().filter((node) => node.getMesh() && pattern.test(node.getName())).forEach((node) => node.dispose());
  }
  rootNode.listAnimations().forEach((animation) => {
    animation.listSamplers().forEach((sampler) => {
      sampler.getInput()?.dispose();
      sampler.getOutput()?.dispose();
      sampler.dispose();
    });
    animation.listChannels().forEach((channel) => channel.dispose());
    animation.dispose();
  });
  rootNode.listCameras().forEach((camera) => camera.dispose());
  if (!keepSkin) rootNode.listSkins().forEach((skin) => skin.dispose());
  // Morph targets and layered lobes cost phones more than they show from a battle camera.
  rootNode.listMeshes().forEach((mesh) => {
    mesh.setWeights([]);
    mesh.listPrimitives().forEach((prim) => prim.listTargets().forEach((target) => target.dispose()));
  });
  rootNode.listExtensionsUsed()
    .filter((ext) => /clearcoat|sheen|transmission|volume|iridescence|anisotropy/.test(ext.extensionName))
    .forEach((ext) => ext.dispose());
  await document.transform(metalRough(), unpartition(), dedup(), prune(), resample(), weld());
  const before = triangleCount(document);
  if (before > tris) {
    await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: tris / before, error: keepSkin ? 0.03 : 0.1, lockBorder: false }));
  }
  await document.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [tex, tex], quality: 82 }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await mkdir(dirname(target), { recursive: true });
  await io.write(target, document);
  console.log(`${target.replace(root + "/", "")}: ${Math.round(before)} -> ${Math.round(triangleCount(document))} tris`);
}

async function job(name, target, run) {
  if (only && !name.includes(only)) return;
  if (!force && (await exists(target))) return;
  try {
    await run();
  } catch (error) {
    console.error(`FAILED ${name}:`, error.message);
    process.exitCode = 1;
  }
}

async function texture(id, size) {
  const files = await polyhavenFiles(id);
  const dir = join(out, "ground");
  const maps = { diff: files.Diffuse, nor: files.nor_gl, arm: files.arm };
  for (const [key, entry] of Object.entries(maps)) {
    const file = await fetchTo(entry["1k"].jpg.url, join(cache, "textures", `${id}_${key}.jpg`));
    await mkdir(dir, { recursive: true });
    await sharp(file).resize(size, size).webp({ quality: key === "nor" ? 90 : 80 }).toFile(join(dir, `${id}_${key}.webp`));
  }
  console.log(`ground ${id}`);
}

const jobs = [];
for (const [key, source] of Object.entries(CHARACTERS)) {
  const target = join(out, "characters", `${key}.glb`);
  jobs.push(job(key, target, async () => bake(await sourceDocument(source), { ...source, keepSkin: true }, target)));
}
for (const [key, source] of Object.entries(WEAPONS)) {
  const target = join(out, "weapons", `${key}.glb`);
  jobs.push(job(`weapon_${key}`, target, async () => bake(await sourceDocument(source), source, target)));
}
for (const [id, tris] of Object.entries(PROPS)) {
  const target = join(out, "props", `${id}.glb`);
  jobs.push(job(id, target, async () => bake(await sourceDocument({ kind: "polyhaven", id }), { tris, tex: 512 }, target)));
}
for (const realm of Object.values(REALMS)) {
  for (const id of [realm.ground, realm.blend]) {
    jobs.push(job(id, join(out, "ground", `${id}_diff.webp`), () => texture(id, 1024)));
  }
  const target = join(out, "sky", `${realm.hdri}.hdr`);
  jobs.push(job(realm.hdri, target, async () => {
    const files = await polyhavenFiles(realm.hdri);
    await fetchTo(files.hdri["1k"].hdr.url, target);
    console.log(`sky ${realm.hdri}`);
  }));
}
await Promise.all(jobs);

// Attribution, regenerated every run.
const lines = [
  "# Credits",
  "",
  "Crownfall ships third-party art under open licences. Thank you to these artists.",
  "",
  "## Characters and weapons (CC BY 4.0 unless noted)",
  "",
  ...[...Object.values(CHARACTERS), ...Object.values(WEAPONS)].map((s) =>
    s.kind === "objaverse"
      ? `- "${s.title}" by ${s.author}, https://sketchfab.com/3d-models/${s.uid}, ${s.license}. Simplified and re-textured to WebP${s.tex === 1024 || s.tris >= 8000 ? "; posed at runtime" : ""}.`
      : `- "${s.title}" by ${s.author}, https://polyhaven.com/a/${s.id}, ${s.license}.`),
  "",
  "## Environments (CC0, Poly Haven)",
  "",
  `- Models: ${Object.keys(PROPS).join(", ")}.`,
  `- Ground textures: ${[...new Set(Object.values(REALMS).flatMap((r) => [r.ground, r.blend]))].join(", ")}.`,
  `- Skies: ${Object.values(REALMS).map((r) => r.hdri).join(", ")}.`,
  "- https://polyhaven.com",
  "",
];
await writeFile(join(root, "CREDITS.md"), lines.join("\n"));
if (force) await rm(join(cache, "tmp"), { recursive: true, force: true });
