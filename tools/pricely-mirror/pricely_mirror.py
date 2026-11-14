#!/usr/bin/env python3
"""
One-time, paced mirror of the pricely.ar catalog into a local SQLite file.

Stdlib only (Python 3.8+). Resumable: stop it any time (Ctrl-C / kill) and
re-run the same command; it continues where it left off.

Steps (run in order, or just `run` for 1+2):
  1. sitemaps   list every product EAN + category id from pricely.ar sitemaps
  2. crawl      per product: /product/:ean, /prices, /categories, and the image
  3. discover   (optional) walk category pages to find products that are NOT
                in the sitemap (/counts reports ~320k vs ~124k in sitemaps).
                Run `discover --estimate` first to see how many pages that is.
  status        print progress

Nothing here schedules itself: when the queue is empty the script exits and
the API is left alone.

The API obfuscates bodies: base64(JSON), reversed, plus one junk char that
ends up at the front after reversing. Undo: reverse -> drop 1st -> b64 -> JSON.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import random
import re
import signal
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone

API = "https://api.pricely.ar"
SITE = "https://pricely.ar"
IMAGES = "https://images.pricely.ar"
UA = "alacena-mirror/1.0 (personal one-time backup; paced)"

STOP = threading.Event()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


# --------------------------------------------------------------------------
# HTTP with a shared, adaptive rate limit per host
# --------------------------------------------------------------------------
MAX_INTERVAL = 30.0  # slowest pace: one request every 30 s


class Pacer:
    """Global min-interval limiter. Backs off on 429/5xx/network errors, slowly recovers.

    Logging: every slowdown says why; while stuck at the slowest pace it repeats
    at most once a minute; recovery is logged each time the rate doubles and when
    it is back to full speed.
    """

    def __init__(self, rate: float, name: str):
        self.base = 1.0 / rate
        self.interval = self.base
        self.next_at = 0.0
        self.lock = threading.Lock()
        self.name = name
        self.logged = self.interval   # interval at the last slowdown/speedup log line
        self.logged_at = 0.0          # when we last logged a slowdown

    def wait(self) -> None:
        with self.lock:
            t = time.monotonic()
            at = max(self.next_at, t)
            # small jitter so we don't look like a metronome
            self.next_at = at + self.interval * random.uniform(0.8, 1.2)
        d = at - time.monotonic()
        if d > 0:
            STOP.wait(d)

    def penalize(self, reason: str, retry_after: float | None = None) -> None:
        with self.lock:
            t = time.monotonic()
            old = self.interval
            new = self.interval = min(self.interval * 2, MAX_INTERVAL)
            if retry_after:
                self.next_at = max(self.next_at, t + retry_after)
            self.logged = new
            show = new != old or t - self.logged_at >= 60
            if show:
                self.logged_at = t
        if not show:
            return
        why = reason + (f", server asked to wait {retry_after:g}s" if retry_after else "")
        if new != old:
            log(f"{self.name}: slowing down {1 / old:.2f} -> {1 / new:.2f} req/s ({why})")
        else:
            log(f"{self.name}: still at slowest pace {1 / new:.2f} req/s ({why})")

    def reward(self) -> None:
        msg = None
        with self.lock:
            if self.interval > self.base:
                self.interval = max(self.base, self.interval * 0.98)
                if self.interval == self.base:
                    msg = f"back to full speed {1 / self.base:.2f} req/s"
                elif self.interval <= self.logged / 2:
                    msg = f"speeding up -> {1 / self.interval:.2f} req/s"
                if msg:
                    self.logged = self.interval
        if msg:
            log(f"{self.name}: {msg}")


class NotFound(Exception):
    pass


def describe(e: Exception) -> str:
    """Short, human-readable reason for a failed request."""
    if isinstance(e, urllib.error.HTTPError):
        return f"HTTP {e.code}"
    if isinstance(e, urllib.error.URLError) and isinstance(e.reason, Exception):
        e = e.reason  # e.g. timeout, DNS failure, connection refused
    return (str(e) or type(e).__name__)[:120]


def http_get(url: str, pacer: Pacer, timeout: float = 30, tries: int = 6) -> bytes:
    path = url.split(".ar", 1)[-1]  # e.g. /product/779.../prices
    delay = 2.0
    last: Exception | None = None
    for _ in range(tries):
        if STOP.is_set():
            raise KeyboardInterrupt
        pacer.wait()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
            pacer.reward()
            return body
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise NotFound(url)
            last = e
            if e.code == 429 or e.code >= 500:
                ra = e.headers.get("Retry-After")
                pacer.penalize(f"{describe(e)} on {path}", float(ra) if ra and ra.isdigit() else None)
            else:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = e
            pacer.penalize(f"{describe(e)} on {path}")
        STOP.wait(delay + random.uniform(0, 1))
        delay = min(delay * 2, 120)
    raise RuntimeError(f"giving up on {url}: {last}")


def decode(raw: bytes):
    text = raw.decode("utf-8", "replace").strip()
    if text[:1] in "{[":
        return json.loads(text)
    s = text[::-1][1:]
    s += "=" * (-len(s) % 4)
    return json.loads(base64.b64decode(s).decode("utf-8"))


# --------------------------------------------------------------------------
# Storage
# --------------------------------------------------------------------------
SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

-- work queue: one row per known EAN, a timestamp per finished sub-task
CREATE TABLE IF NOT EXISTS queue (
  ean            TEXT PRIMARY KEY,
  source         TEXT NOT NULL,          -- 'sitemap' | 'category'
  sitemap_lastmod TEXT,
  product_at     TEXT,
  prices_at      TEXT,
  categories_at  TEXT,
  image_at       TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);

CREATE TABLE IF NOT EXISTS products (
  ean                TEXT PRIMARY KEY,
  name               TEXT,
  description        TEXT,
  image_path         TEXT,
  image_file         TEXT,               -- relative path under images dir, if downloaded
  blur_hash          TEXT,
  avg_price          REAL,
  avg_discount_price REAL,
  min_price          REAL,
  min_price_market   TEXT,
  relevance          REAL,
  source_updated_at  TEXT,
  not_found          INTEGER NOT NULL DEFAULT 0,
  raw_json           TEXT,               -- full /product/:ean payload
  prices_json        TEXT,               -- full /product/:ean/prices payload
  categories_json    TEXT,               -- full /product/:ean/categories payload
  fetched_at         TEXT
);
CREATE INDEX IF NOT EXISTS products_name_idx ON products(name);

CREATE TABLE IF NOT EXISTS product_prices (
  ean              TEXT NOT NULL,
  market           TEXT NOT NULL,
  price            REAL,
  discount_price   REAL,
  discount_details TEXT,
  url              TEXT,
  updated_at       TEXT,
  PRIMARY KEY (ean, market)
);

CREATE TABLE IF NOT EXISTS categories (
  id             INTEGER PRIMARY KEY,
  name           TEXT,
  total_products INTEGER,
  total_pages    INTEGER,
  markets_json   TEXT,
  pages_done     INTEGER NOT NULL DEFAULT 0,   -- for `discover`
  fetched_at     TEXT
);

CREATE TABLE IF NOT EXISTS product_categories (
  ean         TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (ean, category_id)
);
CREATE INDEX IF NOT EXISTS product_categories_cat_idx ON product_categories(category_id);
"""


