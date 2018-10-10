import {html, render} from '../node_modules/lit-html/lit-html.js';

const CI_HOST = 'https://webdev-dot-lighthouse-ci.appspot.com';

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
      this.runs_ = await fetch(`${CI_HOST}/lh/reports?url=${this.url}`)
        .then((resp) => resp.json());
      detail.runs = this.runs_;
      this.update_();
    } catch (err) {
      console.warn('Error fetching Lighthouse reports for URL.', err);
      detail.errors = err.message;
      this.runs_ = [];
    }

    this.dispatchEvent(new CustomEvent('lighthouse-scores', {detail}));
  }

  /**
   * @private
   */
  update_() {
    if (!this.runs_.length) {
      console.warn('No LH runs fetched to render.');
      return;
    }

    render(html``, this); // force lit to render entire DOM.

    const tmpls = this.categories.map((cat, i) => {
      // Get category's score for each run.
      const values = this.runs_.map((run) => {
        const lhr = run.lhrSlim || run.lhr;
        if (!lhr) {
          console.warn(`No Lighthouse reports for ${this.url}`);
        }
        return lhr.find(item => item.id === cat.id).score * 100;
      });

      const scoreAttr = values.slice(-1)[0] / 100; // Display latest score.

      return html`
        <div class="lh-score-card">
          <div class="lh-score-card__header">
            <span class="lh-score-card__title">${cat.title}</span>
            <gauge-element id="${cat.id}-score-gauge" score="${scoreAttr}"></gauge-element>
          </div>
          <spark-line id="${cat.id}-score-line" fill showfirst showlast .values="${values}"></spark-line>
        </div>`;
    });
    render(html`${tmpls}`, this);
  }
}

customElements.define(LHScoresContainerElement.getTagName(), LHScoresContainerElement);

export {LHScoresContainerElement};
