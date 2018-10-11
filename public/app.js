/* global firebase */

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

// Elements.
import './elements/gauge-element.js';
import './elements/sparkline-element.js';
// import './elements/lighthouse-score.js';
import './elements/lh-scores-container.js';
import './elements/web-progress.js';

import {html, render} from '../node_modules/lit-html/lit-html.js';
import {repeat} from '../node_modules/lit-html/directives/repeat.js';

const urlEl = document.querySelector('#url');
const runLHButton = document.querySelector('#runlh');
const downloadReportButton = document.querySelector('#downloadreport');
const lhScoresContainer = document.querySelector('lh-scores-container');

function toggleButtons() {
  runLHButton.disabled = !runLHButton.disabled;
  urlEl.disabled = !urlEl.disabled;
}

/**
 * Pull historical LH data for an URL.
 * @param {string} url
 */
async function fetchLighthouseHistory(url) {
  toggleButtons();
  lhScoresContainer.url = url; // fetches + renders scores for the url.
  downloadReportButton.href = `/lh/html?url=${url}&download`;
  toggleButtons();
}

async function querySavedUrls() {
  const clickHandler = async (e) => {
    e.preventDefault();
    const url = e.target.href;
    urlEl.value = url;
    urlEl.dispatchEvent(new CustomEvent('change')); // Same code path url input's change handler.
  };

  const urls = await fetch('/lh/urls').then(resp => resp.json());

  const tmpl = html`${
    repeat(urls, url => url, (url, i) => {
      // TODO: update to @click when migrating to lit 0.11.x
      return html`<tr><td><a href="${url}" @click="${clickHandler}">${url}</a></td></tr>`;
    })
  }`;

  render(tmpl, document.querySelector('#savedurls'));
}

// downloadReportButton.addEventListener('click', async e => {
//   console.log('Fetchhing report...');
//   document.body.classList.add('lh-audit-running');
//   downloadReportButton.href = `/lh/report?url=${url}`;
//   document.body.classList.remove('lh-audit-running');
// });

runLHButton.addEventListener('click', async e => {
  const url = urlEl.value;

  console.log('Started running Lighthouse...');
  document.body.classList.add('lh-audit-running');
  toggleButtons();

  await fetch('/lh/newaudit', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url}),
  });

  console.log('Done.');
  document.body.classList.remove('lh-audit-running');
  toggleButtons();

  await fetchLighthouseHistory(url);
});

urlEl.addEventListener('change', async e => {
  const url = e.target.value;
  if (!url) {
    return;
  }
  await fetchLighthouseHistory(url);
});

querySavedUrls(); // async
urlEl.dispatchEvent(new CustomEvent('change')); // Same code path as url input's change handler. Invoke it.

// // Register element.
// import('./sparkline-element.min.js').then(({SparklineElement}) => {
//   customElements.define(SparklineElement.getTagName(), SparklineElement);
// });
