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

import { expect } from "chai";
import { Duration } from "chronoshift";
import { List } from "immutable";
import { NumberRange, TimeRange } from "plywood";
import { fromJS, NumberBucket, TimeBucket } from "./bucket";
import { getBestBucketUnitForRange, getDefaultGranularityForKind, getGranularities } from "./granularity";

describe("Granularity", () => {
  it("fromJSes appropriately", () => {

    const timeBucketAction1 = fromJS("P1W");

    expect(timeBucketAction1 instanceof TimeBucket).to.be.true;
    expect((timeBucketAction1 as TimeBucket).duration).to.deep.equal(Duration.fromJS("P1W"));

    const timeBucketAction2 = fromJS("PT1H");
    expect(timeBucketAction2 instanceof TimeBucket).to.be.true;
    expect((timeBucketAction2 as TimeBucket).duration).to.deep.equal(Duration.fromJS("PT1H"));

    const numberBucketAction1 = fromJS(5);

    expect(numberBucketAction1 instanceof NumberBucket).to.be.true;
    expect((numberBucketAction1 as NumberBucket).size).to.equal(5);
  });

  it("to strings appropriately", () => {
    const timeBucketAction1 = fromJS("P1W");

    expect(timeBucketAction1.toString()).to.equal("P1W");

    const numberBucketAction1 = fromJS(5);
    const numberBucketAction3 = fromJS(300000);
    const numberBucketAction4 = fromJS(2);

    expect(numberBucketAction1.toString()).to.equal("5");
    expect(numberBucketAction3.toString()).to.equal("300000");
    expect(numberBucketAction4.toString()).to.equal("2");
  });

  it("equals appropriately", () => {
    const timeBucketAction1 = fromJS("P1W");

    const timeBucketAction2 = fromJS("P1W");

    const timeBucketAction3 = fromJS("P1D");

    expect(timeBucketAction1.equals(timeBucketAction2)).to.be.true;
    expect(timeBucketAction2.equals(timeBucketAction3)).to.be.false;

    const numberBucketAction1 = fromJS(5);

    const numberBucketAction2 = fromJS(5);

    const numberBucketAction3 = fromJS(3);

    expect(numberBucketAction1.equals(numberBucketAction2)).to.be.true;
    expect(numberBucketAction2.equals(numberBucketAction3)).to.be.false;
  });

  it("getGranularities appropriately for time", () => {
    const defaults = getGranularities("time");
    let expectedDefaults = ["PT1M", "PT5M", "PT1H", "P1D", "P1W"].map(TimeBucket.fromJS);

    expect(defaults.every((g, i) => g.equals(expectedDefaults[i]), "time defaults are returned")).to.be.true;

    const coarse = getGranularities("time", null, true);
    const expectedCoarseDefaults = ["PT1M", "PT5M", "PT1H", "PT6H", "PT12H", "P1D", "P1W", "P1M"].map(TimeBucket.fromJS);

    expect(coarse.every((g, i) => g.equals(expectedCoarseDefaults[i]), "coarse time defaults are returned")).to.be.true;

    const bucketedBy = getGranularities("time", TimeBucket.fromJS("PT12H"), false);
    expectedDefaults = ["PT12H", "P1D", "P1W", "P1M", "P3M"].map(TimeBucket.fromJS);

    expect(bucketedBy.every((g, i) => g.equals(expectedDefaults[i]), "bucketed by time defaults are returned")).to.be.true;
  });

  it("getGranularities appropriately for number", () => {
    const defaults = getGranularities("number");
    const expectedDefaults = [0.1, 1, 10, 100, 1000].map(NumberBucket.fromNumber);

    expect(defaults.every((g, i) => g.equals(expectedDefaults[i]), "number defaults are returned")).to.be.true;

    const bucketedBy = getGranularities("number", NumberBucket.fromNumber(100), false);
    const expectedGrans = [100, 500, 1000, 5000, 10000].map(NumberBucket.fromNumber);

    expect(bucketedBy.every((g, i) => g.equals(expectedGrans[i]), "bucketed by returns larger granularities")).to.be.true;

  });

  it("getDefaultGranularityForKind appropriately for number", () => {
    const defaultNumber = getDefaultGranularityForKind("number");
    let expected = NumberBucket.fromNumber(10);

    expect(defaultNumber.equals(expected)).to.equal(true);

    const bucketedBy = getDefaultGranularityForKind("number", NumberBucket.fromNumber(50));
    expected = NumberBucket.fromNumber(50);

    expect(bucketedBy.equals(expected), "default will bucket by provided bucketedBy amount").to.equal(true);

    const customGrans = getDefaultGranularityForKind("number", null, List([100, 500, 1000, 5000, 10000].map(NumberBucket.fromNumber)));
    expected = NumberBucket.fromNumber(1000);

    expect(customGrans.equals(expected), "default will bucket according to provided customs").to.equal(true);

  });

  it("getDefaultGranularityForKind appropriately for time", () => {
    const defaultNumber = getDefaultGranularityForKind("time");
    let expected = TimeBucket.fromJS("P1D");

    expect(defaultNumber.equals(expected)).to.equal(true);

    const bucketedBy = getDefaultGranularityForKind("time", TimeBucket.fromJS("P1W"));
    expected = TimeBucket.fromJS("P1W");

    expect(bucketedBy.equals(expected), "default will bucket by provided bucketedBy amount").to.equal(true);

    const customGrans = getDefaultGranularityForKind("time", null, List(["PT1H", "PT8H", "PT12H", "P1D", "P1W"].map(TimeBucket.fromJS)));
    expected = TimeBucket.fromJS("PT12H");

    expect(customGrans.equals(expected), "default will bucket according to provided customs").to.equal(true);

  });

  it("getsBestBucketUnit appropriately for time defaults depending on coarse flag", () => {
    const month = "P1M";
    const week = "P1W";
    const day = "P1D";
    const twelveHours = "PT12H";
    const sixHours = "PT6H";
    const oneHour = "PT1H";
    const fiveMinutes = "PT5M";
    const oneMinute = "PT1M";

    const yearLength = new TimeRange({ start: new Date("1994-02-24T00:00:00.000Z"), end: new Date("1995-02-25T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(yearLength, false).toString()).to.equal(week);
    expect(getBestBucketUnitForRange(yearLength, true).toString()).to.equal(month);

    const monthLength = new TimeRange({ start: new Date("1995-02-24T00:00:00.000Z"), end: new Date("1995-03-25T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(monthLength, false).toString()).to.equal(day);
    expect(getBestBucketUnitForRange(monthLength, true).toString()).to.equal(week);

    const sevenDaysLength = new TimeRange({ start: new Date("1995-02-20T00:00:00.000Z"), end: new Date("1995-02-28T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(sevenDaysLength, false).toString()).to.equal(oneHour);
    expect(getBestBucketUnitForRange(sevenDaysLength, true).toString()).to.equal(day);

    const threeDaysLength = new TimeRange({ start: new Date("1995-02-20T00:00:00.000Z"), end: new Date("1995-02-24T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(sevenDaysLength, false).toString()).to.equal(oneHour);
    expect(getBestBucketUnitForRange(threeDaysLength, true).toString()).to.equal(twelveHours);

    const dayLength = new TimeRange({ start: new Date("1995-02-24T00:00:00.000Z"), end: new Date("1995-02-25T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(dayLength, false).toString()).to.equal(oneHour);
    expect(getBestBucketUnitForRange(dayLength, true).toString()).to.equal(sixHours);

    const fourHours = new TimeRange({ start: new Date("1995-02-24T00:00:00.000Z"), end: new Date("1995-02-24T04:00:00.000Z") });
    expect(getBestBucketUnitForRange(fourHours, false).toString()).to.equal(fiveMinutes);
    expect(getBestBucketUnitForRange(fourHours, true).toString()).to.equal(oneHour);

    const fortyFiveMin = new TimeRange({ start: new Date("1995-02-24T00:00:00.000Z"), end: new Date("1995-02-24T00:45:00.000Z") });
    expect(getBestBucketUnitForRange(fortyFiveMin, false).toString()).to.equal(oneMinute);
    expect(getBestBucketUnitForRange(fortyFiveMin, true).toString()).to.equal(fiveMinutes);

  });

  it("getsBestBucketUnit appropriately for time with bucketing and custom granularities", () => {
    const sixHours = "PT6H";
    const oneHour = "PT1H";
    const week = "P1W";

    const dayLength = new TimeRange({ start: new Date("1995-02-24T00:00:00.000Z"), end: new Date("1995-02-25T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(dayLength, false).toString()).to.equal(oneHour);
    expect(getBestBucketUnitForRange(dayLength, false, TimeBucket.fromJS("PT6H")).toString()).to.equal(sixHours);

    const yearLength = new TimeRange({ start: new Date("1994-02-24T00:00:00.000Z"), end: new Date("1995-02-25T00:00:00.000Z") });
    expect(getBestBucketUnitForRange(yearLength, false, TimeBucket.fromJS("PT6H")).toString()).to.equal(week);

    const customs = List(["PT1H", "PT8H", "PT12H", "P1D", "P1W"].map(TimeBucket.fromJS));
    expect(getBestBucketUnitForRange(dayLength, false, null, customs).toString()).to.equal(oneHour);

    const fortyFiveMin = new TimeRange({ start: new Date("1995-02-24T00:00:00.000Z"), end: new Date("1995-02-24T00:45:00.000Z") });
    expect(getBestBucketUnitForRange(fortyFiveMin, false, null, customs).toString()).to.equal(oneHour);

  });

  it("getsBestBucketUnit appropriately for number defaults with bucketing and custom granularities", () => {
    const ten = new NumberRange({ start: 0, end: 10 });
    const thirtyOne = new NumberRange({ start: 0, end: 31 });
    const hundred = new NumberRange({ start: 0, end: 100 });

    expect(getBestBucketUnitForRange(ten, false).equals(NumberBucket.fromNumber(1))).to.be.true;
    expect(getBestBucketUnitForRange(thirtyOne, false).equals(NumberBucket.fromNumber(1))).to.be.true;
    expect(getBestBucketUnitForRange(hundred, false).equals(NumberBucket.fromNumber(1))).to.be.true;
    expect(getBestBucketUnitForRange(hundred, false, NumberBucket.fromNumber(50)).equals(NumberBucket.fromNumber(50))).to.be.true;

    const customs = List([-5, 0.25, 0.5, 0.78, 5].map(NumberBucket.fromNumber));
    expect(getBestBucketUnitForRange(ten, false, null, customs).equals(NumberBucket.fromNumber(5))).to.be.true;

  });

});
