# Lighthouse Keeper

> Lighthouse keeper is a backend for providing historical [Lighthouse](https://developers.google.com/web/tools/lighthouse/) results for an URL.

There are several bits:

- Runs the Lighthouse API against a URL and stores reports over time (Firestore). Provides querying capabilities.
- The latest (full) report for the URL is stored (Google Cloud Storage).
- The server itself is Google App Engine (NodeJS). Cron jobs schedule tasks to update scores for each URL in the system, calculate median scores for each category, etc.

<img width="1081" alt="Example web.dev frontend rendering data from this server" src="https://user-images.githubusercontent.com/238208/47517054-e2877b80-d83b-11e8-97d1-b2becc282604.png">

## Development

1. Install it:

```
npm i
```

2. Decrypt the service account and memcache JSON files:

```
npm run decrypt
```

You will be prompted to for a passphrase to decrypt `serviceAccount.json.enc`
and `memcacheCredentials.json.enc`. These files are required for the backend
to communicate with Firestore and the Redis memcache service. The password can
be found in Google's shared password tool.

3. Run the web server:

```
npm run start
````

4. Build it

To build the CSS/JS bundles, run of `npm run build:js`, `npm run build:css`,
or the single command:

```
npm run build
```

There are also watch tasks if you want to iterate on the files while the server
is running:

```
npm run watch:css
npm run watch:js
```

## API

### Metadata handlers

Lists the Lighthouse categories:

```
GET /lh/categories
```

Lists the Lighthouse audits:

```
GET /lh/audits
```

### Lighthouse data handlers:

Lists the latest `MAX_REPORTS` reports for the URL. If the `?since=YYYY-MM-DD` query
parameter is used, the results will be filtered to on or after that date.

```
GET /lh/reports?url=https://example.com/
GET /lh/reports?url=https://example.com/&since=2018-10-25
```

Lists the number of URLs that have been saved in the system.

```
GET /lh/urls

{count: 123456789}
```

Displays the latest Lighthouse HTML report for `url`. If the `download` param
is included, the file is downloaded.

```
GET /lh/html?url=https://example.com
GET /lh/html?url=https://example.com&download
```

Starts a new Lighthouse audit for `url`.

```
POST /lh/newaudit
Content-Type: application/json

{"url": "https://example.com"}
```

Lists the median scores (for each Lighthouse category) of all the URLs in the system,
or just for a particular URL.

```
GET /lh/medians[?url=https://example.com/]
```

### Private handlers

Seeds the db with the list of URLs in `seeds_urls.json` by scheduling a task
to run a Lighthouse audit on each URL. **Note**: this handler can only run
if there are no URLs already stored. It should be run if the db is ever cleared.

```
GET /lh/seed_urls
```

Used by the cron job (see `cron.yaml`) to update Lighthouse scores for each
URL saved in the system. **Note**: this handler is only accessible to the App
Engine backend.

```
GET /cron/update_lighthouse_scores
```

Used by the cron job (see `cron.yaml`) to delete existing results if the URL hasn't been
viewed/audited or otherwise "touched" in the last 60 days. **Note**: this handler is only accessible to the App
Engine backend.

```
GET /cron/delete_stale_lighthouse_reports
```