def open_db(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path, timeout=60, isolation_level=None)
    db.executescript(SCHEMA)
    return db


def set_meta(db, key, value):
    db.execute("INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)", (key, json.dumps(value)))


def num(x):
    return x if isinstance(x, (int, float)) else None


def upsert_product(db, ean: str, p: dict, raw_text: str | None):
    db.execute(
        """INSERT INTO products(ean,name,description,image_path,blur_hash,avg_price,avg_discount_price,
             min_price,min_price_market,relevance,source_updated_at,raw_json,fetched_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(ean) DO UPDATE SET
             name=excluded.name, description=COALESCE(excluded.description, products.description),
             image_path=excluded.image_path, blur_hash=excluded.blur_hash, avg_price=excluded.avg_price,
             avg_discount_price=excluded.avg_discount_price, min_price=excluded.min_price,
             min_price_market=excluded.min_price_market, relevance=excluded.relevance,
             source_updated_at=excluded.source_updated_at,
             raw_json=COALESCE(excluded.raw_json, products.raw_json), fetched_at=excluded.fetched_at""",
        (
            ean, p.get("name"), p.get("description"), p.get("imagePath"), p.get("blurHash") or None,
            num(p.get("avgPrice")), num(p.get("avgDiscountPrice")), num(p.get("minPrice")),
            p.get("minPriceMarket") or None, num(p.get("relevance")), p.get("updatedAt"),
            raw_text, now(),
        ),
    )


