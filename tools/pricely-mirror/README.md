# pricely-mirror

One-time, paced backup of the pricely.ar catalog (the API Alacena uses for barcode lookups) into a single SQLite file, plus product images. Python 3 standard library only.

## What it saves

| Table | Contents |
|---|---|
| `products` | Everything `/product/:ean` returns (name, description, imagePath, blurHash, avg/min price, cheapest market, relevance) and the raw JSON of the three endpoints |
| `product_prices` | One row per product × market: price, discount, discount details, store URL, timestamp |
| `categories`, `product_categories` | The category tree tags for each product |
| `queue` | Crawl progress (one row per EAN) |
| `meta` | When the sitemaps were read and what `/counts` reported at the time |

Images are saved to `./images/<n>/<ean>.webp`, mirroring `imagePath`.

## Run (on the backup machine)

```bash
cd ~/pricely-mirror
tmux new -s pricely   # or: nohup ... > crawl.log 2>&1 &
python3 pricely_mirror.py run 2>&1 | tee -a crawl.log    # sitemaps + crawl, ~35 h at defaults
python3 pricely_mirror.py status                         # from another shell, any time
```

- The defaults are 3 API requests/s and 3 image requests/s. When the API returns 429 or 5xx errors, the script slows down automatically.
- Ctrl-C or `kill` stops it cleanly. Running the same command again resumes where it stopped.
- Products that error get up to 5 attempts. To retry them, run `crawl` again.
- When the queue is empty the script exits. Nothing is scheduled, so the API is left alone.

## Optional: products not in the sitemap

The sitemaps list about 124k products, while `/counts` reports about 320k. The only other way to find the rest is category pages. The site's own search costs them an embedding call per query, and their robots.txt asks crawlers to avoid it, so the script doesn't use search.

```bash
python3 pricely_mirror.py discover --estimate   # sweeps page 1 of the 7,713 categories (~45 min), prints the cost of the rest
python3 pricely_mirror.py discover              # walks the remaining pages, queues new EANs
python3 pricely_mirror.py crawl                 # prices/categories/images for the new ones
```

## Decoding note

API bodies are obfuscated: the body is base64 of the JSON, reversed, with one junk character, which ends up at the front after reversing. To decode: reverse, drop the first character, base64-decode, then parse the JSON. The same decoding is in `back-alacena/src/lib/pricely.ts`.
