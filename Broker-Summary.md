# Broker Execution vs Market Dashboard — Features Overview

A simple guide to what this application does and how you can use it.

---

## What is this application?

This dashboard lets you compare how individual stock brokers are performing
against the overall market for a given trading day. It pulls execution data
(trades, values, buy/sell splits) for 15 tracked brokers and compares each
one — and the combined total — against market-wide figures, so you can
quickly see which brokers are gaining or losing market share.

All of the data is collected automatically in the background, so you don't
need to log into any external trading system yourself — you just open the
dashboard and the latest numbers are already there.

Separately, the app includes an **admin panel** for managing who can access
the dashboard and which broker(s) they can see.

---

## Who uses this app?

There are two types of accounts:

- **User (Analyst)** — Signs in, views the dashboard and trend charts, and
  can change their own password. If their account is tied to a specific
  broker, they'll only see that broker's data.
- **Admin** — Has access to everything a User has, plus a separate Admin
  Panel for managing brokers and user accounts.

---

## Signing In & Your Account

### Login

A simple sign-in screen asks for your **email** and **password**. If the
details don't match, you'll see a clear "Invalid email or password" message.
Once signed in, you're taken straight to the page appropriate for your role —
the **Dashboard** for regular users, or the **Admin Panel** for admins.

### First-time / forced password change

If your account was just created by an admin, you'll be required to set a
new password before you can do anything else. You'll see a notice explaining
this, and you won't be able to continue until it's done.

### Profile page

Available to everyone from the header (**Profile** link), this page lets you:

- See the email address you're signed in as
- Change your password (new password must be at least 8 characters and
  confirmed twice)
- Get clear success or error feedback after submitting

---

## The Dashboard

This is the main screen for analysts. It's organized as follows:

### Header

Shows your environment (e.g. UAT), the currently selected stock exchange,
the date range, your email address, and a badge indicating the automated
data pipeline's status. From here you can also reach your **Profile** or
**Sign out**.

### Filters

A small toolbar lets you set:

- **From Date**
- **To Date**
- **Stock Exchange** (e.g. "DSE")

…and a **Fetch Data** button to (re)load the comparison data.

> **Note (current version):** the dashboard always shows the most recently
> collected snapshot of data. Changing the date range or exchange and
> clicking Fetch Data will refresh the view, but it won't change *which*
> data is shown yet — historical/date-specific lookups are planned for a
> future version.

### Comparison Table

The heart of the dashboard — a table comparing every broker side-by-side:

| Column | What it means |
|---|---|
| Broker | The broker's name |
| Exec Reports | Number of execution reports |
| Total Trade | Total number of trades |
| Buy Trade / Sell Trade | Split of trades into buys vs sells |
| Total Value | Total traded value |
| Buy Value / Sell Value | Split of value into buys vs sells |
| Trade Share % | This broker's share of the market's total trades |
| Value Share % | This broker's share of the market's total value |

**Visual cues to look out for:**

- 🟢 **Green badge** — the broker's market share meets or exceeds the
  configured threshold (a strong showing)
- 🟡 **Amber badge** — the broker's market share is below the threshold
- ⚪ **Gray "N/A"** — market data wasn't available, so share % can't be
  calculated
- 🔴 **Red row** — this broker's data couldn't be fetched; figures show as
  dashes until the next successful update

At the bottom of the table:

- **Σ Aggregate row** (highlighted) — the sum of all brokers' figures
  combined
- **Market row** (gray) — the overall market totals, always shown as 100%
  since it's the benchmark everything else is measured against

### Trend Charts

Below the table, two line charts show how things have moved over time:

- **Trade Count Trend** — compares your broker's trade count, the combined
  total across all tracked brokers, and the overall market trade count
- **Value Trend** — same comparison, but for traded value instead of trade
  count

Both charts let you:

- Hover over any point to see exact numbers and percentages (e.g. "this
  broker = X% of the market, Y% of the combined total")
- Click legend items to show/hide individual lines
- See a dashed reference line marking the market's total, for easy
  comparison

### Status Banners

If something isn't quite right, you'll see a banner explaining it:

- An **amber warning** if market-wide data isn't currently available (share
  % columns will show "N/A")
- A **red error** with a **Retry** button if broker data couldn't be loaded
  at all

---

## Automated Data Collection (Behind the Scenes)

You don't need to do anything to get fresh data — the system handles it
automatically:

- Once a day (and once when the system starts up), it automatically signs
  into the external broker trading platform using a dedicated service
  account and pulls the latest figures for all 15 tracked brokers, plus the
  overall market.
- If something fails partway through (e.g. a login session expiring), the
  system automatically retries once before giving up.
- The results are saved, so the dashboard always shows the most recent
  successful data — even if the live system is temporarily unreachable when
  you open the page.
- Every run is logged, so there's a record of whether the last data refresh
  succeeded, partially succeeded, or failed.

In short: **the data you see is "as of the last successful automatic
update,"** not a live, on-demand query.

---

## Role-Based Data Access

Not everyone sees the same thing:

- If your account is **assigned to a specific broker**, the dashboard table
  will only show that broker's row (plus the aggregate/market rows where
  relevant).
- If you're an **admin**, or your account isn't tied to a specific broker,
  you'll see **all 15 tracked brokers**.

This means each broker's team can be given a login that only shows their own
performance, while admins or oversight roles see the full picture.

---

## Admin Panel

Admins get an additional section (separate from the main dashboard) for
managing the system. It has two areas:

### Broker Management

A registry of the brokers tracked by the system. From here, admins can:

- **Add a broker** — give it an ID (short code, e.g. "SNM") and a display
  label
- **Edit a broker's label** — click Edit, change the name inline, then Save
  or Cancel
- **Delete a broker** — removes it from the list, *unless* it's currently
  assigned to a user account (in which case you'll get a clear error
  explaining why it can't be deleted)

### User Management

Full control over who can log in and what they can see:

- **Add a user** — set their email, initial password, role (`user` or
  `admin`), and optionally assign them to a specific broker
- **Edit a user** — change any of the above, plus toggle whether their
  account is active
- **Status badges** — at a glance, see each user's role, assigned broker (or
  "—" if none), whether they're active, and whether they still need to
  change their password
- **Delete a user** — removes their account; admins can't delete their *own*
  account (the button is disabled) as a safeguard

All admin actions give clear feedback — success messages on completion, and
red error banners if something goes wrong (e.g. trying to use an email that's
already registered).

---

## Things to Keep in Mind (Current Version)

- **Filters don't change the data yet** — the From/To Date and Stock
  Exchange filters on the dashboard are there for future use; right now the
  dashboard always shows the latest collected snapshot regardless of what
  you select.
- **Market value units** — the market-wide "value" figure may use a
  different scale than individual broker values; the share percentages
  account for this, but it's worth being aware of if you're cross-checking
  numbers manually.
- **Placeholder dates** — if the market data shows a date of "—", this means
  the external system returned a default/placeholder date rather than a real
  one — it's expected and not an error.
