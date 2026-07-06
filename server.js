// LootLoop — Postback server
// ---------------------------------------------------------------
// This is the "back door" that CPX Research (or any offerwall network)
// calls automatically when a user genuinely finishes a survey/offer.
// It is NOT something the user's browser calls — it's server-to-server,
// which is exactly why it can be trusted (a user can't fake this call
// the way they could fake a button click in the app).
//
// CPX Research will call a URL that looks like this:
//   https://your-server.com/postback/cpx?user_id=123&status=1&trans_id=abc&amount_local=50&hash=xxxxx
//
// We verify the request really came from CPX (using the secret hash),
// then credit the user's real coin balance in YOUR database.
// ---------------------------------------------------------------

const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// TODO: put your real CPX "Secure Hash" (found in CPX dashboard ->
// Postback settings) into an environment variable, never hardcode it.
const CPX_SECURE_HASH = process.env.CPX_SECURE_HASH || "REPLACE_WITH_YOUR_CPX_SECURE_HASH";

// TODO: replace this in-memory store with your real database
// (Postgres, MongoDB, etc). This is only here so the endpoint runs.
const userBalances = {}; // { userId: coins }

function creditUser(userId, coins) {
  userBalances[userId] = (userBalances[userId] || 0) + coins;
  console.log(`Credited user ${userId} with ${coins} coins. New balance: ${userBalances[userId]}`);
  // TODO: also write a row to a "transactions" table for auditing/fraud review.
}

// ---------------------------------------------------------------
// CPX Research postback endpoint
// ---------------------------------------------------------------
app.get("/postback/cpx", (req, res) => {
  const { user_id, status, trans_id, amount_local, hash } = req.query;

  if (!user_id || !status || !trans_id || !amount_local || !hash) {
    return res.status(400).send("Missing required parameters");
  }

  // 1. Verify the request is really from CPX Research.
  // CPX's exact hash formula is in your dashboard's Postback settings page
  // (it's usually md5(trans_id + "-" + CPX_SECURE_HASH) — confirm the exact
  // recipe there before going live, networks vary slightly).
  const expectedHash = crypto
    .createHash("md5")
    .update(`${trans_id}-${CPX_SECURE_HASH}`)
    .digest("hex");

  if (hash !== expectedHash) {
    console.warn(`Postback rejected: bad hash for trans_id ${trans_id}`);
    return res.status(403).send("Invalid hash");
  }

  // 2. status = 1 means "completed", status = 2 means "reversed"
  //    (user got a refund/chargeback on the advertiser side — claw it back!)
  const coins = Math.round(parseFloat(amount_local) * 10); // example exchange rate: 1 point = 10 coins

  if (status === "1") {
    creditUser(user_id, coins);
  } else if (status === "2") {
    creditUser(user_id, -coins); // reverse the credit
  }

  // CPX Research expects a 200 response with the body below to consider
  // the postback successfully delivered.
  res.status(200).send("1");
});

// Simple health check so you can confirm the server is alive after deploying
app.get("/", (req, res) => {
  res.send("LootLoop postback server is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LootLoop postback server listening on port ${PORT}`);
});
