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
  // Trim down the LH results to only include category/scores.
  const lhrSlim = Object.values(lhr.categories).map(cat => {
    delete cat.auditRefs;
    return cat;
  });

  const collectionRef = db.collection(slugify(url));

  // Save space by deleting the full LH report saved in the last entry.
  const querySnapshot = await collectionRef
    .orderBy('auditedOn', 'desc').limit(1).get();
  await querySnapshot.docs[0].ref.update({
    lhr: Firestore.FieldValue.delete(),
  });

  const today = new Date();
  const data = {
    lhr,
    lhrSlim,
    auditedOn: today,
    // lastAccessedOn: today,
  };
  const doc = await collectionRef.add(data); // Add new report.

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

    json = await saveReport(url, lhr);
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
  const slugUrl = slugify(url);
  const querySnapshot = await db.collection(slugUrl)
      .orderBy('auditedOn', 'desc').limit(maxReports).get();

  const runs = [];

  if (querySnapshot.empty) {
    runs.push(await runLighthouse(url));
  } else {
    querySnapshot.forEach(doc => runs.push(doc.data()));
    runs.reverse(); // Order reports from oldest -> most recent.
    // // TODO: check if there's any perf diff between this and former.
    // runs.push(...querySnapshot.docs.map(doc => doc.data()));
  }

  // Update URLs last viewed timestamp.
  const doc = await db.doc(`meta/${slugUrl}`).set({lastViewed: new Date()});

  return runs;
}

const db = new Firestore({
  projectId: JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE)).project_id,
  keyFilename: SERVICE_ACCOUNT_FILE,
  timestampsInSnapshots: true,
});
