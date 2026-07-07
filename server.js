// LootLoop — Postback server
// ---------------------------------------------------------------
// This is the "back door" that CPX Research (or any offerwall network)
// calls automatically when a user genuinely finishes a survey/offer.
// It is NOT something the user's browser calls — it's server-to-server,
// which is exactly why it can be trusted (a user can't fake this call
// the way they could fake a button click in the app).
//
// This version stores real balances in Supabase (Postgres) instead of
// an in-memory object, so balances survive server restarts and can be
// read back by the LootLoop frontend app.
// ---------------------------------------------------------------

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(cors()); // allow the LootLoop frontend (a different origin) to call /balance

// ---- secrets, set these in Render -> Environment, never hardcode them ----
const CPX_SECURE_HASH = process.env.CPX_SECURE_HASH || "REPLACE_WITH_YOUR_CPX_SECURE_HASH";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn("WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY is not set. Balances will fail to save.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------
// Credit (or deduct, for reversals) a user's real balance in Supabase.
// ---------------------------------------------------------------
async function creditUser(userId, coins) {
  const { data: existing, error: readError } = await supabase
    .from("users")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    console.error("Supabase read error:", readError.message);
    throw readError;
  }

  const newBalance = Math.max(0, (existing?.balance || 0) + coins);

  const { error: writeError } = await supabase
    .from("users")
    .upsert({ user_id: userId, balance: newBalance, updated_at: new Date().toISOString() });

  if (writeError) {
    console.error("Supabase write error:", writeError.message);
    throw writeError;
  }

  console.log(`Credited user ${userId} with ${coins} coins. New balance: ${newBalance}`);
  return newBalance;
}

// ---------------------------------------------------------------
// CPX Research postback endpoint
// ---------------------------------------------------------------
app.get("/postback/cpx", async (req, res) => {
  const { user_id, status, trans_id, amount_local, hash } = req.query;

  if (!user_id || !status || !trans_id || !amount_local || !hash) {
    return res.status(400).send("Missing required parameters");
  }

  // Verify the request is really from CPX Research (matches the formula
  // shown in your CPX dashboard's Postback settings page).
  const expectedHash = crypto
    .createHash("md5")
    .update(`${trans_id}-${CPX_SECURE_HASH}`)
    .digest("hex");

  if (hash !== expectedHash) {
    console.warn(`Postback rejected: bad hash for trans_id ${trans_id}`);
    return res.status(403).send("Invalid hash");
  }

  // status = 1 means "completed", status = 2 means "reversed" (chargeback)
  const coins = Math.round(parseFloat(amount_local) * 10); // example: 1 CPX point = 10 coins

  try {
    if (status === "1") {
      await creditUser(user_id, coins);
    } else if (status === "2") {
      await creditUser(user_id, -coins);
    }
    res.status(200).send("1"); // CPX expects this exact response to mark it delivered
  } catch (e) {
    res.status(500).send("0");
  }
});

// ---------------------------------------------------------------
// Balance lookup — the LootLoop frontend calls this to show real earnings
// ---------------------------------------------------------------
app.get("/balance/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    res.json({ userId, balance: data?.balance || 0 });
  } catch (e) {
    console.error("Balance lookup failed:", e.message);
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Simple health check
app.get("/", (req, res) => {
  res.send("LootLoop postback server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LootLoop postback server listening on port ${PORT}`);
});
