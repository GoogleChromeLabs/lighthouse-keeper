/**
 * Copyright 2018 Google Inc., PhantomJS Authors All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';

import firebaseAdmin from 'firebase-admin';
import fetch from 'node-fetch';

const PORT = process.env.PORT || 8080;
const LHR = JSON.parse(fs.readFileSync('./lhr.json', 'utf8'));

// Helpers
function slugify(url) {
  return url.replace(/\//g, '__');
}

function deslugify(id) {
  return id.replace(/__/g, '/');
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  console.error('errorHandler', err);
  res.status(500).send({errors: `${err}`});
}

/**
 * Saves Lighthouse report to Firestore.
 * @param {string} url URL to save run under.
 * @param {!Object} lhr Lighthouse report object.
 * @return {!Promise<!Object>}
 */
async function saveReport(url, lhr) {
  const today = new Date();
  const data = {
    lhr,
    auditedOn: today,
    lastAccessedOn: today,
  };

  await db.collection(slugify(url)).add(data);

  return data;
}

async function getAllSavedLightURLs() {
  const collections = await db.getCollections();
  const urls = collections.filter(c => c.id.startsWith('http'))
    .map(c => deslugify(c.id))
    .sort();
  return urls;
}


const app = express();

app.use(function forceSSL(req, res, next) {
  const fromCron = req.get('X-Appengine-Cron');
  if (!fromCron && req.hostname !== 'localhost' && req.get('X-Forwarded-Proto') === 'http') {
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  next();
});

app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'))

app.get('/lh/categories', (req, resp) => {
  const result = Object.values(LHR.categories).map(cat => {
    return {
      title: cat.title,
      id: cat.id,
      manualDescription: cat.manualDescription
    };
  });
  resp.send(result);
});

app.get('/lh/audits', (req, resp) => {
  const result = Object.values(LHR.audits).map(audit => {
    return {
      title: audit.title,
      id: audit.id,
      description: audit.description,
    };
  });
  resp.send(result);
});

app.get('/lh/urls', async (req, resp) => {
  resp.status(200).json(await getAllSavedLightURLs());
});

async function runLighthouse(url) {
  const builderUrl = 'https://builder-dot-lighthouse-ci.appspot.com/ci';
  const body = JSON.stringify({
    url,
    format: 'json',
    'X-API_KEY': 'webdev',
  });

  let json = {};
  try {
    const lhr = await fetch(builderUrl, {method: 'POST', body, headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': 'webdev',
    }}).then(resp => resp.json());

    // Trim down LH to only return category/scores.
    json = Object.values(lhr.categories).map(cat => {
      delete cat.auditRefs;
      return cat;
    });

    json = await saveReport(url, json);

  } catch (err) {
    console.error(`Error running Lighthouse: ${err}`);
  }

  return json;
}

app.post('/lh/newaudit', async (req, resp, next) => {
  const url = req.body.url;
  if (!url) {
    return resp.status(400).send('No url provided.');
  }
  const lhr = await runLighthouse(url);
  resp.status(201).json(lhr);

});

app.get('/lh/reports', async (req, resp, next) => {
  const url = req.query.url;
  if (!url) {
    return resp.status(400).send('No url provided.');
  }

  const querySnapshot = await db.collection(slugify(url))
      .orderBy('auditedOn').limit(10).get();

  const runs = [];
  if (querySnapshot.empty) {
    runs.push(await runLighthouse(url));
  } else {
    querySnapshot.forEach(doc => runs.push(doc.data()));
    // // TODO: check if there's any perf diff between this and former.
    // runs.push(...querySnapshot.docs.map(doc => doc.data()));
  }

  resp.status(200).json(runs);
});

app.get('/cron/update_lighthouse_scores', async (req, resp) => {
  if (!req.get('X-Appengine-Cron')) {
    // return res.status(403).send('Sorry, handler can only be run as a GAE cron job.');
  }

  const urls = await getAllSavedLightURLs();
  for (const url of urls) {

  }

  // TODO

  resp.status(200).json(urls);
});


app.use(errorHandler);

firebaseAdmin.initializeApp({
  // credential: firebaseAdmin.credential.applicationDefault(),
  credential: firebaseAdmin.credential.cert(
      JSON.parse(fs.readFileSync('./serviceAccount.json'))),
});

const db = firebaseAdmin.firestore();
db.settings({timestampsInSnapshots: true});

// const Firestore = require('@google-cloud/firestore');

// const firestore = new Firestore({
//   projectId: 'YOUR_PROJECT_ID',
//   keyFilename: '/path/to/keyfile.json',
// });

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`); /* eslint-disable-line */
  console.log('Press Ctrl+C to quit.'); /* eslint-disable-line */
});

