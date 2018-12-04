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

export function slugify(url) {
  return url.replace(/\//g, '__');
}

export function deslugify(id) {
  return id.replace(/__/g, '/');
}

/**
 * The "median" is the "middle" value in the list of numbers.
 * @param {!Array<number>} numbers An array of numbers.
 * @return {number} The calculated median value from the specified numbers.
 */
export function median(numbers) {
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
