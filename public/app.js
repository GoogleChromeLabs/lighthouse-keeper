/* global firebase */

// Elements.
import './elements/gauge-element.js';
import './elements/sparkline-element.js';
// import './elements/lighthouse-score.js';
import './elements/lh-scores-container.js';
import './elements/web-progress.js';

// TODO: ditch lit-extended when migrating to lit 0.11.x
import {html, render} from '../node_modules/lit-html/lib/lit-extended.js';
import {repeat} from '../node_modules/lit-html/lib/repeat.js';

const urlEl = document.querySelector('#url');
const runLHButton = document.querySelector('#runlh');

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

/**
 * Pull historical LH data for an URL.
 * @param {string} url
 */
async function fetchLighthouseHistory(url) {
  toggleButtons();
  const runs = await fetch(`/lh/reports?url=${url}`).then(resp => resp.json());
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

  const urls = await fetch('/lh/urls').then(resp => resp.json());

  const tmpl = html`${
    repeat(urls, url => url, (url, i) => {
      // TODO: update to @click when migrating to lit 0.11.x
      return html`<tr><td><a href="${url}" on-click="${clickHandler}">${url}</a></td></tr>`;
    })
  }`;

  render(tmpl, document.querySelector('#savedurls'));
}

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
