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
import ReportGenerator from 'lighthouse/lighthouse-core/report/report-generator.js';
import Memcache from './memcache.mjs';

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
 * The "median" is the "middle" value in the list of numbers.
 * @param {!Array<number>} numbers An array of numbers.
 * @return {number} The calculated median value from the specified numbers.
 */
function median(numbers) {
  // median of [3, 5, 4, 4, 1, 1, 2, 3] = 3
  let median = 0
  numbers.sort();
  if (numbers.length % 2 === 0) {  // is even
    // average of two middle numbers
    median = (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) / 2;
  } else { // is odd
    // middle number only
    median = numbers[(numbers.length - 1) / 2];
  }
  return median;
}

/**
 * Saves Lighthouse report to Firestore.
 * @param {string} url URL to save run under.
 * @param {!Object} lhr Lighthouse report object.
 * @param {boolean} replace If true, replaces the last saved report with this
 *     new result. False, saves a new report.
 * @return {!Promise<!Object>}
 * @export
 */
export async function saveReport(url, lhr, replace) {
  delete lhr.i18n; // remove cruft we don't to store.

  // Trim down the LH results to only include category/scores.
  const categories = JSON.parse(JSON.stringify(lhr.categories)); // clone it.
  const lhrSlim = Object.values(categories).map(cat => {
    delete cat.auditRefs;
    return cat;
  });

  const today = new Date();
  const data = {
    lhr,
    lhrSlim,
    auditedOn: today,
  };

  const collectionRef = db.collection(slugify(url));
  const querySnapshot = await collectionRef
      .orderBy('auditedOn', 'desc').limit(1).get();

  const lastDoc = querySnapshot.docs[0];

  // New URL added to system. Delete cached list.
  if (!lastDoc) {
    await memcache.delete('getAllSavedUrls');
  }

  if (replace && lastDoc) {
    await lastDoc.ref.update(data); // Replace last entry with updated vals.
  } else {
    await collectionRef.add(data); // Add new report.
    if (lastDoc) {
      // Delete the full LH report from the last entry to save space over time.
      await lastDoc.ref.update({lhr: Firestore.FieldValue.delete()});
    }
  }

  await updateLastViewed(url);
  // Clear relevant caches.
  await Promise.all([
    memcache.delete(`getReports_${slugify(url)}`),
    memcache.delete('getMedianScoresOfAllUrls'),
  ]);

  return data;
}

/**
 * Audits a site using Lighthouse.
 * @param {string} url Url to audit.
 * @param {boolean=} replace If true, replaces the last saved report with this
 *     new result. False, saves a new report. Defaults to true.
 * @return {!Object} Report object saved to Firestore.
 * @export
 */
export async function runLighthouse(url, replace=true) {
  let json = {};

  try {
    const resp = await fetch(CI_URL, {
      method: 'POST',
      body: JSON.stringify({url, format: 'json'}),
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': CI_API_KEY,
      }
    });

    if (!resp.ok) {
      throw new Error(`(${resp.status}) ${resp.statusText}`);
    }

    const lhr = await resp.json();
    json = await saveReport(url, lhr, replace);
  } catch (err) {
    json.errors = `Error running Lighthouse - ${err}`;
  }

  return json;
}

/**
 * Returns all the URLs stored in the system.
 * @param {{useCache: boolean=}} Config object.
 * @return {!Promise<string>}
 * @export
 */
export async function getAllSavedUrls({useCache}={useCache: true}) {
  const val = await memcache.get('getAllSavedUrls');
  if (val && useCache) {
    return val;
  }

  const collections = await db.getCollections();
  const urls = collections.filter(c => c.id.startsWith('http'))
      .map(c => deslugify(c.id)).sort();

  await memcache.set('getAllSavedUrls', urls);

  return urls;
}

/**
 *  Updates the last viewed metadata for a URL.
 * @param {string} url
 * @return {!Promise}
 */
async function updateLastViewed(url) {
  return db.doc(`meta/${slugify(url)}`).set({lastViewed: new Date()});
}

/**
 * Returns all saved scores, per category.
 * @param {string} url
 * @param {number=} maxResults Max number of reports to return. Defaults to
 *     MAX_REPORTS.
 * @return {!Promise<!Object>}
 */