# --------------------------------------------------------------------------
# 1. sitemaps
# --------------------------------------------------------------------------
LOC_RE = re.compile(r"<loc>([^<]+)</loc>(?:\s*<lastmod>([^<]+)</lastmod>)?")


def cmd_sitemaps(db, args):
    pacer = Pacer(1.0, "site")
    index = http_get(f"{SITE}/sitemap.xml", pacer).decode()
    maps = [u for u, _ in LOC_RE.findall(index)]
    log(f"sitemap index: {len(maps)} sitemaps")
    n_prod = n_cat = 0
    db.execute("BEGIN")
    for m in maps:
        body = http_get(m, pacer, timeout=120).decode()
        for loc, lastmod in LOC_RE.findall(body):
            if mp := re.search(r"/product/([^/?#]+)$", loc):
                ean = mp.group(1)
                db.execute(
                    """INSERT INTO queue(ean,source,sitemap_lastmod) VALUES(?,?,?)
                       ON CONFLICT(ean) DO UPDATE SET source='sitemap', sitemap_lastmod=excluded.sitemap_lastmod""",
                    (ean, "sitemap", lastmod or None),
                )
                n_prod += 1
            elif mc := re.search(r"/category/(\d+)$", loc):
                db.execute("INSERT OR IGNORE INTO categories(id) VALUES(?)", (int(mc.group(1)),))
                n_cat += 1
        log(f"  {m}: running totals {n_prod} products, {n_cat} categories")
    try:
        set_meta(db, "counts_at_sitemaps", decode(http_get(f"{API}/counts", pacer)))
    except Exception as e:  # informational only
        log(f"  /counts failed: {e}")
    set_meta(db, "sitemaps_at", now())
    db.execute("COMMIT")
    log(f"sitemaps done: {n_prod} products, {n_cat} categories queued")


# --------------------------------------------------------------------------
# 2. crawl
# --------------------------------------------------------------------------
def fetch_product_tasks(ean: str, need: dict, api: Pacer, img: Pacer, images_dir: str | None):
    """Runs in a worker thread. Returns a dict of results; never touches the DB."""
    out: dict = {"ean": ean}
    if need["product"]:
        try:
            raw = http_get(f"{API}/product/{ean}", api)
            out["product"] = decode(raw)
            out["product_raw"] = json.dumps(out["product"], ensure_ascii=False)
        except NotFound:
            out["not_found"] = True
            return out
    if need["prices"]:
        try:
            out["prices"] = decode(http_get(f"{API}/product/{ean}/prices", api))
        except NotFound:
            out["prices"] = None
    if need["categories"]:
        try:
            out["categories"] = decode(http_get(f"{API}/product/{ean}/categories", api))
        except NotFound:
            out["categories"] = None
    if need["image"] and images_dir:
        image_path = (out.get("product") or {}).get("imagePath") or need.get("image_path")
        if image_path:
            dest = os.path.join(images_dir, image_path)
            if not os.path.exists(dest):
                try:
                    data = http_get(f"{IMAGES}/{image_path}", img, timeout=60)
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    tmp = dest + ".part"
                    with open(tmp, "wb") as f:
                        f.write(data)
                    os.replace(tmp, dest)
                except NotFound:
                    image_path = None
            out["image_file"] = image_path
        out["image_done"] = True
    return out


