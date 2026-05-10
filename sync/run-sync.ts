import { runKeepImport } from "./adapters/keep"
import { generatePublicData } from "./data-generate"
import { runStravaSync } from "./strava-sync"

const dryRun = process.argv.includes("--dry-run")

await runKeepImport({
  dryRun,
  since: process.env.RIDELOG_SYNC_SINCE,
})
await runStravaSync(dryRun)
await generatePublicData()
