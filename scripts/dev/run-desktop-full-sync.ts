import { fullSync } from "@/lib/sync/turso-sync";

const result = await fullSync({ pruneAuthoritativeTables: true });

console.log(
  JSON.stringify(
    {
      result,
    },
    null,
    2,
  ),
);
