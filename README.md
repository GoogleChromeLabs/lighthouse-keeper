# web.dev data server

Server that handles the web.dev profile page bits:

- Runs Lighthouse against a URL and stores reports over time.
- Cron job that schedules tasks to update scores for each URL.

## Development

1. Install it:

```
npm i
```

2. Decrypt the service account json file:

```
npm run decrypt
```

You will be prompted to for a passphrase to decrypt `serviceAccount.json.enc`.
This file is required for the backend to communicate with Firestore.
The password can be found in Google's shared password tool.

3. Run the web server:

```
npm run start
````

4. Build it

To build the CSS/JS bundles, run:

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

Lists the latest `MAX_REPORTS` reports for the URL.

```
GET /lh/reports
```

Lists the URLs saved in the system:

```
GET /lh/urls
```

Starts a new Lighthouse audit for `url`.

```
POST /lh/newaudit
Content-Type: application/json

{"url": "https://example.com"}
```

Used by the cron job (see `cron.yaml`) to update Lighthouse scores for each
URL saved in the system. **Note**: this handler is only accessible to the App
Engine backend.

```
GET /cron/update_lighthouse_scores
```
