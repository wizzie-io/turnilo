/*
 * Copyright 2015-2016 Imply Data, Inc.
 * Copyright 2017-2018 Allegro.pl
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

import { day, hour, minute } from "chronoshift";
import { List } from "immutable";
import { STRINGS } from "../../../client/config/constants";
import {
  findBiggerClosestToIdeal,
  findExactIndex,
  findFirstBiggerIndex,
  findMaxValueIndex,
  findMinValueIndex,
  getNumberOfWholeDigits,
  isDecimalInteger,
  toSignificantDigits
} from "../../../common/utils/general/general";
import { Unary } from "../../utils/functional/functional";
import { isFloorableDuration, isValidDuration } from "../../utils/plywood/duration";
import { Bucket, NumberBucket, TimeBucket } from "./bucket";

const MENU_LENGTH = 5;

export type GranularityJS = string | number;
export type ContinuousDimensionKind = "time" | "number";

interface Range<T> {
  start: T;
  end: T;
}

type BucketableRange<T extends Bucket> = T extends NumberBucket ? Range<number> : Range<Date>;

type DimensionKind<T extends Bucket> = T extends TimeBucket ? "time" : "number";

export function validateGranularity(kind: string, granularity: string): string {
  if (kind === "time") {
    if (!isValidDuration(granularity)) {
      return STRINGS.invalidDurationFormat;
    }
    if (!isFloorableDuration(granularity)) {
      return STRINGS.notFloorableDuration;
    }
  }
  if (kind === "number" && !isDecimalInteger(granularity)) {
    return STRINGS.invalidNumberFormat;
  }
  return null;
}

export function isGranularityValid(kind: string, granularity: string): boolean {
  return validateGranularity(kind, granularity) === null;
}

export interface Checker<T> {
  checkPoint: number;
  returnValue: T;
}

function makeCheckpoint<T extends Bucket>(checkPoint: number, returnValue: T): Checker<T> {
  return { checkPoint, returnValue };
}

function makeNumberBuckets(centerAround: number, count: number, coarse?: boolean): List<NumberBucket> {
  let granularities: number[] = [];
  let logTen = Math.log(centerAround) / Math.LN10;
  const digits = getNumberOfWholeDigits(centerAround);
  const decimalBase = 10;

  while (granularities.length <= count) {
    if (!coarse) {
      const halfStep = toSignificantDigits(5 * Math.pow(decimalBase, logTen - 1), digits);
      granularities.push(halfStep);
    }
    if (granularities.length >= count) break;
    const wholeStep = toSignificantDigits(Math.pow(decimalBase, logTen), digits);
    granularities.push(wholeStep);
    logTen++;
  }

  return List(granularities.map(NumberBucket.fromNumber));
}

function days(count: number) {
  return count * day.canonicalLength;
}

function hours(count: number) {
  return count * hour.canonicalLength;
}

function minutes(count: number) {
  return count * minute.canonicalLength;
}

interface BucketingHelper<T extends Bucket> {
  dimensionKind: DimensionKind<T>;
  minGranularity: T;
  defaultGranularity: T;
  supportedGranularities: Unary<T, List<T>>;
  checkers: Array<Checker<T>>;
  coarseCheckers: Array<Checker<T>>;
  defaultGranularities: List<T>;
  coarseGranularities: List<T>;
}

const timeCheckers = [
  makeCheckpoint(days(95), TimeBucket.fromJS("P1W")),
  makeCheckpoint(days(8), TimeBucket.fromJS("P1D")),
  makeCheckpoint(hours(8), TimeBucket.fromJS("PT1H")),
  makeCheckpoint(hours(3), TimeBucket.fromJS("PT5M"))];

const timeCoarseCheckers = [
  makeCheckpoint(days(95), TimeBucket.fromJS("P1M")),
  makeCheckpoint(days(20), TimeBucket.fromJS("P1W")),
  makeCheckpoint(days(6), TimeBucket.fromJS("P1D")),
  makeCheckpoint(days(2), TimeBucket.fromJS("PT12H")),
  makeCheckpoint(hours(23), TimeBucket.fromJS("PT6H")),
  makeCheckpoint(hours(3), TimeBucket.fromJS("PT1H")),
  makeCheckpoint(minutes(30), TimeBucket.fromJS("PT5M"))];

const timeMinGranularity = TimeBucket.fromJS("PT1M");

const supportedTimeGranularities = List.of(
  "PT1S", "PT1M", "PT5M", "PT15M",
  "PT1H", "PT6H", "PT8H", "PT12H",
  "P1D", "P1W", "P1M", "P3M", "P6M",
  "P1Y", "P2Y"
).map(duration => TimeBucket.fromJS(duration));
const TimeHelper: BucketingHelper<TimeBucket> = {
  dimensionKind: "time",
  defaultGranularity: TimeBucket.fromJS("P1D"),
  minGranularity: timeMinGranularity,
  checkers: timeCheckers,
  coarseCheckers: timeCoarseCheckers,

  supportedGranularities: (_: TimeBucket) => supportedTimeGranularities,

  defaultGranularities: List(timeCheckers.map(c => c.returnValue).concat(timeMinGranularity).reverse()),
  coarseGranularities: List(timeCoarseCheckers.map(c => c.returnValue).concat(timeMinGranularity).reverse())
};

const numberCheckers = [
  makeCheckpoint(5000, NumberBucket.fromNumber(1000)),
  makeCheckpoint(500, NumberBucket.fromNumber(100)),
  makeCheckpoint(100, NumberBucket.fromNumber(10)),
  makeCheckpoint(1, NumberBucket.fromNumber(1)),
  makeCheckpoint(0.1, NumberBucket.fromNumber(0.1))
];

const NumberHelper: BucketingHelper<NumberBucket> = {
  dimensionKind: "number",
  minGranularity : NumberBucket.fromNumber(1),
  defaultGranularity : NumberBucket.fromNumber(10),

  checkers : numberCheckers,

  defaultGranularities:  List(numberCheckers.map((c: any) => c.returnValue).reverse()),
  coarseGranularities:  null,
  coarseCheckers:  [
    makeCheckpoint(500000, NumberBucket.fromNumber(50000)),
    makeCheckpoint(50000, NumberBucket.fromNumber(10000)),
    makeCheckpoint(5000, NumberBucket.fromNumber(5000)),
    makeCheckpoint(1000, NumberBucket.fromNumber(1000)),
    makeCheckpoint(100, NumberBucket.fromNumber(100)),
    makeCheckpoint(10, NumberBucket.fromNumber(10)),
    makeCheckpoint(1, NumberBucket.fromNumber(1)),
    makeCheckpoint(0.1, NumberBucket.fromNumber(0.1))
  ],

  supportedGranularities: (bucketedBy: NumberBucket) => List(makeNumberBuckets(getBucketSize(bucketedBy), 10))
};

// TODO: fix "as"
function getHelperForKind<T extends Bucket>(kind: DimensionKind<T>): BucketingHelper<T> {
  if (kind === "time") return TimeHelper as BucketingHelper<T>;
  return NumberHelper as BucketingHelper<T>;
}

// TODO: fix "as"
function getHelperForRange<T extends Bucket>({ start }: BucketableRange<T>): BucketingHelper<T> {
  if (start instanceof Date) return TimeHelper as BucketingHelper<T>;
  return NumberHelper as BucketingHelper<T>;
}

function getBucketSize(bucket: Bucket): number {
  if (bucket instanceof TimeBucket) return bucket.duration.getCanonicalLength();
  if (bucket instanceof NumberBucket) return bucket.size;
  throw new Error(`unrecognized granularity: ${bucket} must be number or Duration`);
}

function startValue<T extends Bucket>({ start }: BucketableRange<T>): number {
  return start instanceof Date ? start.valueOf() : start;
}

function endValue<T extends Bucket>({ end }: BucketableRange<T>): number {
  return end instanceof Date ? end.valueOf() : end;
}

function findBestMatch<T extends Bucket>(array: List<T>, target: T): T {
  const exactMatch = findExactIndex(array, target, getBucketSize);
  if (exactMatch !== -1) {
    return array.get(exactMatch);
  }
  const minBiggerIdx = findFirstBiggerIndex(array, target, getBucketSize);
  if (minBiggerIdx !== -1) {
    return array.get(minBiggerIdx);
  }
  return array.get(findMaxValueIndex(array, getBucketSize));
}

function generateGranularitySet<T extends Bucket>(allGranularities: List<T>, bucketedBy: T): List<T> {
  const start = findFirstBiggerIndex(allGranularities, bucketedBy, getBucketSize);
  const returnGranularities = allGranularities.slice(start, start + MENU_LENGTH);
  // makes sure the bucket is part of the list
  if (findExactIndex(returnGranularities, bucketedBy, getBucketSize) === -1) {
    return List.of(bucketedBy).concat(returnGranularities.slice(0, returnGranularities.count() - 1));
  }
  return returnGranularities;
}

export function getGranularities<T extends Bucket>(kind: DimensionKind<T>, bucketedBy?: T, coarse?: boolean): List<T> {
  const kindHelper = getHelperForKind(kind);
  const coarseGranularities = kindHelper.coarseGranularities;
  if (!bucketedBy) return coarse && coarseGranularities ? coarseGranularities : kindHelper.defaultGranularities;
  // make list that makes most sense with bucket
  const allGranularities = kindHelper.supportedGranularities(bucketedBy);
  return generateGranularitySet(allGranularities, bucketedBy);
}

export function getDefaultGranularityForKind<T extends Bucket>(kind: DimensionKind<T>, bucketedBy?: T, customGranularities?: List<T>): T {
  if (bucketedBy) return bucketedBy;
  if (customGranularities) return customGranularities.get(2);
  return getHelperForKind(kind).defaultGranularity;
}

export function getBestGranularityForRange<T extends Bucket>(inputRange: BucketableRange<T>, bigChecker: boolean, bucketedBy?: T, customGranularities?: List<T>): T {
  return getBestBucketUnitForRange(inputRange, bigChecker, bucketedBy, customGranularities);
}

export function getBestBucketUnitForRange<T extends Bucket>(inputRange: BucketableRange<T>, bigChecker: boolean, bucketedBy?: T, customGranularities?: List<T>): T {
  const rangeLength = Math.abs(endValue(inputRange) - startValue(inputRange));

  const rangeHelper: BucketingHelper<T> = getHelperForRange(inputRange);
  const bucketLength = bucketedBy ? getBucketSize(bucketedBy) : 0;
  const checkPoints = bigChecker && rangeHelper.coarseCheckers ? rangeHelper.coarseCheckers : rangeHelper.checkers;

  for (const { checkPoint, returnValue } of checkPoints) {
    if (rangeLength > checkPoint || bucketLength > checkPoint) {

      if (bucketedBy) {
        const granArray = customGranularities || getGranularities(rangeHelper.dimensionKind, bucketedBy);
        const closest = findBiggerClosestToIdeal<T>(granArray, bucketedBy, returnValue, getBucketSize);
        // this could happen if bucketedBy were very big or if custom granularities are smaller than maker action
        if (closest === null) return rangeHelper.defaultGranularity;
        return closest;
      } else {
        if (!customGranularities) return returnValue;
        return findBestMatch(customGranularities, returnValue);
      }
    }
  }

  const minBucket = customGranularities ? customGranularities.get(findMinValueIndex(customGranularities, getBucketSize)) : rangeHelper.minGranularity;
  return bucketLength > getBucketSize(minBucket) ? bucketedBy : minBucket;
}
