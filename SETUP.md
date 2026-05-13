# Fruit Loop PVD — Setup Guide

## What's in this folder

```
fruitloop/
├── index.html        ← The whole website (all pages in one file)
├── css/
│   └── style.css     ← All the styling
├── js/
│   ├── data.js       ← Google Sheets connection + sample data
│   └── app.js        ← All the interactive logic
└── SETUP.md          ← You're reading this
```

---

## Step 1: Update your personal info

Open `index.html` and search for these placeholders and replace them:

| Placeholder | Replace with |
|---|---|
| `MERCH_URL_HERE` | Your merch store URL (appears twice) |
| `INSTAGRAM_URL` | Your Instagram profile URL (appears twice) |
| `TIKTOK_URL` | Your TikTok profile URL (appears twice) |
| `FACEBOOK_URL` | Your Facebook page URL (appears twice) |

Also update the About page text — search for "What is Fruit Loop PVD?" and rewrite
the paragraphs in your own voice.

---

## Step 2: Set up your Google Sheet

1. Go to Google Sheets and create a new spreadsheet
2. Create these 5 tabs (exact names matter):
   - `Events`
   - `Performers`
   - `DJs`
   - `Bartenders`
   - `Venues`

### Events tab columns (Row 1 = these headers exactly):
```
Date | Day | Time | AMPM | EventName | Venue | Location | Vibe | Type | Age | Cover | TicketURL | FlierURL | Performers | DJs | Bartenders | Tags | Cancelled | RecurType | RecurDay | RecurWeek | RecurStart | RecurEnd
```

**FlierURL** — paste a direct image URL (from Google Drive, Instagram, Imgur, etc.). Leave blank if no flyer yet.

**Tags** — comma-separated, anything you like, e.g. `drag,dance,21`. The site reads all tags from your sheet and builds the filter chips automatically — add a new tag and it shows up as a new chip with no code changes needed. Suggested starters: `drag`, `dance`, `brunch`, `bingo`, `21`, `allages`

---

#### One-off event example:
```
Date: 2026-04-04
Time: 9:00  |  AMPM: PM
EventName: Glitter Bomb  |  Venue: Fête  |  Location: Providence
Vibe: Dance night  |  Type: DJ set  |  Age: 21+  |  Cover: $10 cover
TicketURL: https://...
Performers: Lux Vandal  |  DJs: DJ Velveeta  |  Bartenders: Marcy Malone
Tags: dance,21
(leave all Recur* columns blank)
```

---

#### Recurring event examples:

**Every Friday:**
```
RecurType: weekly  |  RecurDay: Friday  |  RecurStart: 2026-04-01
(leave Date blank)
```

**Every other Wednesday (biweekly):**
```
RecurType: biweekly  |  RecurDay: Wednesday
RecurWeek: 2026-04-01  ← date of the very first occurrence
RecurStart: 2026-04-01
```

**3rd Sunday of every month:**
```
RecurType: monthly  |  RecurDay: Sunday  |  RecurWeek: 3
RecurStart: 2026-01-01
```

**Last Friday of every month:**
```
RecurType: monthly  |  RecurDay: Friday  |  RecurWeek: last
RecurStart: 2026-01-01
```

**2nd and 4th Wednesday:**
```
RecurType: twicemonthly  |  RecurDay: Wednesday  |  RecurWeek: 2,4
RecurStart: 2026-01-01
```

---

#### Overriding a specific recurring occurrence:

One-off rows that match a recurring event by name only need **Date + EventName + whatever is different**.
Everything you leave blank is automatically inherited from the recurring template.

To **add this week's performers** (everything else stays the same):
```
Date: 2026-04-11  |  EventName: Drag Disaster
Performers: Rhonda Rotten, Crystal Void
(venue, time, cover, tags — all inherited from the recurring row)
```

To **cancel** one instance:
```
Date: 2026-04-23  |  EventName: Queer Bingo  |  Cancelled: TRUE
(everything else can be blank)
```

To **change the venue** for one night only:
```
Date: 2026-04-18  |  EventName: Last Friday  |  Venue: AS220
(only venue changes — time, cover, DJs etc. all inherited)
```

To **add a ticket link** for a special night:
```
Date: 2026-04-25  |  EventName: Queer Bingo  |  TicketURL: https://...  |  Cover: $5 suggested
```

