import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { z } from "zod"

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true })
}

export async function readJsonFile<T>(
  path: string,
  schema: z.ZodType<T>,
  fallback: T
): Promise<T> {
  try {
    const raw = await readFile(path, "utf8")
    return schema.parse(JSON.parse(raw))
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return fallback
    }
    throw error
  }
}

export async function writeJsonFile(path: string, data: unknown) {
  await ensureDir(dirname(path))
  const tmpPath = `${path}.tmp`
  await writeFile(tmpPath, `${stableStringify(data)}\n`, "utf8")
  await rename(tmpPath, path)
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2)
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys)
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortKeys(entry)])
    )
  }
  return value
}
