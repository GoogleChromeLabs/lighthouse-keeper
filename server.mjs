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

'use strict';

import fs from 'fs';
import express from 'express';
import bodyParser from 'body-parser';
import * as tasks from './tasks.mjs';
import Firestore from '@google-cloud/firestore';
import * as lighthouse from './lighthouse-data.mjs';
import * as utils from './public/utils.mjs';

import fileNamer from 'lighthouse/lighthouse-core/lib/file-namer.js';

const PORT = process.env.PORT || 8080;
const LHR = JSON.parse(fs.readFileSync('./lhr.json', 'utf8'));
const serviceAccountJSON = JSON.parse(fs.readFileSync('./serviceAccount.json'));
const STALE_DATA_THRESHOLD = 60; // Num days after data is considered stale.
const USE_LH_CI = false;

const app = express();

/**
 * Middleware to require admin access.
 * @param {!Object} req
 * @param {!Object} resp
 * @param {!Function} next
 */
function requireAdminUser(req, resp, next) {
  const key = req.get('X-SECRET-KEY');
  if (key !== serviceAccountJSON.ADMIN_SECRET_KEY) {
    return resp.status(403).send(
      'Sorry, handler can only be run by admin user.');
  }
  next();
}

/**
 * Middleware to require request comes from task queue.
 * @param {!Object} req
 * @param {!Object} resp
 * @param {!Function} next
 */
function requireFromTaskQueue(req, resp, next) {
  const fromTaskQueue = req.get('X-AppEngine-QueueName');
  if (!fromTaskQueue) {
    return resp.status(403).send(
        'Sorry, handler can only be run from task queue.');
  }
  next();
}

/**
 * Middleware to require request comes from cron system.
 * @param {!Object} req
 * @param {!Object} resp
 * @param {!Function} next
 */
function requireFromCron(req, resp, next) {
  if (!req.get('X-Appengine-Cron')) {
    return resp.status(403).send(
        'Sorry, handler can only be run as a GAE cron job.');
  }
  next();
}

/**
 * Middleware to grab the URL from request.
 * @param {!Object} req
 * @param {!Object} resp
 * @param {!Function} next
 */
function requireUrlQueryParam(req, resp, next) {
  let url = req.body.url || req.query.url;
  if (!url) {
    try {
      url = JSON.parse(req.body.toString('utf8'));
    } catch (err) {
      // noop
    }
  }

  if (!url) {
    resp.status(400).json({errors: 'No url provided.'});
    return;
  }

  resp.locals.url = url;

  next();
}

// app.use(function forceSSL(req, resp, next) {
//   const fromCron = req.get('X-Appengine-Cron');
//   const fromTaskQueue = req.get('X-AppEngine-QueueName');
//   if (!(fromCron || fromTaskQueue) && req.hostname !== 'localhost' &&
//       req.get('X-Forwarded-Proto') === 'http') {
//     return resp.redirect(`https://${req.hostname}${req.url}`);
//   }
//   next();
// });
app.get('/', (req, resp) => {
  resp.redirect(301, 'https://web.dev/measure');
});

app.use(bodyParser.raw());
app.use(bodyParser.json());
// app.use(bodyParser.text());
app.use(express.static('public', {extensions: ['html', 'htm']}));
app.use('/node_modules', express.static('node_modules'));

app.use('/cron/remove_invalid_urls', requireFromCron);
app.get('/cron/remove_invalid_urls', async (req, resp) => {
  tasks.createRemoveInvalidUrlsTask().catch(err => console.error(err));
  resp.status(201).send('Scheduled remove_invalid_urls task');
});

// app.use('/cron/update_lighthouse_scores', requireFromCron);
// app.get('/cron/update_lighthouse_scores', async (req, resp) => {
//   // Schedule async tasks to fetch a new LH report for each URL.
//   const urls = await lighthouse.getSavedUrls();
//   for (const url of urls) {
//     tasks.createRunLighthouseTask(url).catch(err => console.error(err));
//   }

//   resp.status(201).send('Update tasks scheduled');
// });

app.use('/cron/delete_stale_lighthouse_reports', requireFromCron);
app.get('/cron/delete_stale_lighthouse_reports', async (req, resp) => {
  const dateOffset = (24 * 60 * 60 * 1000) * STALE_DATA_THRESHOLD; // In ms
  const cutoffDate = new Date();
  cutoffDate.setTime(cutoffDate.getTime() - dateOffset);

  const urls = await lighthouse.getUrlsLastViewedBefore(cutoffDate);

  await Promise.all(urls.map(url => lighthouse.removeUrl(url)));

  resp.status(200).send('Stale LH runs removed');
});

// app.use('/cron/update_median_scores', requireFromCron);
// app.get('/cron/update_median_scores', async (req, resp) => {
//   if (!req.get('X-Appengine-Cron')) {
//     return resp.status(403).send(
//         'Sorry, handler can only be run as a GAE cron job.');
//   }
//   const medians = await lighthouse.updateMedianScoresOfAllUrls();
//   resp.status(200).send(`Median scores updated. ${JSON.stringify(medians)}`);
// });

app.use('/cron/update_saved_url_count', requireFromCron);
app.get('/cron/update_saved_url_count', async (req, resp) => {
  const allUrls = [];
  lighthouse.getSavedUrls(async ({urls, complete}) => {
    allUrls.push(...urls);

    if (complete) {
      resp.status(200).send(`${allUrls.length} urls in system`);
      await lighthouse.incrementCounter('urls', allUrls.length);

      // Also dump list to backup.
      const stream = fs.createWriteStream('./allurls.txt', {flags: 'w'});
      allUrls.map(item => stream.write(`${item.url}\n`));
      stream.end();

      return;
    }
  }, {batchSize: 5000});
});

