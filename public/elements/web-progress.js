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
