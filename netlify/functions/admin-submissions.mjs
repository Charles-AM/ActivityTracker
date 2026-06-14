import { createClient } from "@supabase/supabase-js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(200, {});
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const { SUPABASE_URL, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PIN } = process.env;

  if (!ADMIN_PIN || !SUPABASE_SERVICE_ROLE_KEY || !(SUPABASE_URL || VITE_SUPABASE_URL)) {
    return json(500, { error: "Admin function environment variables are missing." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body ?? "{}");
  } catch {
    return json(400, { error: "Invalid JSON payload." });
  }

  const { pin, action, submissionId } = payload;

  if (pin !== ADMIN_PIN) {
    return json(401, { error: "Invalid host PIN." });
  }

  if (!["approve", "reject", "delete", "clear-all"].includes(action)) {
    return json(400, { error: "Provide a valid action." });
  }

  const supabase = createClient(SUPABASE_URL || VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (action === "clear-all") {
    const { error, count } = await supabase
      .from("submissions")
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      return json(500, { error: error.message });
    }

    return json(200, { message: `Cleared ${count ?? 0} submissions.` });
  }

  if (!submissionId) {
    return json(400, { error: "Provide a submissionId for this action." });
  }

  if (action === "delete") {
    const { error } = await supabase.from("submissions").delete().eq("id", submissionId);

    if (error) {
      return json(500, { error: error.message });
    }

    return json(200, { message: "Submission deleted." });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const { error } = await supabase.from("submissions").update({ status }).eq("id", submissionId);

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, { message: `Submission ${status}.` });
};
