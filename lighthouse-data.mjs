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

import fs from 'fs';
import fetch from 'node-fetch';
import Firestore from '@google-cloud/firestore';

const SERVICE_ACCOUNT_FILE = './serviceAccount.json';

const CI_URL = 'https://builder-dot-lighthouse-ci.appspot.com/ci';
const CI_API_KEY = 'webdev';

const MAX_REPORTS = 10;

function slugify(url) {
  return url.replace(/\//g, '__');
}

function deslugify(id) {
  return id.replace(/__/g, '/');
}

/**
 * Saves Lighthouse report to Firestore.
 * @param {string} url URL to save run under.
 * @param {!Object} lhr Lighthouse report object.
 * @return {!Promise<!Object>}
 */
export async function saveReport(url, lhr) {
  const today = new Date();
  const data = {
    lhr,
    auditedOn: today,
    lastAccessedOn: today,
  };

  await db.collection(slugify(url)).add(data);

  return data;
}

/**
 * Audits a site using Lighthouse.
 * @param {string} url Url to audit.
 * @return {!Object} Report object saved to Firestore.
 */
export async function runLighthouse(url) {
  let json = {};

  try {
    const lhr = await fetch(CI_URL, {
      method: 'POST',
      body: JSON.stringify({url, format: 'json'}),
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CI_API_KEY,
      }
    }).then(resp => resp.json());

    // Trim down LH to only include category/scores.
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

export async function getAllSavedUrls() {
  const collections = await db.getCollections();
  const urls = collections.filter(c => c.id.startsWith('http'))
    .map(c => deslugify(c.id)).sort();
  return urls;
}

/**
 * Get saved reports for a given URL.
 * @param {string} url URL to fetch reports for.
 * @param {number=} maxReports Max number of reports to return. Defaults to
 *     MAX_REPORTS
 * @return {!Array<Object>} The reports.
 * @export
 */
export async function getReports(url, maxReports = MAX_REPORTS) {
  const querySnapshot = await db.collection(slugify(url))
      .orderBy('auditedOn', 'desc').limit(maxReports).get();

  const runs = [];

  if (querySnapshot.empty) {
    runs.push(await lighthouse.runLighthouse(url));
  } else {
    querySnapshot.forEach(doc => runs.push(doc.data()));
    runs.reverse(); // Order reports from oldest -> most recent.
    // // TODO: check if there's any perf diff between this and former.
    // runs.push(...querySnapshot.docs.map(doc => doc.data()));
  }

  return runs;
}

const db = new Firestore({
  projectId: JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE)).project_id,
  keyFilename: SERVICE_ACCOUNT_FILE,
  timestampsInSnapshots: true,
});
