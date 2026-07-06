# LootLoop Postback Server

This tiny server receives confirmation from CPX Research when a user
really completes an offer, and credits their coin balance. It's the
missing piece between your app (frontend) and getting paid for real.

## What you need to do (step by step)

### 1. Create a free GitHub account (if you don't have one)
https://github.com/signup

### 2. Upload these 3 files to a new GitHub repository
Create a new repo called `lootloop-postback` and upload:
- `server.js`
- `package.json`
- `README.md`

### 3. Deploy it for free on Render
1. Go to https://render.com and sign up (you can sign in with GitHub)
2. Click "New +" → "Web Service"
3. Connect your `lootloop-postback` GitHub repo
4. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
5. Click "Create Web Service"

Render will give you a public URL that looks like:
`https://lootloop-postback.onrender.com`

### 4. Add your real CPX secret hash
In Render, go to your service → "Environment" → add a variable:
- Key: `CPX_SECURE_HASH`
- Value: (copy this from CPX Research dashboard → your app → Postback settings — it's called "Secure Hash" there)

### 5. Give CPX Research your postback URL
Back in the CPX Research dashboard, under "إعدادات إعادة الإرسال" (Postback settings),
paste in:

```
https://lootloop-postback.onrender.com/postback/cpx?user_id={user_id}&status={status}&trans_id={trans_id}&amount_local={amount_local}&hash={hash}
```

(CPX will show you the exact placeholder names to use — match them to what's
in `server.js`. If their names differ, tell me what you see and I'll update
the code to match.)

### 6. Test it
CPX Research usually has a "test postback" button in their dashboard once
everything is set up. Use it, then check your Render logs (Render dashboard
→ your service → "Logs") to confirm you see a line like:
`Credited user ... with ... coins.`

## Important notes
- The in-memory `userBalances` object in `server.js` is temporary — it
  resets every time the server restarts. Before going live, this needs to
  be replaced with a real database (e.g. Supabase, which is free to start
  and easy to connect from Node.js). Tell me when you're ready for this
  step and I'll wire it up.
- Never share your `CPX_SECURE_HASH` publicly or commit it into GitHub —
  always set it as an environment variable like shown above.