def save_result(db, r: dict):
    ean, ts = r["ean"], now()
    db.execute("BEGIN")
    if r.get("not_found"):
        db.execute(
            "INSERT INTO products(ean,not_found,fetched_at) VALUES(?,1,?) "
            "ON CONFLICT(ean) DO UPDATE SET not_found=1, fetched_at=excluded.fetched_at",
            (ean, ts),
        )
        db.execute(
            "UPDATE queue SET product_at=?,prices_at=?,categories_at=?,image_at=?,last_error='404' WHERE ean=?",
            (ts, ts, ts, ts, ean),
        )
        db.execute("COMMIT")
        return
    if "product" in r:
        upsert_product(db, ean, r["product"], r["product_raw"])
        db.execute("UPDATE queue SET product_at=? WHERE ean=?", (ts, ean))
    if "prices" in r:
        pr = r["prices"]
        db.execute("UPDATE products SET prices_json=? WHERE ean=?",
                   (json.dumps(pr, ensure_ascii=False) if pr is not None else None, ean))
        db.execute("DELETE FROM product_prices WHERE ean=?", (ean,))
        for market, m in ((pr or {}).get("markets") or {}).items():
            db.execute(
                "INSERT INTO product_prices VALUES(?,?,?,?,?,?,?)",
                (ean, market, num(m.get("price")), num(m.get("discountPrice")),
                 m.get("discountDetails") or None, m.get("url"), m.get("updatedAt")),
            )
        db.execute("UPDATE queue SET prices_at=? WHERE ean=?", (ts, ean))
    if "categories" in r:
        cats = r["categories"] or []
        db.execute("UPDATE products SET categories_json=? WHERE ean=?",
                   (json.dumps(cats, ensure_ascii=False), ean))
        db.execute("DELETE FROM product_categories WHERE ean=?", (ean,))
        for c in cats:
            db.execute("INSERT INTO categories(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=COALESCE(categories.name, excluded.name)",
                       (c["id"], c.get("name")))
            db.execute("INSERT OR IGNORE INTO product_categories VALUES(?,?)", (ean, c["id"]))
        db.execute("UPDATE queue SET categories_at=? WHERE ean=?", (ts, ean))
    if r.get("image_done"):
        db.execute("UPDATE products SET image_file=? WHERE ean=?", (r.get("image_file"), ean))
        db.execute("UPDATE queue SET image_at=? WHERE ean=?", (ts, ean))
    db.execute("UPDATE queue SET last_error=NULL WHERE ean=?", (ean,))
    db.execute("COMMIT")


