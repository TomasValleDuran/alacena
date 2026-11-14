# import-barcodes

Bulk-adds barcodes to the product catalog. For each barcode in a CSV it calls the API's resolve endpoint, which looks the product up (pricely.ar first, Open Food Facts as fallback) and caches any new product in the `products` table.

It only touches the catalog. It never changes stock.

Plain Node (18+), no dependencies.

## Usage

```bash
node tools/import-barcodes/import-barcodes.mjs <barcodes.csv> [--delay=MS]
```

From the repo root there is also an npm script:

```bash
npm run import:barcodes -- <barcodes.csv>
```

Options:

- `--delay=MS` (or `--delay MS`): pause between requests in milliseconds. Default `250`. A negative or non-numeric value is ignored with a warning.
- `-h`, `--help`: print the usage text and exit.

A relative CSV path is resolved from the current working directory.

## CSV format

- Barcodes are read from the first column.
- A `barcode` header row, blank lines and lines starting with `#` are ignored.
- Extra columns are ignored.
- Surrounding quotes are stripped.
- Values that are not 6 to 14 digits are skipped with a warning.
- Duplicates are resolved once.

See `barcodes.example.csv` for an example.

## Environment

- `API_URL`: base URL of the API. Default `http://localhost:3001`. A trailing slash is removed.

## What it does

For each barcode, in order, it sends `POST <API_URL>/api/products/resolve` with a JSON body `{ "barcode": "..." }`. Each result is printed as one of:

- `ok` with the product name, counted as resolved (added or cached)
- `not found` (HTTP 404), collected in a list at the end
- `error` with the server's error message or status code
- `request failed` for network errors

The run ends with a summary of resolved and not-found counts. Not-found barcodes are listed so they can be added by hand in the app.
