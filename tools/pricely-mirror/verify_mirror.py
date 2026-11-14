#!/usr/bin/env python3
"""
Read-only health check for a finished pricely_mirror.py run.

  python3 verify_mirror.py                 # offline checks (DB + images on disk)
  python3 verify_mirror.py --live 30       # also re-fetch 30 random products from the API (1 req/s)

Run it from the folder that holds pricely.db and images/. Never writes to the DB.
Exit code: 0 = all OK, 1 = warnings only, 2 = failures.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import random
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

API = "https://api.pricely.ar"
UA = "alacena-mirror/1.0 (personal one-time backup; verification)"

results: list[tuple[str, str]] = []


def report(level: str, msg: str) -> None:
    results.append((level, msg))
    print(f"[{level:4}] {msg}", flush=True)


def ok(m): report("OK", m)
def warn(m): report("WARN", m)
def fail(m): report("FAIL", m)
def info(m): print(f"       {m}", flush=True)


def decode(raw: bytes):
    text = raw.decode("utf-8", "replace").strip()
    if text[:1] in "{[":
        return json.loads(text)
    s = text[::-1][1:]
    s += "=" * (-len(s) % 4)
    return json.loads(base64.b64decode(s).decode("utf-8"))


def pct(a, b):
    return f"{a / b:.1%}" if b else "n/a"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="pricely.db")
    ap.add_argument("--images-dir", default=".", help="same as pricely_mirror.py (imagePath starts with images/)")
    ap.add_argument("--live", type=int, default=0, help="re-fetch N random products from the API to compare")
    ap.add_argument("--max-attempts", type=int, default=5)
    args = ap.parse_args()

    if not os.path.exists(args.db):
        fail(f"{args.db} not found (run from the pricely-mirror folder)")
        sys.exit(2)
    # Only -wal can hold unsaved data; -shm is an index that any reader (this script included) creates.
    wal = args.db + "-wal"
    if os.path.exists(wal) and os.path.getsize(wal) > 0:
        warn(f"{wal} is not empty: the crawler may still be running, or did not close cleanly. "
             "Copy it together with the .db, or stop the crawler first.")

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    print(f"DB size: {os.path.getsize(args.db) / 1e6:.1f} MB\n")

    # ---- 1. file integrity -------------------------------------------------
    print("== SQLite integrity")
    r = db.execute("PRAGMA integrity_check").fetchall()
    ok("integrity_check passed") if r == [("ok",)] else fail(f"integrity_check: {r[:5]}")

    # ---- 2. queue completeness ---------------------------------------------
    print("\n== Crawl completeness (queue)")
    total, src_cat = db.execute("SELECT COUNT(*), SUM(source='category') FROM queue").fetchone()
    info(f"{total} EANs queued ({src_cat or 0} from category discovery)")
    if not total:
        fail("queue is empty: the sitemaps step never ran")
    incomplete = db.execute(
        "SELECT COUNT(*) FROM queue WHERE product_at IS NULL OR prices_at IS NULL "
        "OR categories_at IS NULL OR image_at IS NULL").fetchone()[0]
    gave_up = db.execute(
        "SELECT COUNT(*) FROM queue WHERE attempts>=? AND (product_at IS NULL OR prices_at IS NULL "
        "OR categories_at IS NULL OR image_at IS NULL)", (args.max_attempts,)).fetchone()[0]
    if incomplete == 0:
        ok("every EAN has product, prices, categories and image steps done")
    else:
        (warn if incomplete < total * 0.01 else fail)(
            f"{incomplete} EANs ({pct(incomplete, total)}) still have unfinished steps, "
            f"{gave_up} of them hit max attempts. `python3 pricely_mirror.py crawl` retries the rest; "
            f"for the gave-up ones use --max-attempts 10")
        for step in ("product_at", "prices_at", "categories_at", "image_at"):
            n = db.execute(f"SELECT COUNT(*) FROM queue WHERE {step} IS NULL").fetchone()[0]
            if n:
                info(f"  missing {step}: {n}")
    errs = db.execute("SELECT last_error, COUNT(*) FROM queue WHERE last_error IS NOT NULL "
                      "GROUP BY 1 ORDER BY 2 DESC LIMIT 8").fetchall()
    for e, n in errs:
        info(f"  last_error x{n}: {(e or '')[:110]}")

    meta = dict(db.execute("SELECT key, value FROM meta"))
    if "counts_at_sitemaps" in meta:
        info(f"/counts when sitemaps were read: {meta['counts_at_sitemaps'][:200]}")

    # ---- 3. products table -------------------------------------------------
    print("\n== Products")
    n_prod, n_nf = db.execute("SELECT COUNT(*), SUM(not_found) FROM products").fetchone()
    n_nf = n_nf or 0
    info(f"{n_prod} rows, {n_nf} marked not_found (404 from the API)")
    orphan_q = db.execute("SELECT COUNT(*) FROM queue q LEFT JOIN products p USING(ean) "
                          "WHERE q.product_at IS NOT NULL AND p.ean IS NULL").fetchone()[0]
    ok("every fetched EAN has a products row") if not orphan_q else fail(f"{orphan_q} EANs marked fetched but missing from products")
    if n_nf > n_prod * 0.05:
        warn(f"{pct(n_nf, n_prod)} of products are 404s: higher than expected")

    live_rows = "FROM products WHERE not_found=0"
    no_name = db.execute(f"SELECT COUNT(*) {live_rows} AND (name IS NULL OR name='')").fetchone()[0]
    no_raw = db.execute(f"SELECT COUNT(*) {live_rows} AND raw_json IS NULL").fetchone()[0]
    no_price = db.execute(f"SELECT COUNT(*) {live_rows} AND min_price IS NULL").fetchone()[0]
    no_imgpath = db.execute(f"SELECT COUNT(*) {live_rows} AND (image_path IS NULL OR image_path='')").fetchone()[0]
    found = n_prod - n_nf
    ok("all found products have a name") if not no_name else warn(f"{no_name} products have no name")
    ok("all found products have raw_json") if not no_raw else fail(f"{no_raw} products have no raw_json")
    info(f"without min_price: {no_price} ({pct(no_price, found)}), without imagePath: {no_imgpath} ({pct(no_imgpath, found)})")

    # ---- 4. JSON payloads vs. normalized tables ----------------------------
    print("\n== Raw JSON vs. normalized tables")
    price_rows = Counter(dict(db.execute("SELECT ean, COUNT(*) FROM product_prices GROUP BY ean")))
    cat_rows = Counter(dict(db.execute("SELECT ean, COUNT(*) FROM product_categories GROUP BY ean")))
    bad_json = ean_mismatch = price_mismatch = cat_short = 0
    examples: list[str] = []
    for ean, raw, pj, cj in db.execute(
            f"SELECT ean, raw_json, prices_json, categories_json {live_rows}"):
        try:
            p = json.loads(raw) if raw else {}
            prices = json.loads(pj) if pj else None
            cats = json.loads(cj) if cj else None
        except (ValueError, TypeError):
            bad_json += 1
            continue
        if p.get("ean") is not None and str(p.get("ean")) != ean:
            ean_mismatch += 1
            if len(examples) < 3:
                examples.append(f"row {ean} holds JSON for ean {p.get('ean')}")
        if prices is not None:
            n_m = len((prices or {}).get("markets") or {})
            if n_m != price_rows.get(ean, 0):
                price_mismatch += 1
        if cats is not None and cat_rows.get(ean, 0) < len(cats):
            cat_short += 1  # discover can add extra links, so only "fewer" is wrong
    ok("all stored JSON parses") if not bad_json else fail(f"{bad_json} rows with unparseable JSON")
    ok("raw_json EAN matches the row EAN") if not ean_mismatch else fail(f"{ean_mismatch} rows whose JSON is for another EAN; {examples}")
    ok("product_prices rows match prices_json markets") if not price_mismatch else fail(f"{price_mismatch} products where product_prices != prices_json")
    ok("product_categories covers categories_json") if not cat_short else fail(f"{cat_short} products missing category links")
    n_pp = sum(price_rows.values())
    info(f"{n_pp} price rows, avg {n_pp / found if found else 0:.1f} markets per product")
    for m, n in db.execute("SELECT market, COUNT(*) FROM product_prices GROUP BY 1 ORDER BY 2 DESC LIMIT 12"):
        info(f"  {m}: {n}")
    neg = db.execute("SELECT COUNT(*) FROM product_prices WHERE price<=0 OR discount_price<0").fetchone()[0]
    if neg:
        warn(f"{neg} price rows with price<=0 or negative discount")
    n_cat, named = db.execute("SELECT COUNT(*), SUM(name IS NOT NULL) FROM categories").fetchone()
    info(f"{n_cat} categories ({named or 0} with a name)")

    # ---- 5. images on disk -------------------------------------------------
    print("\n== Images")
    images_dir = os.path.abspath(args.images_dir)
    referenced: set[str] = set()
    missing = empty = not_image = 0
    missing_ex: list[str] = []
    for ean, f in db.execute(f"SELECT ean, image_file {live_rows} AND image_file IS NOT NULL"):
        path = os.path.normpath(os.path.join(images_dir, f))
        referenced.add(path)
        try:
            size = os.path.getsize(path)
        except OSError:
            missing += 1
            if len(missing_ex) < 3:
                missing_ex.append(f"{ean} -> {f}")
            continue
        if size == 0:
            empty += 1
            continue
        with open(path, "rb") as fh:
            head = fh.read(12)
        is_webp = head[:4] == b"RIFF" and head[8:12] == b"WEBP"
        is_other = head[:3] == b"\xff\xd8\xff" or head[:8] == b"\x89PNG\r\n\x1a\n" or head[4:8] == b"ftyp"
        if not (is_webp or is_other):
            not_image += 1
    info(f"{len(referenced)} images referenced by products")
    ok("every referenced image exists on disk") if not missing else fail(f"{missing} referenced images missing, e.g. {missing_ex}")
    ok("no empty image files") if not empty else fail(f"{empty} zero-byte image files")
    ok("all image files have a valid image header") if not not_image else fail(f"{not_image} files are not images (HTML error pages?)")
    img_pending = db.execute(f"SELECT COUNT(*) {live_rows} AND image_path IS NOT NULL AND image_path!='' "
                             "AND image_file IS NULL").fetchone()[0]
    if img_pending:
        warn(f"{img_pending} products have an imagePath but no downloaded file (404 on the image server, or not done)")

    on_disk = parts = 0
    total_bytes = 0
    top_dirs: Counter = Counter()
    root = os.path.join(images_dir, "images")
    for dirpath, _, files in os.walk(root):
        for fn in files:
            full = os.path.normpath(os.path.join(dirpath, fn))
            if fn.endswith(".part"):
                parts += 1
                continue
            on_disk += 1
            total_bytes += os.path.getsize(full)
            top_dirs[os.path.relpath(full, root).split(os.sep)[0]] += 1
    info(f"{on_disk} files under images/ ({total_bytes / 1e9:.2f} GB) in {len(top_dirs)} top-level folders")
    unref = on_disk - (len(referenced) - missing)
    if unref > 0:
        warn(f"{unref} files on disk not referenced by any product (harmless leftovers or shared images)")
    if parts:
        warn(f"{parts} leftover .part files (interrupted downloads; safe to delete)")
    prefixes = Counter((f or "").split("/")[1] if (f or "").count("/") >= 2 else "?" for (f,) in
                       db.execute(f"SELECT image_path {live_rows} AND image_path IS NOT NULL"))
    info("imagePath folders (top 10): " + ", ".join(f"{k}:{v}" for k, v in prefixes.most_common(10)))

    # ---- 6. optional: compare against the live API -------------------------
    if args.live:
        print(f"\n== Live spot-check ({args.live} random products, 1 req/s)")
        eans = [r[0] for r in db.execute(
            f"SELECT ean {live_rows} ORDER BY RANDOM() LIMIT ?", (args.live,))]
        same = changed = gone = err = 0
        for ean in eans:
            stored = json.loads(db.execute("SELECT raw_json FROM products WHERE ean=?", (ean,)).fetchone()[0] or "{}")
            try:
                req = urllib.request.Request(f"{API}/product/{ean}", headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    live = decode(r.read())
            except urllib.error.HTTPError as e:
                gone += e.code == 404
                err += e.code != 404
                time.sleep(1)
                continue
            except Exception as e:
                err += 1
                info(f"  {ean}: {e}")
                time.sleep(1)
                continue
            diffs = [k for k in ("name", "imagePath") if stored.get(k) != live.get(k)]
            if diffs:
                changed += 1
                info(f"  {ean} differs in {diffs}: {stored.get('name')!r} vs {live.get('name')!r}")
            else:
                same += 1
            time.sleep(1)
        info(f"same {same}, changed {changed}, now 404 {gone}, errors {err}")
        if same >= 0.9 * max(1, same + changed):
            ok("stored products match the live API (prices are expected to drift; name/imagePath compared)")
        else:
            warn("many stored products differ from the live API: check a few by hand")

    # ---- summary -----------------------------------------------------------
    n_fail = sum(1 for l, _ in results if l == "FAIL")
    n_warn = sum(1 for l, _ in results if l == "WARN")
    print(f"\n== Summary: {n_fail} failures, {n_warn} warnings")
    sys.exit(2 if n_fail else 1 if n_warn else 0)


if __name__ == "__main__":
    main()
