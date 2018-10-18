/**
 * Copyright 2018 Google Inc.
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


import {html, render} from '../node_modules/lit-html/lit-html.js';

const CI_HOST = location.origin.includes('localhost') ? location.origin :
    'https://webdev-dot-lighthouse-ci.appspot.com';

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
 * Calculates the average of a set of numbers.
 * @param {!Array<number>} numbers An array of numbers.
 * @return {number}
 */
function average(numbers) {
  return numbers.reduce((accum, val) => accum += val, 0) / numbers.length;
}

/**
 * Render Lighthouse scores.
 * 1. Setting the url attribute or property on the element fetches
 *    Lighthouse reports for the URL.
 * 2. The element fires the `lighthouse-scores` event when the data is ready.
 */
class LHScoresContainerElement extends HTMLElement {
  constructor() {
    super();

    /** @private {boolean} */
    this.hasSetupDom_ = false;

    /** @private {!Array<!Object>} */
    this.runs_ = [];

    /** @private {!Array<!Object>} */
    this.medians_ = [];
  }

  /**
   * @return {!Array<!Object>}
   * @export
   */
  get categories() {
    return [{
      id: 'performance',
      title: 'Performance',
    }, {
      id: 'pwa',
      title: 'PWA',
    }, {
      id: 'accessibility',
      title: 'Accessibility',
    }, {
      id: 'best-practices',
      title: 'Best Practices',
    }, {
      id: 'seo',
      title: 'SEO',
    }];
  }

  /**
   * @return {string}
   * @export
   */
  get url() {
    return this.getAttribute('url') || '';
  }

  /**
   * @param {string} val
   * @export
   */
  set url(val) {
    if (!val) {
      return;
    }
    this.setAttribute('url', val);
    this.fetchReports_(); // async
  }

  /**
   * @return {string}
   * @export
   */
  static getTagName() {
    return 'lh-scores-container';
  }

  /**
   * @export
   * @override
   */
  connectedCallback() {
    if (this.hasSetupDom_) {
      return;
    }
    this.hasSetupDom_ = true;
    this.fetchReports_(); // async
  }

  /**
   * Fetches latest LH reports for URL.
   * @private
   */
  async fetchReports_() {
    if (!this.url) {
      return;
    }

    const detail = {};

    try {
      this.runs_ = fetch(`${CI_HOST}/lh/reports?url=${this.url}`)
          .then((resp) => resp.json());
      this.medians_ = fetch(`${CI_HOST}/lh/medians?url=all`)
          .then((resp) => resp.json());
      this.update_();

      await Promise.all([this.runs_, this.medians_]);
      this.dispatchEvent(new CustomEvent('lighthouse-scores', {
        detail: {runs: this.runs_},
      }));
    } catch (err) {
      console.warn('Error fetching Lighthouse reports for URL.', err);
      this.dispatchEvent(new CustomEvent('lighthouse-scores', {
        detail: {errors: err.message},
      }));
    }
  }

  /**
   * @private
   */
  update_() {
    // if (!this.runs_.length) {
    //   console.warn('No LH runs fetched to render.');
    //   return;
    // }

    render(html``, this); // force lit to render entire DOM.

    const cards = this.categories.map((cat, i) => {
      // Get category's score for each run.
      const values = this.runs_.then((runs) => {
        return runs.map((run) => {
          const lhr = run.lhrSlim;
          if (!lhr) {
            console.warn(`No Lighthouse reports for ${this.url}`);
          }
          return lhr.find(item => item.id === cat.id).score * 100;
        });
      });

      const medianStat = values.then((vals) => Math.round(median(vals)));
      const averageStat = values.then((vals) => Math.round(average(vals)));

      return html`
        <div class="lh-score-card">
          <div class="lh-score-card__header">
            <span class="lh-score-card__title">${cat.title}</span>
            ${values.then((vals) => {
              const scoreAttr = vals.slice(-1)[0] / 100;
              return html`<gauge-element id="${cat.id}-score-gauge" score="${scoreAttr}"></gauge-element>`;
            })}
          </div>
          <div style="position:relative">
            ${values.then(vals => {
              return html`<spark-line id="${cat.id}-score-line" fill showlast .values="${vals}"></spark-line>`;
            })}
            ${this.medians_.then(medians => {
              const vals = [medians[cat.id], medians[cat.id]];
              return html`<spark-line .values="${vals}" dashed></spark-line>`;
            })}
          </div>
          <div class="lh-score__stats">
            Median: ${medianStat},
            Average: ${averageStat}
          </div>
        </div>`;
    });

    // const lastAuditTimestamp = new Date(this.runs_.slice(-1)[0].auditedOn);
    const lastAuditTimestamp = this.runs_.then((runs) => {
      return new Date(runs.slice(-1)[0].auditedOn).toLocaleString();
    });

    const tmpl = html`
      <div class="lh-score__lastaudit lh-score__label">
        <span>Last audited:</span><span>${lastAuditTimestamp}</span>
      </div>
      <div class="lh-score-cards">${cards}</div>
      <div class="lh-score-card__scorescale lh-score__label">
        <div class="lh-score-card__legend">
          <span><b>- - -</b></span>&nbsp;&nbsp;
          <span>Median for web.dev sites</span>
        </div>
        <div class="lh-score-card__legend">
          <span>Score scale:</span>
          <span class="lh-score-card__range lh-score--fail">0-49</span>
          <span class="lh-score-card__range lh-score--average">50-89</span>
          <span class="lh-score-card__range lh-score--pass">90-100</span>
        </div>
      </div>`;

    render(tmpl, this);
  }
}

customElements.define(LHScoresContainerElement.getTagName(), LHScoresContainerElement);

export {LHScoresContainerElement};