def cmd_crawl(db, args):
    images_dir = None if args.no_images else os.path.abspath(args.images_dir)
    api = Pacer(args.rate, "api")
    img = Pacer(args.image_rate, "images")
    cond = "product_at IS NULL OR prices_at IS NULL OR categories_at IS NULL"
    if images_dir:
        cond += " OR image_at IS NULL"
    rows = db.execute(
        f"""SELECT q.ean, q.product_at, q.prices_at, q.categories_at, q.image_at, p.image_path
            FROM queue q LEFT JOIN products p USING(ean)
            WHERE ({cond}) AND q.attempts < ? ORDER BY q.rowid""",
        (args.max_attempts,),
    ).fetchall()
    if args.limit:
        rows = rows[: args.limit]
    total = len(rows)
    log(f"crawl: {total} products pending (api {args.rate}/s, images "
        f"{'off' if not images_dir else f'{args.image_rate}/s -> {images_dir}'})")
    if not total:
        return
    done = errors = 0
    t0 = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        it = iter(rows)
        inflight = {}

        def submit_next():
            row = next(it, None)
            if row is None or STOP.is_set():
                return
            ean, p_at, pr_at, c_at, i_at, image_path = row
            need = {"product": p_at is None, "prices": pr_at is None,
                    "categories": c_at is None, "image": i_at is None, "image_path": image_path}
            inflight[pool.submit(fetch_product_tasks, ean, need, api, img, images_dir)] = ean

        for _ in range(args.workers * 2):
            submit_next()
        while inflight:
            finished, _ = wait(list(inflight), return_when=FIRST_COMPLETED)
            for fut in finished:
                ean = inflight.pop(fut)
                try:
                    save_result(db, fut.result())
                except KeyboardInterrupt:
                    continue  # stopping; this product stays pending
                except Exception as e:
                    errors += 1
                    if db.in_transaction:
                        db.execute("ROLLBACK")
                    db.execute("UPDATE queue SET attempts=attempts+1,last_error=? WHERE ean=?",
                               (str(e)[:500], ean))
                    log(f"  error {ean}: {e}")
                done += 1
                if done % 250 == 0 or done == total:
                    el = time.monotonic() - t0
                    eta = el / done * (total - done)
                    log(f"  {done}/{total} ({done / total:.1%}), errors {errors}, "
                        f"{done / el:.2f} products/s, ETA {eta / 3600:.1f} h")
                submit_next()
    log(f"crawl {'interrupted' if STOP.is_set() else 'finished'}: {done} processed, {errors} errors")


# --------------------------------------------------------------------------
# 3. discover (products not listed in sitemaps)
# --------------------------------------------------------------------------
def save_category_page(db, cid: int, page: int, data: dict) -> int:
    new = 0
    db.execute("BEGIN")
    db.execute(
        """UPDATE categories SET name=?, total_products=?, total_pages=?, markets_json=?, fetched_at=?,
           pages_done=MAX(pages_done, ?) WHERE id=?""",
        (data.get("name"), data.get("totalProducts"), data.get("totalPages"),
         json.dumps(data.get("availableMarkets"), ensure_ascii=False), now(), page, cid),
    )
    for p in data.get("products") or []:
        ean = str(p.get("ean"))
        cur = db.execute("INSERT OR IGNORE INTO queue(ean,source) VALUES(?, 'category')", (ean,))
        if cur.rowcount:
            new += 1
            # listing already carries the full product object -> skip /product/:ean for it
            upsert_product(db, ean, p, json.dumps(p, ensure_ascii=False))
            db.execute("UPDATE queue SET product_at=? WHERE ean=?", (now(), ean))
        db.execute("INSERT OR IGNORE INTO product_categories VALUES(?,?)", (ean, cid))
    db.execute("COMMIT")
    return new