### Performers tab columns:
```
ID | Name | Role | Initials | AvatarColor | Bio | Events
```

- `ID`: a short slug with no spaces, e.g. `rhonda-rotten`
- `AvatarColor`: one of `pink`, `gold`, `purple`, `blue`, `teal`
- `Events`: comma-separated event row numbers (1, 2, 3...)

### DJs tab columns:
```
ID | Name | Genre | Initials | AvatarColor | Residency | Bio | Events
```
- `Residency`: one of `local`, `visitor`, `guest`

### Bartenders tab columns:
```
ID | Name | Initials | AvatarColor | Bio | Venues | Events
```
- `Venues`: comma-separated venue names, e.g. `Fête,The Stable`

### Venues tab columns:
```
Name | Types | Neighborhood | HoodLabel | BannerStyle | EventCount | Address | Website
```
- `Types`: comma-separated from: `queer`, `safe`, `arts`, `restaurant`
- `Neighborhood`: one of `downtown`, `eastside`, `westend`, `eastprov`, `greater`
- `HoodLabel`: the display label, e.g. `Downtown PVD`, `East Side`
- `BannerStyle`: one of `vb-queer`, `vb-safe`, `vb-arts`, `vb-restaurant`
- `EventCount`: just a number

---

## Step 3: Publish your Google Sheet

1. In your Google Sheet, go to **File → Share → Publish to web**
2. Choose **Entire Document** and **CSV** format
3. Click **Publish** and confirm
4. Close that dialog

---

## Step 4: Connect the sheet to your site

1. Copy your Sheet ID from the URL bar:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART_HERE`**`/edit`

2. Open `js/data.js` and find this line near the top:
   ```
   const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
   ```

3. Replace `YOUR_GOOGLE_SHEET_ID_HERE` with your actual Sheet ID

That's it — the site will now read from your sheet every time someone loads it.

---

## Step 5: Test locally (optional)

If you want to preview the site before deploying, you can't just double-click
`index.html` (Google Sheets fetching won't work from a local file). Instead:

**Option A — VS Code (recommended):**
Install the "Live Server" extension, right-click `index.html`, choose "Open with Live Server"

**Option B — Python (if installed):**
Open Terminal in the fruitloop folder and run:
```
python3 -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

---

## Step 6: Deploy to Netlify

1. Go to **netlify.com** and sign up for a free account (use GitHub or email)
2. From your dashboard, click **"Add new site" → "Deploy manually"**
3. Drag your entire `fruitloop` folder onto the upload area
4. Netlify gives you a URL like `random-name-12345.netlify.app` — that's your live site!

**To update the site later:** just drag the folder again. Netlify replaces it automatically.

---

## Step 7: Connect your custom domain

1. In Netlify, go to your site → **Domain settings → Add custom domain**
2. Type your domain name and click **Verify**
3. Netlify will show you nameserver addresses
4. Log into wherever you bought your domain (GoDaddy, Namecheap, Google Domains, etc.)
5. Find the nameserver/DNS settings and replace them with Netlify's
6. Wait up to 24 hours for DNS to propagate (usually much faster)

If you need help with this step, just let me know what registrar you use
and I can walk you through the exact steps.

---

## How to add events going forward

Just add a new row to your `Events` tab in Google Sheet. The website
reads the sheet fresh every time someone loads it, so your changes
go live immediately — no re-deploying needed.

If a performer, DJ, venue, or bartender is brand new, add them to their
respective tab first, then reference their name in the event row.

---

## Setting up the event submission form

Right now the submit form just logs to the console. To make it actually
send you emails when someone submits an event, the easiest free option is:

1. Sign up at **formspree.io** (free tier handles 50 submissions/month)
2. Create a new form and get your form endpoint URL
3. Open `js/app.js`, find the `setupSubmitForm` function
4. Replace the `console.log` section with:
   ```javascript
   await fetch('https://formspree.io/f/YOUR_FORM_ID', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(data),
   });
   ```

Alternatively, if you deploy on Netlify, you can use **Netlify Forms** for free
(up to 100 submissions/month) — ask me to set that up and I'll update the code.

---

## Questions?

Everything in this site was designed to be updated through Google Sheets —
you should never need to touch the HTML or CSS files once it's set up.

If something breaks or you want to add a feature, come back and we'll fix it.
