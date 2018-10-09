import {html, render} from '../node_modules/lit-html/lit-html.js';
// import {repeat} from '../node_modules/lit-html/lib/repeat.js';

class LHScoresContainerElement extends HTMLElement {
  constructor() {
    super();

    /** @private {!Array<!Object>} */
    this.runs_ = [];
    /** @private {string} */
    this.url_;
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
      title: 'SEO'
    }];
  }

  /**
   * @return {string}
   * @export
   */
  get url() {
    return this.url_;
  }

  /**
   * @param {string} val
   * @export
   */
  set url(val) {
    this.url_ = val;
    if (this.url_) {
      this.fetchReports_(); // async
    }
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
    this.url = this.getAttribute('url');
  }

  /**
   * Fetches latest LH reports for URL.
   * @private
   */
  async fetchReports_() {
    if (!this.url) {
      throw Error('No url set to fetch reports for.');
    }
    this.runs_ = await fetch(`/lh/reports?url=${this.url}`)
        .then(resp => resp.json());
    this.update_();
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
      const values = this.runs_.map(run => {
        const lhr = run.lhrSlim || run.lhr;
        return lhr.find(item => item.id === cat.id).score * 100;
      });

      const scoreAttr = values.slice(-1)[0] / 100; // Display latest score.
      const valAttr = JSON.stringify(values);

      return html`
        <div class="lh-score-card">
          <div class="lh-score-card__header">
            <span class="lh-score-card__title">${cat.title}</span>
            <gauge-element id="${cat.id}-score-gauge" score="${scoreAttr}"></gauge-element>
          </div>
          <spark-line id="${cat.id}-score-line" fill showlast values="${valAttr}"></spark-line>
        </div>`;
    });
    render(html`${tmpls}`, this);
  }
}

customElements.define(LHScoresContainerElement.getTagName(), LHScoresContainerElement);

export {LHScoresContainerElement};