def cmd_discover(db, args):
    api = Pacer(args.rate, "api")
    # page 1 of every category (gives totals); resumable via pages_done
    todo = [r[0] for r in db.execute("SELECT id FROM categories WHERE pages_done=0 ORDER BY id")]
    log(f"discover: sweeping page 1 of {len(todo)} categories")
    new = 0
    for i, cid in enumerate(todo, 1):
        if STOP.is_set():
            return
        try:
            new += save_category_page(db, cid, 1, decode(http_get(f"{API}/category/{cid}", api)))
        except NotFound:
            db.execute("UPDATE categories SET pages_done=-1 WHERE id=?", (cid,))
        if i % 200 == 0:
            log(f"  {i}/{len(todo)} categories, {new} new products so far")
    remaining = db.execute(
        "SELECT COALESCE(SUM(total_pages - pages_done),0), COUNT(*) FROM categories "
        "WHERE pages_done>0 AND total_pages > pages_done").fetchone()
    log(f"page-1 sweep done ({new} new products). Remaining: {remaining[0]} pages in "
        f"{remaining[1]} categories (~{remaining[0] / args.rate / 3600:.1f} h at {args.rate}/s)")
    if args.estimate:
        return
    # smallest categories first: cheapest way to surface niche products
    cats = db.execute(
        "SELECT id, pages_done, total_pages FROM categories WHERE pages_done>0 AND total_pages>pages_done "
        "ORDER BY total_pages").fetchall()
    for cid, pdone, tp in cats:
        for page in range(pdone + 1, tp + 1):
            if STOP.is_set():
                return
            try:
                n = save_category_page(db, cid, page, decode(http_get(f"{API}/category/{cid}?page={page}", api)))
                new += n
            except NotFound:
                break
        log(f"  category {cid} done ({tp} pages); {new} new products total")
    log(f"discover finished: {new} new products queued. Run `crawl` again to fetch their prices/categories/images.")


# --------------------------------------------------------------------------
def cmd_status(db, args):
    q = db.execute("""SELECT COUNT(*), SUM(product_at IS NOT NULL), SUM(prices_at IS NOT NULL),
                      SUM(categories_at IS NOT NULL), SUM(image_at IS NOT NULL),
                      SUM(last_error IS NOT NULL AND last_error!='404'), SUM(source='category')
                      FROM queue""").fetchone()
    p = db.execute("SELECT COUNT(*), SUM(not_found), SUM(image_file IS NOT NULL) FROM products").fetchone()
    c = db.execute("SELECT COUNT(*), SUM(pages_done>0), SUM(total_pages>pages_done AND pages_done>0) FROM categories").fetchone()
    print(f"queue:      {q[0]} eans ({q[6] or 0} from categories)")
    print(f"  product   {q[1] or 0}   prices {q[2] or 0}   categories {q[3] or 0}   image {q[4] or 0}")
    print(f"  erroring  {q[5] or 0}")
    print(f"products:   {p[0]} rows, {p[1] or 0} not found, {p[2] or 0} images on disk")
    print(f"prices:     {db.execute('SELECT COUNT(*) FROM product_prices').fetchone()[0]} rows")
    print(f"categories: {c[0]} known, {c[1] or 0} swept, {c[2] or 0} with pages left")
    for k, v in db.execute("SELECT key,value FROM meta"):
        print(f"meta {k}: {v}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default="pricely.db")
    ap.add_argument("--images-dir", default=".", help="imagePath already starts with images/ (default: cwd)")
    ap.add_argument("--no-images", action="store_true")
    ap.add_argument("--rate", type=float, default=3.0, help="max API requests/s (default 3)")
    ap.add_argument("--image-rate", type=float, default=3.0, help="max image requests/s (default 3)")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--max-attempts", type=int, default=5)
    ap.add_argument("--limit", type=int, default=0, help="crawl at most N products (testing)")
    ap.add_argument("--estimate", action="store_true", help="discover: only sweep page 1 and estimate")
    ap.add_argument("cmd", choices=["sitemaps", "crawl", "run", "discover", "status"])
    args = ap.parse_args()

    def on_signal(*_):
        if STOP.is_set():
            sys.exit(1)
        log("stopping after in-flight requests (signal again to force)...")
        STOP.set()

    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)

    db = open_db(args.db)
    if args.cmd in ("sitemaps", "run"):
        if args.cmd == "sitemaps" or not db.execute("SELECT 1 FROM meta WHERE key='sitemaps_at'").fetchone():
            cmd_sitemaps(db, args)
    if args.cmd in ("crawl", "run"):
        cmd_crawl(db, args)
    if args.cmd == "discover":
        cmd_discover(db, args)
    if args.cmd == "status":
        cmd_status(db, args)


if __name__ == "__main__":
    main()
