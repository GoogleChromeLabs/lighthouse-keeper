//const DevsiteCustomElement = goog.require('devsite.app.CustomElement');
//const lit = goog.require('lit-html');
//const {html, render} = lit;

import {html, render} from '../node_modules/lit-html/lit-html.js';

class WebProgressElement extends HTMLElement {
  constructor() {
    super();

    /** @private {!TemplateResult?} */
    this.template_ = html`
      <div class="web-progress-wrapper">
        <div class="web-progress-indeterminate"></div>
      </div>`;
  }

  /**
   * @return {string}
   * @export
   */
  static getTagName() {
    return 'web-progress';
  }

  /**
   * @export
   * @override
   */
  connectedCallback() {
    this.render();
  }

   /**
   * @export
   */
  render() {
    render(this.template_, this);
  }
}

customElements.define(WebProgressElement.getTagName(), WebProgressElement);

export {WebProgressElement};