async function getAllScores(url, maxResults=MAX_REPORTS) {
  const querySnapshot = await db.collection(`${slugify(url)}`)
      .orderBy('auditedOn', 'desc').limit(maxResults).get();

  const runs = querySnapshot.docs;
  runs.reverse(); // Order reports from oldest -> most recent.

  const scores = {};
  runs.map(doc => {
    doc.get('lhrSlim').forEach(cat => {
      if (!scores[cat.id]) {
        scores[cat.id] = [];
      }
      scores[cat.id].push(cat.score * 100);
    });
  });

  return scores;
}

/**
 *  Updates the last viewed metadata for a URL.
 * @param {string} url
 * @param {number=} maxResults Max number of reports to return. Defaults to
 *     MAX_REPORTS.
 * @return {!Promise}
 * @export
 */
export async function getMedianScores(url, maxResults=MAX_REPORTS) {
  const scores = await getAllScores(url, maxResults);

  // Calculate medians
  const medians = {};
  Object.entries(scores).map(([cat, scores]) => {
    medians[cat] = median(scores);
  });

  return medians;
}

/**
 *  Updates the last viewed metadata for a URL.
 * @param {{maxResults: number=, useCache: boolean=}} Config object.
 * @return {!Promise<!Object>}
 * @export
 */
export async function getMedianScoresOfAllUrls(
    {maxResults, useCache}={maxResults: MAX_REPORTS, useCache: true}) {
  const val = await memcache.get('getMedianScoresOfAllUrls');
  if (val && useCache) {
    return val;
  }

  const combinedScores = {};

  const urls = await getAllSavedUrls();
  for (const url of urls) {
    const urlScores = await getAllScores(url, maxResults);
    Object.entries(urlScores).map(([cat, scores]) => {
      if (!combinedScores[cat]) {
        combinedScores[cat] = [];
      }
      combinedScores[cat].push(...scores);
    });
  }

  // Calculate medians
  const medians = {};
  Object.entries(combinedScores).map(([cat, scores]) => {
    medians[cat] = median(scores);
  });

  if (useCache) {
    await memcache.set('getMedianScoresOfAllUrls', medians);
  }

  return medians;
}

/**
 * Get saved reports for a given URL.
 * @param {string} url URL to fetch reports for.
 * @param {{maxResults: number=, useCache: boolean=}}
 *     Config object.
 * @param {boolean=} useCache If false, bypasses cache. Defaults to true.
 * @return {!Array<Object>|null} The reports.
 * @export
 */
export async function getReports(url,
    {maxResults, useCache}={maxResults: MAX_REPORTS, useCache: true}) {
  // TODO: This gets updated even if URL stored in system yet. But we want
  // to call this before results from cache are returned.
  await updateLastViewed(url); // "touch" last viewed timestamp for URL.

  const cacheKey = `getReports_${slugify(url)}`;
  const val = await memcache.get(cacheKey);
  if (val && useCache) {
    return val;
  }

  const querySnapshot = await db.collection(slugify(url))
      .orderBy('auditedOn', 'desc').limit(maxResults).get();

  let runs = [];

  if (querySnapshot.empty) {
    return runs;
  } else {
    querySnapshot.forEach(doc => runs.push(doc.data()));
    runs.reverse(); // Order reports from oldest -> most recent.
    // await updateLastViewed(url); // "touch" url's last viewed date.
  }

  runs = runs.map(r => {
    const ts = new Firestore.Timestamp(
        r.auditedOn._seconds, r.auditedOn._nanoseconds);
    r.auditedOn = ts.toDate();
    return r;
  });

  if (useCache) {
    await memcache.set(cacheKey, runs);
  }

  return runs;
}

/**
 * Generates a LH report in different formats.
 * @param {!Object} lhr Lighthouse report object.
 * @param {string} format How to format the report. One 'html', 'json', 'csv'.
 * @return {string} Report.
 * @export
 */
export function generateReport(lhr, format) {
  return ReportGenerator.generateReport(lhr, format);
}

const db = new Firestore({
  projectId: JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_FILE)).project_id,
  keyFilename: SERVICE_ACCOUNT_FILE,
  timestampsInSnapshots: true,
});

const memcache = new Memcache();
