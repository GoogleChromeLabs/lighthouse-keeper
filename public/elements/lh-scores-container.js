import {html, render} from '../node_modules/lit-html/lit-html.js';
import {repeat} from '../node_modules/lit-html/directives/repeat.js';

class LHScoresContainerElement extends HTMLElement {
  constructor() {
    super();
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
  static getTagName() {
    return 'lh-scores-container';
  }

  /**
   * @export
   * @override
   */
  connectedCallback() {
    // fetch('/lhcategories').then(resp => resp.json()).then(categories => {
    //   this.categories_ = categories;
    //   this.update_();
    // });
    this.update_();
  }

  /**
   * @private
   */
  update_() {
    const tmpl = html`${
      repeat(this.categories, cat => cat, (cat, i) => {
        return html`
          <div class="lh-score-card">
            <div class="lh-score-card__header">
              <span class="lh-score-card__title">${cat.title}</span>
              <gauge-element id="${cat.id}-score-gauge" score="0"></gauge-element>
            </div>
            <spark-line id="${cat.id}-score-line" fill showlast></spark-line>
          </div>`;
      })
    }`;
    render(tmpl, this);
  }
}

customElements.define(LHScoresContainerElement.getTagName(), LHScoresContainerElement);

export {LHScoresContainerElement};
