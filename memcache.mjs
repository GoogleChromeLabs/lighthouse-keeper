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

import fs from 'fs';
import memjs from 'memjs';

const creds = JSON.parse(fs.readFileSync('./memcacheCredentials.json'));

const MEMCACHE_URL = creds.MEMCACHE_URL || '127.0.0.1:11211';
// if (process.env.USE_GAE_MEMCACHE) {
//   MEMCACHE_URL = `${process.env.GAE_MEMCACHE_HOST}:${process.env.GAE_MEMCACHE_PORT}`;
// }

class Memcache {
  constructor() {
    this.client = memjs.Client.create(MEMCACHE_URL, {
      username: creds.MEMCACHE_USERNAME,
      password: creds.MEMCACHE_PASSWORD,
    });
  }
  async get(key) {
    const val = (await this.client.get(key)).value;
    if (val) {
      return JSON.parse(val.toString('utf-8'));
    }
    return null;
  }
  async set(key, val, expires=600) {
    try {
      return await this.client.set(key, JSON.stringify(val), {expires});
    } catch (err) {
      console.warn(`Could not save value under "${key}" in memcache.`, err);
    }
    return false;
  }
  async delete(key) {
    try {
      return await this.client.delete(key);
    } catch (err) {
      console.warn(`Could not delete "${key}" from memcache.`, err);
    }
    return false;
  }
}

export default Memcache;
