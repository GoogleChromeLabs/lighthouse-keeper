# web.dev data server

Server that handles the web.dev profile page bits:

- Runs Lighthouse against a URL and stores reports over time.
- Cron job that schedules tasks to update scores for each URL.
- A demo page and set of example web components that interact with the backend in `public/`.

<img width="1081" alt="screen shot 2018-10-11 at 9 09 35 am" src="https://user-images.githubusercontent.com/238208/46818166-679b6c80-cd35-11e8-8989-d5b1f50abd99.png">

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

Lists the latest `MAX_REPORTS` reports for the URL.

```
GET /lh/reports
```

Lists the URLs that have been saved in the system.

```
GET /lh/urls
```

Displays the latest Lighthouse HTML report for `url`. If the `download` param
is included, the file is downloaded.

```
GET /lh/html?url="https://example.com"
GET /lh/html?url=https://example.com&download
```

Starts a new Lighthouse audit for `url`.

```
POST /lh/newaudit
Content-Type: application/json

{"url": "https://example.com"}
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
