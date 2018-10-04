/* global firebase */

// Elements.
import './elements/gauge-element.js';
import './elements/sparkline-element.js';
import './elements/lighthouse-score.js';
import './elements/lh-scores-container.js';

// import {html, render} from '/lit-html/lit-html.js';
import {html, render} from '../node_modules/lit-html/lit-html.js';
import {repeat} from '../node_modules/lit-html/directives/repeat.js';
// import {repeat} from '../node_modules/lit-html/directives/repeat.js';

let db;
const urlEl = document.querySelector('#url');
const runLHButton = document.querySelector('#runlh');
const lhScoreEl = document.querySelector('lighthouse-score');

function initFirebase() {
  firebase.initializeApp({
    apiKey: "AIzaSyA-TJ8GxwFU5P0Jd2ukVi9W2E1_bVrOfjk",
    authDomain: "lighthouse-ci.firebaseapp.com",
    projectId: "lighthouse-ci",
  });

  db = firebase.firestore();
  db.settings({timestampsInSnapshots: true});

  // firebase.firestore().enablePersistence().catch(err => {
  //   if (err.code == 'failed-precondition') {
  //     // Multiple tabs open, persistence can only be enabled
  //     // in one tab at a a time.
  //     // ...
  //   } else if (err.code == 'unimplemented') {
  //     // The current browser does not support all of the
  //     // features required to enable persistence
  //     // ...
  //   }
  // });
}

function slugify(url) {
  return url.replace(/\//g, '__');
}

function deslugify(id) {
  return id.replace(/__/g, '/');
}

function renderScoresForCategory(runs, category) {
  const line = document.querySelector(`#${category}-score-line`);
  line.values = runs.map(run => {
    return run.lhr.find(item => item.id === category).score * 100;
  });
  line.update();

  const gauge = document.querySelector(`#${category}-score-gauge`);
  if (gauge && line.values.length) {
    gauge.score = line.values.slice(-1)[0] / 100; // gauge display lastest score.
  }
}

function renderScores(runs) {
  renderScoresForCategory(runs, 'pwa');
  renderScoresForCategory(runs, 'performance');
  renderScoresForCategory(runs, 'accessibility');
  renderScoresForCategory(runs, 'seo');
  renderScoresForCategory(runs, 'best-practices');
}


function toggleButtons() {
  runLHButton.disabled = !runLHButton.disabled;
  urlEl.disabled = !urlEl.disabled;
}

async function runLighthouse(url) {
  lhScoreEl.url = url; // kicks off new run.

  document.body.classList.add('lh-audit-running');

  const lhr = await waitForLighthouseReport();

  document.body.classList.remove('lh-audit-running');

  // TODO: don't save new report if url already has an entry for today.
  // TODO: remove reports after 60 days if they haven't been
  // resubmitted (e.g. .lastAccessedOn hasn't changed in 60 days).
  return await saveReport(url, lhr);
}

/**
 * Waits for lighthouse-score element to fire it's report-ready,
 * signifying a new report.
 * @return {!Promise<!Object>} Slimmed down LH result object.
 */
async function waitForLighthouseReport() {
  return new Promise(resolve => {
    // Listen for new reports.
    lhScoreEl.addEventListener('report-ready', function callback(e) {
      lhScoreEl.removeEventListener('report-ready', callback);

      // Trim down LH to only return category/scores.
      const lhr = Object.values(e.detail.lhr.categories).map(cat => {
        delete cat.auditRefs;
        return cat;
      });
      resolve(lhr);
    });
  });
}

/**
 * Saves Lighthouse report to Firestore.
 * @param {string} url URL to save run under.
 * @param {!Object} lhr Lighthouse report
 * @return {!Promise<!Object>}
 */
async function saveReport(url, lhr) {
  const data = {
    lhr,
    auditedOn: new Date(),
    lastAccessedOn: new Date(),
  };

  db.collection(slugify(url)).add(data);

  // Add url to metadata list.
  const doc = await db.doc('meta/urls').get();
  if (doc.exists) {
    doc.ref.update({
      urls: firebase.firestore.FieldValue.arrayUnion(url),
    });
    // TODO: remove urls when it's appropriate.
    // doc.ref.update({
    //   urls: firebase.firestore.FieldValue.arrayRemove(url),
    // });
  } else {
    doc.ref.set({urls: [url]});
  }

  return data;
}

/**
 * Pull historical LH data for an URL from Firestore.
 * @param {string} url
 */
async function fetchLighthouseHistory(url) {
  toggleButtons();

  const querySnapshot = await db.collection(slugify(url))
      .orderBy('auditedOn').limit(10).get();
  const runs = [];
  if (querySnapshot.empty) {
    runs.push(await runLighthouse(url));
  } else {
    querySnapshot.forEach(doc => runs.push(doc.data()));
    // TODO: check if there's any perf diff between this and former.
    // runs.push(...querySnapshot.docs.map(doc => doc.data()));
  }

  renderScores(runs);

  toggleButtons();
}

async function querySavedUrls() {
  const clickHandler = async (e) => {
    e.preventDefault();
    const url = e.target.href;
    urlEl.value = url;
    urlEl.dispatchEvent(new CustomEvent('change')); // Same code path url input's change handler.
  };

  const querySnapshot = await db.collection('meta').doc('urls').get();
  const urls = querySnapshot.data().urls;

  const tmpl = html`${
    repeat(urls, url => url, (url, i) => {
      return html`<tr><td><a href="${url}" @click=${clickHandler}>${url}</a></td></tr>`;
    })
  }`;

  render(tmpl, document.querySelector('#savedurls'));
}

runLHButton.addEventListener('click', async e => {
  const url = urlEl.value;
  toggleButtons();
  const data = await runLighthouse(url);
  await fetchLighthouseHistory(url);
  toggleButtons();
});

urlEl.addEventListener('change', e => {
  const url = e.target.value;
  if (!url) {
    return;
  }
  fetchLighthouseHistory(url); // async
});

initFirebase();
querySavedUrls(); // async
urlEl.dispatchEvent(new CustomEvent('change')); // Same code path as url input's change handler. Invoke it.


// // Register element.
// import('./sparkline-element.min.js').then(({SparklineElement}) => {
//   customElements.define(SparklineElement.getTagName(), SparklineElement);
// });
