# self-paying

A static website that earns from search traffic with no running costs: **NetAfterFees**, a set of seller-fee calculators for 16 platforms (Stripe, PayPal, Etsy, eBay, Gumroad, Patreon and others).

It is built to cost nothing to run. There is no server, no database and no AI calls at runtime: a dependency-free Node script generates over 300 static pages, and GitHub Pages hosts them for free.

## What it builds

| Pages | Count | Example |
| --- | --- | --- |
| Home: compare all platforms for one price | 1 | `/` |
| Fee calculator per platform | 16 | `/etsy-fee-calculator/` |
| Platform × amount | 160 | `/stripe-fee-calculator/100/` |
| Head-to-head comparisons | 120 | `/compare/gumroad-vs-lemon-squeezy/` |
| Profit calculator, general and per platform | 17 | `/etsy-profit-calculator/` |
| Price list tool with CSV export | 1 | `/price-list/` |
| About, comparison index, 404 | 3 | `/about/` |
| Embeddable widgets (not indexed) | 16 | `/embed/etsy/` |

Each fee calculator page offers copy-and-paste code for an embeddable widget. The widget carries a link back to the site, so every blog or shop that embeds it is a backlink, which is the main thing a new site needs to rank.

Plus `sitemap.xml`, `robots.txt` and FAQ structured data.

## Run it

```
npm test        # fee maths, data checks, full build and internal link check
npm run build   # writes ./dist
npm run serve   # builds and previews at http://localhost:8080/self-paying/
```

## Go live

1. Merge this branch into `main`.
2. Make the repository public (GitHub Pages needs that on a free plan).
3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. The `Build and deploy site` workflow publishes to `https://lucas-ash.github.io/self-paying/` on every push to `main`.

For a custom domain, set `origin` to the domain and `basePath` to `""` in `site.config.json`, then add the domain in Settings → Pages.

## Turn on revenue

Nothing earns until you connect accounts that you own. All of it is configured in `site.config.json` under `monetization`; an empty value means that feature is left off the pages.

| Key | What to put there | What it does |
| --- | --- | --- |
| `affiliates` | `{ "lemon-squeezy": "https://…", "shopify-payments": "https://…" }` | Adds a labelled sign-up button on that platform's pages, with an affiliate disclosure in the footer |
| `adsenseClient` | `ca-pub-…` from Google AdSense | Loads AdSense Auto ads and writes `ads.txt` |
| `sponsor` | `{ "text": "…", "url": "https://…" }` | A labelled sponsor line on every page, for a placement you sell directly |
| `newsletterAction` | The form URL from an email service such as Buttondown or MailerLite | Adds a "tell me when fees change" sign-up; the form posts a field named `email` |
| `tipUrl` | A Stripe Payment Link, Ko-fi or Buy Me a Coffee URL | Adds a Support page and footer link |
| `goatcounterCode` | Your GoatCounter site code | Privacy-friendly visit counts |

After deploying, add the site to Google Search Console and submit `sitemap.xml`. AdSense and most affiliate programmes will only approve a site that is live and has some traffic.

## Keeping rates current

All rates live in `data/platforms.json`, with the date they were last reviewed and a link to each platform's fee page. Update a rate and the `reviewed` date, push, and every page rebuilds. The tests pin a few known results, so update those too when a pinned rate changes.

## Realistic expectations

- Fee calculators are a crowded search niche. A new site on a `github.io` address will get little or no traffic for the first months.
- Revenue follows traffic. Display ads pay a few dollars per thousand visits; affiliate sign-ups pay more but are rarer.
- The rates were checked against search results on the review date, mostly from third-party summaries. Check each one against the platform's own fee page before promoting the site.
