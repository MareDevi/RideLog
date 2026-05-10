import { createDecipheriv, createHash } from "node:crypto"
import { gunzipSync } from "node:zlib"

const KEEP_GEO_KEY = Buffer.from("NTZmZTU5OzgyZzpkODczYw==", "base64")
const KEEP_GEO_IV = Buffer.from("MjM0Njg5MjQzMjkyMDMwMA==", "base64")

export function sha256(input: string | Buffer) {
  return `sha256:${createHash("sha256").update(input).digest("hex")}`
}

export function decodeKeepPayload<T>(text: string, encrypted: boolean): T {
  let bytes = Buffer.from(text, "base64")

  if (encrypted) {
    const decipher = createDecipheriv("aes-128-cbc", KEEP_GEO_KEY, KEEP_GEO_IV)
    decipher.setAutoPadding(false)
    bytes = Buffer.concat([decipher.update(bytes), decipher.final()])
    const padding = bytes.at(-1) ?? 0
    if (padding > 0 && padding <= 16) {
      bytes = bytes.subarray(0, -padding)
    }
  }

  return JSON.parse(gunzipSync(bytes).toString("utf8")) as T
}
