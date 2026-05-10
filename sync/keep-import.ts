import { runKeepImport } from "./adapters/keep"

if (import.meta.main) {
  await runKeepImport({
    dryRun: process.argv.includes("--dry-run"),
    since: process.env.RIDELOG_SYNC_SINCE,
  })
}