app.use('/task/remove_invalid_urls', requireFromTaskQueue);
app.post('/task/remove_invalid_urls', async (req, resp, next) => {
  const {numUrls, numRemoved} = await lighthouse.removeNextSetOfInvalidUrls(500);
  resp.status(200).send(`Validated ${numUrls} urls. Removed ${numRemoved}.`);
});

// Enable cors on all other handlers.
app.use(function enableCors(req, resp, next) {
  resp.set('Access-Control-Allow-Origin', '*');
  resp.set('Access-Control-Allow-Headers', 'Content-Type');
  resp.set('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');

  if (req.method === 'OPTIONS') {
    resp.send(200);
    return;
  }

  next();
});

app.get('/lh/categories', (req, resp) => {
  const result = Object.values(LHR.categories).map(cat => {
    return {
      title: cat.title,
      id: cat.id,
      manualDescription: cat.manualDescription,
    };
  });
  resp.send(result);
});

app.get('/lh/audits', (req, resp) => {
  const result = Object.values(LHR.audits).map(audit => {
    return {
      title: audit.title,
      id: audit.id,
      description: audit.description,
    };
  });
  resp.send(result);
});

app.get('/lh/urls', async (req, resp) => {
  resp.status(200).json({count: await lighthouse.getCount('urls')});
});

app.use('/lh/html', requireUrlQueryParam);
app.get('/lh/html', async (req, resp, next) => {
  const url = resp.locals.url;

  const lhr = await lighthouse.getFullReport(url);
  if (!lhr) {
    return resp.status(404).json({errors: `No results found for "${url}".`});
  }

  if ('download' in req.query) {
    const filename = `${fileNamer.getFilenamePrefix(lhr)}.html`;
    resp.set('Content-Disposition', `attachment; filename=${filename}`);
  }

  // Send down LHR html report as response.
  resp.status(200).send(lighthouse.generateReport(lhr, 'html'));
});

app.use('/lh/reports', requireUrlQueryParam);
app.get('/lh/reports', async (req, resp, next) => {
  const url = resp.locals.url;
  const sinceDate = req.query.since;

  let reports = [];
  if (!sinceDate) {
    // If no start date provided, only return last item.
    reports = await lighthouse.getReports(url, {maxResults: 1});
    reports = reports.slice(0, 1);
  } else {
    reports = await lighthouse.getReports(url);
    // Filter results from before start date. Over-compensate by 1 hr to make
    // sure results are returned in audit time and timestamp are close.
    let date = Number(sinceDate - (60 * 1000));
    if (Number.isNaN(date)) {
      date = sinceDate;
    }
    reports = reports.filter(report => {
      return new Date(report.auditedOn) >= new Date(date);
    });
  }

  if (!reports.length) {
    resp.status(404).json({errors: `No results found for "${url}".`});
    return;
  }

  return resp.status(200).json(reports);
});

app.use('/lh/medians', requireUrlQueryParam);
app.get('/lh/medians', async (req, resp, next) => {
  const url = resp.locals.url;
  const medians = url === 'all' ? await lighthouse.getMedianScoresOfAllUrls() :
      await lighthouse.getMedianScores(url);
  resp.status(200).json(medians);
});

app.use('/lh/newaudit', requireUrlQueryParam);
app.post('/lh/newaudit', async (req, resp, next) => {
  const url = resp.locals.url;
  // Replace results when user is running a new audit. Cron adds new entries.
  // const replace = !req.get('X-AppEngine-QueueName');
  // const requestsSave = 'save' in req.body ? Boolean(req.body.save) : false;
  // const saveReport = req.get('X-AppEngine-QueueName') || requestsSave;

  let json = {};
  if (USE_LH_CI) {
    json = await lighthouse.runLighthouseCI(url);//, replace);
  } else {
    json = await lighthouse.runLighthouseAPI(url);//, replace);
  }
  if (json.errors) {
    let statusCode = 400;
    // API will always return 500s if something went wrong, attempt to resurface
    // status code LH returned instead.
    const match = json.errors.match(/Status code: (\d{3})/i);
    if (match) {
      statusCode = match[1];
    }
    return resp.status(statusCode).json(json);
  }
  resp.status(201).json(json);
});

// app.use('/lh/interest', requireUrlQueryParam);
// app.post('/lh/interest', async (req, resp, next) => {
//   const newUrl = resp.locals.url;
//   const oldUrl = req.body.oldUrl || null;

//   // Only adjust counts if new url is diff than old one.
//   if (oldUrl === null || newUrl === oldUrl) {
//     return;
//   }

//   const [urlInterest, oldUrlInterest] = await Promise.all(
//     lighthouse.incrementInterestCount(newUrl),
//     lighthouse.decrementInterestCount(oldUrl),
//   );

//   // If no users are left watching the url, remove it.
//   if (oldUrlInterest < 1) {
//     await Promise.all([
//       lighthouse.deleteReports(oldUrl),
//       lighthouse.deleteMetadata(oldUrl),
//     ]);
//   }

//   resp.status(200).send('Interest counts updated.');
// });

app.use('/lh/remove', requireUrlQueryParam);
app.use('/lh/remove', requireAdminUser);
app.post('/lh/remove', async (req, resp, next) => {
  const url = resp.locals.url;
  await lighthouse.removeUrl(url);
  resp.status(200).send(`Reports for ${url} removed`);
});

app.use(function errorHandler(err, req, resp, next) {
  if (resp.headersSent) {
    return next(err);
  }
  console.error('errorHandler', err);
  resp.status(500).send({errors: `${err}`});
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`); /* eslint-disable-line */
  console.log('Press Ctrl+C to quit.'); /* eslint-disable-line */
});
