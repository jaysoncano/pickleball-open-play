import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental cache: pages read the database on every request.
export default defineCloudflareConfig({});
