import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const input = JSON.parse(readFileSync(0, "utf8"));
const client = createClient(input.url, input.publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${input.accessToken}` } },
});
await client.realtime.setAuth(input.accessToken);
let channel;
try {
  const row = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Recovered Realtime did not deliver the work order")), 45000);
    channel = client.channel(`recovery-${crypto.randomUUID()}`, {
      config: { postgres_changes_options: { wait: true, timeout: 30000 } },
    })
      .on("system", {}, (event) => {
        if (event.status === "error") {
          clearTimeout(timeout);
          reject(new Error(`Recovered Postgres subscription failed: ${event.message}`));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "work_orders" }, (event) => {
        clearTimeout(timeout);
        resolve(event.new);
      })
      .subscribe(async (status, error) => {
        if (status === "SUBSCRIBED") {
          const { error } = await client.rpc("create_work_order", input.workOrder);
          if (error) { clearTimeout(timeout); reject(error); }
        }
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
          clearTimeout(timeout);
          reject(new Error(`Recovered Realtime subscription failed: ${status}: ${error?.message ?? "unknown"}`));
        }
      });
  });
  process.stdout.write(JSON.stringify({ realtime: "passed", created_order_id: row.id, reference: row.reference }));
} finally {
  if (channel) await client.removeChannel(channel);
  client.realtime.disconnect();
}
