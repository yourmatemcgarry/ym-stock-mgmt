# Coldroom

Stock and production planning for Your Mates Brewing — the working parts of the
Stock Management Sheet, as a web app.

Six screens: **Forecast** (the grid everything is typed into and read off —
projected stock on hand across the coldroom, distributors and channels),
**Stocktake** (the weekly batch-level count), **Production** (packaging runs and
the brew dates they imply), **Aged stock** (best-before and send-by cut-offs),
**Review** (year on year, and how well each forecast basis has held up) and
**Setup** (products, packs, distributors and channels).

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

## Deploying new data

The data lives in the site's blob store, **not** in the deploy, so pushing a
build with a new `public/seed.json` does not load it on its own — the site keeps
showing what it already has.

When a deploy carries newer data the app says so: a bar appears across the top
of every screen — *"This deploy has newer data than the site is showing"* — with
an **Import it now** button. Pressing it writes every record in the deployed
file over the top.

Packaging runs that came from the sheet (their ids start with `sheet-`) are also
*removed* when the file no longer carries them, so a run the sheet has moved to
another week or cancelled does not linger and get counted twice. Anything
created in the app — a stocktake entered here, a run scheduled from the
Production tab — has an id of its own and is left alone.

A data file can also retire a document by name, through a `remove` list of
`{collection, id}` at the top level — that is how a channel merged into another
leaves the site's store. Only the ids listed there are deleted, so a distributor
added in the app is never caught up in it.

The same control sits permanently under **Setup -> Data in this site**, with the
date of the export the live data came from, so you can always tell which vintage
you are looking at.

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

Everything was imported from the Stock Management Sheet and checked back against
it cell by cell — at the latest refresh, 47,300 weekly history values, 135
packaging runs and 1,499 stocktake lines, with no differences. Two row types in
the sheet are deliberately not imported because they restate rows above them —
the `Total` roll-up, and the `YM` drawdown row, which covers stock already
counted under `YM Taproom`.

`COLES QLD (10 Pk)` is the same customer in the same Larry Can units, so its
rows are added into `COLES QLD` on the way in: one channel, holding the stock
and the drawdown of both. The sheet still keeps them apart, and the import folds
them every time, so nothing needs changing at that end.

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
- **Stock on hand** is what a distributor holds on the Monday morning of that
  week. **Drawdown** against a week is what they went through the week before —
  the sheet's own convention, and what the count each Monday measures.
- Each distributor's drawdown is forecast on one of these bases, switchable per
  distributor in the forecast grid: **prior year**, **recent average** (default
  8 weeks), **manual** (only the weeks you type; the rest fall back to prior
  year), **flat number**, or **like another SKU**. The drawdown row itself takes
  typed figures, same as the shipping row.
- **Flat number** is the quick one: type a figure into any forecast week and it
  holds for every week after it, until another figure is typed over the top.
  Weeks before the first entry keep the ordinary forecast, so a figure put
  further out reads as a step change rather than rewriting everything in front
  of it.
- Replenishment is either **their order plan** — typed straight into the grid,
  usually 13 weeks out — or **top up to a target stock level**: the week's
  shipment is the target less what they are holding that week. Their stock then
  rolls forward as last week's stock, plus whatever landed, less the week's
  drawdown. Settled down that means we ship them roughly what they use each
  week and they sit about one week's drawdown under the target, since the
  shipment lands a week after the shortfall is measured — set the target to
  include that week.
- Either way, **any shipping figure can be typed over**: on a top-up location a
  typed figure is a known order and is used instead of the calculated one for
  that week, and clearing the cell hands it back to the calculation. Typed
  figures show in bold.
- To undo a lot of those at once, each SKU's header has a **typed over** button.
  It lists every channel holding typed figures — known orders, order plans and
  manual figures, with how many weeks each covers — and clears whole rows in one
  go, for that SKU or every SKU, from this week on or including the past. Only
  known orders typed over a top-up are ticked to begin with, so a distributor's
  order plan or the sheet's own manual figures are never cleared by accident.
  A channel left on manual entry with nothing in it goes back to the default
  basis.
- The coldroom is shown at both ends of each week — **start of week**, then beer
  in from packaging runs, then everything shipped out, then **end of week**. A
  week that can't be got through shows as a negative at the end of it, which is
  the stock-out week; the brew-by date works back from it using each product's
  brew-to-pack time (Setup, default 21 days). Across the history columns the end
  of one week and the start of the next are two different things — the first is
  what the movements say should be there, the second is what was counted — so a
  gap between them is stock the paperwork hasn't accounted for.
