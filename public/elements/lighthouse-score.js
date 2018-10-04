class LighthouseScore extends HTMLElement {
  static get is() { return 'lighthouse-score'; }

  static get observedAttributes() {
    return ['log'];
  }
  
  get url() {
    return this.getAttribute('url');
  }

  set url(val) {
    if (val) {
      this.setAttribute('url', val);
      this.urlChanged(val);
    } else {
      this.removeAttribute('url');
    }
  }
  
  get log() {
    return this._log;
  }

  set log(val) {
    this._log = val;
  }

  constructor() {
    super();
    this.log = false;
    this.url = this.getAttribute('url') || null;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'log': 
        this.log = this.hasAttribute('log');
        break;
    }
  }

  connectedCallback() {
    this.style.display = 'none';
  }

  disconnectedCallback() {

  }
  
  urlChanged() {
    if (this.url) {
      //this.textContent = `Fetching scores for ${this.url}...`;
      this.fetchScore(this.url).then(lhr => {
        this.dispatchEvent(new CustomEvent('report-ready', {detail: {lhr}}));
        //this.textContent = '';
      });
    }
  }

  async fetchScore(url) {
    let resolver;

    if (!url) {
      throw new Error('Cannot fetch score without a URL.');
    }
    
//     const lhr = JSON.parse(localStorage.getItem(url));
//     if (lhr) {
//       return lhr;
//     }
    
    const builderUrl = `https://builder-dot-lighthouse-ci.appspot.com/stream?url=${url}&format=json`;
    
    const source = new EventSource(builderUrl);

    source.addEventListener('message', async e => {
      const msg = e.data;
      
      if (this.log) {
        console.log(msg);
      }

      if (msg.startsWith('done')) {
        source.close();

        const reportUrl = msg.split(' ')[1];
        const lhr = await fetch(reportUrl).then(resp => resp.json());

        // TODO: invalidate cache after x minutes.
        // TODO: Do that on lighthouse-ci server too.
        // localStorage.setItem(lhr.requestedUrl, JSON.stringify(lhr)); // cache it.

        resolver(lhr);
      }
    });

    // source.addEventListener('open', e => {
    //   // ga('send', 'event', 'Lighthouse', 'start run');
    // });

    source.addEventListener('error', e => {
      if (e.readyState === EventSource.CLOSED) {
        source.close();
      }
    });
    
    return new Promise(r => {
      resolver = r;
    });
  }
}

window.customElements.define(LighthouseScore.is, LighthouseScore);

export default LighthouseScore;
