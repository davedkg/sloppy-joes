// Reads the app's Markdown (features/ + config/) at request time so live edits
// are reflected on the next visit. Honors the file-or-folder convention from
// STRUCTURE.md: a feature is `features/<name>.md` OR a `features/<name>/` folder.

import { promises as fs } from "node:fs";
import path from "node:path";

export interface MarkdownFile {
  readonly relPath: string;
  readonly content: string;
}

export interface FeatureSource {
  readonly name: string;
  readonly files: readonly MarkdownFile[];
  readonly combined: string;
}

const appDir = (): string => process.env.SLOPPY_APP_DIR ?? process.cwd();
const featuresDir = (): string => path.join(appDir(), "features");
const configDir = (): string => path.join(appDir(), "config");

const isMarkdown = (name: string): boolean =>
  name.toLowerCase().endsWith(".md");

// Guards against path traversal and keeps names to our naming convention.
const isValidName = (name: string): boolean =>
  /^[a-z0-9][a-z0-9_-]*$/i.test(name);

const statOrNull = async (
  target: string,
): Promise<import("node:fs").Stats | null> => {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
};

// Recursively collect every .md file under `dir`, with paths relative to `base`.
const collectMarkdown = async (
  dir: string,
  base: string,
): Promise<MarkdownFile[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<MarkdownFile[]> => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectMarkdown(full, base);
      if (entry.isFile() && isMarkdown(entry.name)) {
        const content = await fs.readFile(full, "utf8");
        return [{ relPath: path.relative(base, full), content }];
      }
      return [];
    }),
  );
  return nested.flat().sort((a, b) => a.relPath.localeCompare(b.relPath));
};

const combine = (files: readonly MarkdownFile[]): string =>
  files.map((file) => `<!-- ${file.relPath} -->\n${file.content}`).join("\n\n");

export const listFeatures = async (): Promise<string[]> => {
  const dir = featuresDir();
  if (!(await statOrNull(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const names = entries.flatMap((entry) => {
    if (entry.isDirectory()) return [entry.name];
    if (entry.isFile() && isMarkdown(entry.name))
      return [entry.name.slice(0, -3)];
    return [];
  });
  return Array.from(new Set(names)).sort();
};

export const readFeature = async (
  name: string,
): Promise<FeatureSource | null> => {
  if (!isValidName(name)) return null;

  const filePath = path.join(featuresDir(), `${name}.md`);
  const fileStat = await statOrNull(filePath);
  if (fileStat?.isFile()) {
    const content = await fs.readFile(filePath, "utf8");
    const files: MarkdownFile[] = [{ relPath: `${name}.md`, content }];
    return { name, files, combined: combine(files) };
  }

  const dirPath = path.join(featuresDir(), name);
  const dirStat = await statOrNull(dirPath);
  if (dirStat?.isDirectory()) {
    const files = await collectMarkdown(dirPath, featuresDir());
    return { name, files, combined: combine(files) };
  }

  return null;
};

export const readConfig = async (name: string): Promise<string | null> => {
  if (!isValidName(name)) return null;
  const filePath = path.join(configDir(), `${name}.md`);
  const fileStat = await statOrNull(filePath);
  if (fileStat?.isFile()) return fs.readFile(filePath, "utf8");
  return null;
};