- **Send by** is best before minus half the product's shelf life — the last date
  a batch can go to a distributor with half its life left. Shelf life is per
  product per pack in Setup, defaulting to 12 months for cans and 6 for kegs.

## Review

**Year on year** puts the last 52 weeks against the same 52 weeks a year and two
years before — a running total so the gap at the right edge is the answer, then a
table of every distributor and channel with the change against each. Periods end
at the last *full* week, so a part-shipped current week never flatters the
comparison.

**Forecast accuracy** re-predicts each past week from only what was known before
it — the same week a year earlier, or the trailing 8-week average running into it
— and compares both with what actually shipped. The average weekly miss per
channel says which basis is worth trusting for that SKU, with a button to set it.

Both read the same weekly history the forecast runs on, so they get better the
more faithfully each week's actuals are filled in.

## Setting a SKU up

Each SKU's header on the Forecast screen has a **channels** button. It opens the
list of distributors, retail chains and direct channels, with the ones this SKU
goes to ticked. Until someone edits it the list is worked out from history;
once edited, the choice stands. Unticking a channel takes it out of the
forecast and deletes nothing. **Reset to automatic** goes back to inferring it.

A SKU with no history of its own can be **modelled on one that has**: pick a
reference SKU, a percentage, and whether to match channel for channel or always
read one named channel. It then forecasts from that SKU's same-week-last-year
figures, scaled. Any channel left on prior year or recent average falls back to
the model when it has nothing of its own, and a channel can be set to *Like
another SKU* to use it outright. The option appears on a SKU's header while it
has no history, and inside the channels dialog at any time.

New distributors and channels are added under **Setup**, and so are new
products — a product carries its packs, shelf life per pack and brew-to-pack
time, and a new one can copy another product's channels and targets so a new
beer doesn't mean setting up every distributor again. A SKU with no channels
yet says so in the grid, with a button to pick them.

## The weekly routine

**Monday morning — what happened.** Stocktake first: *Stocktake -> New
stocktake*, pick the week, start from last week's batches with quantities
cleared, and count. Then last week's column on the **Forecast** grid: what
actually went out to each channel, and — for the chains and anyone else nobody
counts — what they report holding. Both are typed straight into the grid; there
is no separate screen for them.

Alongside it, the chains' **stock on hand**. The count covers the coldroom, ALM,
Paramount QLD and ILG; nobody counts Coles, WOW, ALM Cairns or Paramount NSW, so
those take a typed figure from the retailer's own reporting, on the *Their SOH*
line. The cell is pre-filled in grey with last week's position plus whatever
landed less the expected drawdown, so it is never blank and the forecast never
reads a missing figure as an empty warehouse — type the reported number over it
and that week's drawdown becomes exact, the same as a count does for the others.
A counted location's stock on hand comes from the count and can't be typed.

**Monday afternoon — what's going out.** The current week is the tinted column,
and every shipping figure in it can be typed. Put in what's going out this week
and the week after moves underneath it: a top-up distributor's stock on hand
rises and next week's top-up falls by the same amount, while a chain's order
comes straight out of the coldroom. Those figures are saved as that week's
actuals, so come next Monday there is nothing to re-enter — only to correct in
the column beside it.

The two live columns sit at the right-hand end of the history block: last week,
which is being tidied up, and this week, which is being decided. Everything
before them is settled and read-only; everything after is the forecast.

The coldroom balance accounts for this: the count is taken on Monday morning, so
this week's packaging and this week's shipments are applied between the count
and the first projected week.

Stock on hand comes from the stocktake, and each distributor's drawdown falls
out of the two together — what they held last week, plus whatever landed that
week, less what they hold now. **Recalculate from stocktakes**, on the Stocktake
screen, redoes that for every week if a count is corrected after the fact.

Counting a week early is fine — start the stocktake for next week whenever it
suits. It doesn't move the app's working week, which always follows the
calendar, and a copied line says nothing about what is there until a quantity is
typed into it. **Blank means not counted yet; a typed 0 means someone went and
found none.** Only the second writes anything into the weekly history.

A count started by mistake can be thrown away: pick its week on the Stocktake
screen and press **Delete**. It takes with it the stock on hand it wrote into
the weekly history, and the drawdowns worked out from those figures — but only
where the stored figure is still the one that count put there, so anything typed
or imported over the top since survives. The dialog says which of the two cases
applies before you commit. A week that also came from the sheet comes back on
the next import.

Those figures land in the same weekly history the forecast reads, so prior year
and recent average keep working from the app's own record rather than needing
another export from the sheet.

The week commencing shown bottom-left is the real calendar week and moves on by
itself every Monday; underneath it says how long ago stock was last counted.

## Older notes on the routine

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
