# Sentry Fence CRM Pro — Deployment Guide

**Total time: ~25 minutes** · **Cost: $0/month** for your team's volume.

You'll set up two free services:
- **Firebase** — the database that syncs data between everyone's devices in real time
- **Vercel** — hosts the website and runs the password-check function

When you're done, your team will have a real URL like `sentry-crm.vercel.app` they can bookmark on any phone or laptop, and any change anyone makes will appear instantly for everyone else.

---

## PART 1 — Firebase Setup (10 min)

Firebase is Google's free database service. Free tier easily covers a small fence company forever.

### 1.1 Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Click **Add project** (or use your existing project if you already have one for the original CRM).
3. Name it `sentry-fence-crm` (or anything you like). Click **Continue**.
4. Disable Google Analytics (you don't need it). Click **Create project**.
5. Wait ~30 seconds for setup, then click **Continue**.

### 1.2 Enable Firestore Database

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (we'll add proper security rules in a moment). Click **Next**.
4. Pick a location — choose **us-east1 (South Carolina)** for fastest response from Massachusetts. Click **Enable**.

### 1.3 Enable Authentication

1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started**.
3. Click the **Sign-in method** tab. You don't need to enable any providers — custom tokens work without one. Just leave the page.

### 1.4 Get your Firebase Web Config

1. Click the **gear icon ⚙️** in the top left, then **Project settings**.
2. Scroll down to **Your apps**. Click the `</>` web icon to register a web app.
3. App nickname: `Sentry CRM Pro`. Don't check "Firebase Hosting." Click **Register app**.
4. You'll see a code block with `firebaseConfig = { ... }`. **Copy the whole config object.**
5. **Open** `deploy/public/index.html`, find the section labeled `FIREBASE PROJECT CONFIG`, and **paste your values** in place of the `REPLACE_WITH_*` placeholders. Save.

### 1.5 Get your Service Account key (for the login API)

1. Still in **Project settings**, click the **Service accounts** tab.
2. Click **Generate new private key** → confirm. A JSON file downloads. **Keep this file secure — it's the master key to your database.**
3. Open the JSON file in any text editor. You'll see fields like `project_id`, `client_email`, and `private_key`. You'll paste these into Vercel in Part 2.

### 1.6 Deploy the security rules

1. In Firebase Console, go to **Firestore Database → Rules** tab.
2. Open `deploy/firestore.rules` (in this folder), copy its entire contents.
3. Paste into the Firebase rules editor, replacing what's there.
4. Click **Publish**.

---

## PART 2 — Vercel Deployment (10 min)

Vercel is the hosting service. Free tier handles way more traffic than you'll ever need.

### 2.1 Create a Vercel account

1. Go to [vercel.com/signup](https://vercel.com/signup).
2. Sign up with GitHub, GitLab, or email. **GitHub is easiest** if you already have an account.

### 2.2 Install the Vercel CLI

Open Terminal (Mac) or PowerShell (Windows), then run:

```bash
npm install -g vercel
```

If you don't have Node.js installed, get it first from [nodejs.org](https://nodejs.org) (the LTS version).

### 2.3 Deploy

In Terminal, navigate to the deploy folder:

```bash
cd "/Users/jamesmarconi/Documents/Claude/Projects/Sentry CRM/deploy"
```

Then run:

```bash
vercel
```

Answer the prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → your username
- **Link to existing project?** → `N`
- **Project name?** → `sentry-crm` (or anything; lowercase, no spaces)
- **Code directory?** → press Enter (defaults to current)
- **Override settings?** → `N`

Vercel will deploy. After ~30 seconds you'll see a URL like `https://sentry-crm-abc123.vercel.app`. **The site is live but won't work yet** — it needs the env vars in the next step.

### 2.4 Add environment variables

1. Open the URL Vercel just gave you, and append `/dashboard` — or visit [vercel.com/dashboard](https://vercel.com/dashboard) and click your new project.
2. Click **Settings → Environment Variables**.
3. Add these five variables (one at a time). For each one, leave **all environments** checked (Production, Preview, Development):

| Name | Value |
|------|-------|
| `ADMIN_PASSWORD` | A strong password for admin sign-in (you choose) |
| `SALES_PASSWORD` | A strong password for the sales team (you choose) |
| `FIREBASE_PROJECT_ID` | The `project_id` from your service account JSON |
| `FIREBASE_CLIENT_EMAIL` | The `client_email` from your service account JSON |
| `FIREBASE_PRIVATE_KEY` | The `private_key` from your service account JSON — **paste the entire string including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`** |

> **Tip for the private key**: when you paste it from the JSON, keep all the `\n` escape characters as they are. Vercel handles them correctly.

### 2.5 Redeploy with the new env vars

Back in Terminal:

```bash
vercel --prod
```

Wait ~30 seconds. Now your site is fully live at `https://sentry-crm-xxx.vercel.app`.

---

## PART 3 — First sign-in & team rollout

1. Open the Vercel URL in your browser.
2. You'll see the login screen. Pick **Admin**, enter the password you set as `ADMIN_PASSWORD`, click **Sign In Securely**.
3. You're in. The first sign-in seeds the database with the demo data. Edit, delete, or replace it as needed.
4. **Share the URL with your sales team** along with the `SALES_PASSWORD`. Tell them to bookmark it on their phones — it works as a web app and behaves like a native app on iOS/Android.

### Verifying multi-device sync

1. Sign in as Admin on your laptop.
2. Sign in as Sales on your phone.
3. Add a job on one. Watch it appear on the other within a second or two.

### Where to see who's signing in

In the **User Management** tab (Admin only), you'll see every sign-in attempt with full device details: browser, OS, public IP, screen size, timezone, and more. This is now stored permanently in Firestore — not local-only — so the audit trail survives across devices and reloads.

---

## Operating the system

**Change a password**: Vercel → your project → Settings → Environment Variables → edit `ADMIN_PASSWORD` or `SALES_PASSWORD` → click Save → click the **Deployments** tab → on the latest deployment click the `...` menu → **Redeploy**. Takes 30 seconds. The old password stops working immediately for new sign-ins (existing sessions stay logged in until they sign out or 8 hours pass).

**Custom domain** (optional, ~$12/year): Vercel → your project → Settings → Domains → Add. Vercel will give you DNS records to point your domain at. Works with any domain registrar.

**Add a team member**: just give them the URL and the Sales password. There's no per-user setup. If you want individually-tracked logins, that's a future enhancement (would require email/password Firebase Auth).

**Backup your data**: in the Settings tab, use **Full Backup (JSON)** to download all your data as a file. Do this monthly to be safe — though Firebase is durable, having a local copy is good practice.

**View costs**: Firebase has a free quota of 50,000 reads + 20,000 writes per day. Vercel has 100GB bandwidth/month free. A 5-person team using this all day every day uses maybe 5% of either limit.

---

## Troubleshooting

**"Server not configured" error on login** → Env vars aren't set. Check Vercel → Settings → Environment Variables and make sure all 5 are present, then redeploy.

**"Firebase auth failed"** → The service account JSON values are wrong. Re-download from Firebase Console → Project Settings → Service accounts, and copy `project_id`, `client_email`, `private_key` exactly. The private key must be the full PEM string starting with `-----BEGIN`.

**Login works but data doesn't load** → Firestore rules weren't published, or `firebaseConfig` in `index.html` has the wrong project. Both must point to the same Firebase project.

**"Permission denied" in browser console** → Firestore rules. Re-publish from `deploy/firestore.rules`.

**Want to start over with fresh data** → Firebase Console → Firestore → Data tab → delete the `appState` collection. Reload the app — it'll re-seed.

---

## File structure

```
deploy/
├── api/
│   └── login.js              ← Vercel serverless function (verifies passwords, mints Firebase tokens)
├── public/
│   └── index.html            ← The CRM app — modify firebaseConfig here
├── package.json              ← Lists firebase-admin dependency
├── vercel.json               ← Vercel routing config
├── firestore.rules           ← Database security rules
├── .env.example              ← Template showing required env vars
├── .gitignore                ← Don't commit secrets
└── DEPLOY.md                 ← This file
```

---

Need help? Each step has been tested. If something fails, the error message in Terminal or your browser console usually pinpoints which env var or config field is wrong. Most issues come down to a typo in the Firebase config or a missing env var in Vercel.
