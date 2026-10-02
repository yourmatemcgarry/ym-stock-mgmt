# Coldroom

Stock and production planning for Your Mates Brewing — the working parts of the
Stock Management Sheet, as a web app.

Five screens: **Forecast** (projected stock on hand across the coldroom,
distributors and channels), **Stocktake** (the weekly batch-level count),
**Production** (packaging runs and the brew dates they imply), **Aged stock**
(best-before and send-by cut-offs) and **Setup** (products, packs, distributors
and channels).

---

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
   `netlify.toml` already sets the publish directory (`public`) and the
   functions directory, so leave the build settings alone. There is no build
   step — the page is a single HTML file.
3. Deploy. Open the site and press **Load starting data** once. That reads
   `public/seed.json` and writes it into the site's blob store: products,
   distributors and channels, two years of weekly history, the plan settings,
   and every stocktake up to w/c 28 September 2026, plus the packaging runs
   from the Beer In rows (recent ones and everything planned ahead).

That import only needs doing once, on the first deploy. Redeploys don't touch
the stored data — it lives in Netlify Blobs, not in the repo.

## The passphrase

The site is on a public URL, so by default the data API is behind one shared
passphrase.

- Set it in Netlify under **Site configuration → Environment variables**, as
  `COLDROOM_KEY`. Pick anything; share it with whoever needs the figures.
- Everyone types it once per browser and it's remembered after that.
- The check happens in the function, not in the page, so the stock figures
  can't be read without it.
- **To turn it off**, delete the `COLDROOM_KEY` variable and redeploy. The site
  then has no access control at all — anyone with the URL can read and change
  the stock data.

If no `COLDROOM_KEY` is set the gate is simply off, so the first deploy works
without configuring anything. Set it before sharing the link.

## Layout

```
public/index.html          the whole app — one file, no build step
public/seed.json           starting data, used once by "Load starting data"
public/robots.txt          keeps the site out of search engines
netlify/functions/db.mjs   the data API, over Netlify Blobs
netlify.toml               publish dir, function bundler, security headers
```

### The data API

All of it is behind `/api/db`, and every request needs the `x-coldroom-key`
header when a passphrase is set.

| Method   | Path                      | Does                        |
| -------- | ------------------------- | --------------------------- |
| `GET`    | `/api/db/:collection`     | every document in it        |
| `GET`    | `/api/db/:collection/:id` | one document                |
| `PUT`    | `/api/db/:collection/:id` | create or replace           |
| `DELETE` | `/api/db/:collection/:id` | remove                      |

Collections: `config`, `products`, `locations`, `history`, `plan`,
`stocktakes`, `runs`.

## Where the data came from

Everything was imported from the Stock Management Sheet as at 2 October 2026 and
checked back against it cell by cell: 34,166 weekly history values, 136
packaging runs and 921 stocktake lines, with no differences. Two row types in
the sheet are deliberately not imported because they restate rows above them —
the `Total` roll-up, and the `YM` drawdown row, which covers stock already
counted under `YM Taproom`.

The sheet's forward `A - Stock Out` figures for the retail chains were brought
across as their order plans, and for the direct channels as manual figures, so
the app starts out agreeing with the sheet. Change any of them per location in
the forecast grid.

## How the forecast works

Taken from the conventions in the original sheet:

- **Stock out** is what the brewery ships. **Drawdown** is the distributor's own
  depletion — their sales out of their warehouse.
- Stock shipped in one week lands on a distributor's shelf **the following
  week**. The projection models that transit week; it's visible in the sheet's
  own numbers.
- Each distributor's drawdown is forecast on one of three bases, switchable per
  distributor in the forecast grid: **prior year**, **recent average** (default
  8 weeks), or **manual**.
- Replenishment is either **their order plan** — typed straight into the grid,
  usually 13 weeks out — or **top up to a target stock level** in their
  warehouse.
- The coldroom balance is opening stock, plus beer in from planned packaging
  runs, less everything shipped out. Where it goes negative, that's the
  stock-out week; the brew-by date works back from it using each product's
  brew-to-pack time (Setup, default 21 days).
- **Send by** is best before minus half the product's shelf life — the last date
  a batch can go to a distributor with half its life left. Shelf life is per
  product per pack in Setup, defaulting to 12 months for cans and 6 for kegs.

## The weekly routine

**Stocktake → New stocktake**, set the week, and choose *Last stocktake's
batches (qty cleared)*. Every line comes through with its batch number and
best-before date, and uncounted lines sit amber until you put a number in.
Click the first count, type, press Enter — it moves down the column. It saves as
you go, and the forecast moves with it.

## Developing

The page is built from parts in the parent working directory (`app_core.js`,
`app_net.js`, `app_engine.js`, `app_views*.js` and `brewstock.html`) by
`build.py`, which writes both `public/index.html` and the Claude-artifact
version. Editing `public/index.html` directly is fine for a quick fix, but it
will be overwritten next time the build runs.

Running locally needs the Netlify CLI, so that blob storage and the function
are available:

```sh
npm install
npx netlify dev
```
