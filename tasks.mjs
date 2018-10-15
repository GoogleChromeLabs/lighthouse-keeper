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

'use strict';

import fs from 'fs';
import cloudTasks from '@google-cloud/tasks';

const QUEUE = 'update-lighthouse-scores';
const LOCATION = 'us-central1';
const PROJECT_ID = JSON.parse(fs.readFileSync('./serviceAccount.json')).project_id;

async function createTask(url) {
  try {
    const client = new cloudTasks.CloudTasksClient();
    const response = await client.createTask({
      parent: client.queuePath(PROJECT_ID, LOCATION, QUEUE),
      task: {
        appEngineHttpRequest: {
          httpMethod: 'POST',
          relativeUri: `/lh/newaudit?url=${url}`,
          body: Buffer.from(JSON.stringify({url})).toString('base64'),
          // TODO: cannot post JSON. See https://github.com/googleapis/nodejs-tasks/issues/91
          // body: JSON.stringify({url}),
          // headers: {'Content-Type': 'application/json'},
        },
        // scheduleTime = {
        //   seconds: options.inSeconds + Date.now() / 1000,
        // },
      },
    });
    const task = response[0].name;
    return task;
  } catch (err) {
    console.error(`Error in createTask: ${err.message || err}`);
  }

  return null;
}

export {createTask};
