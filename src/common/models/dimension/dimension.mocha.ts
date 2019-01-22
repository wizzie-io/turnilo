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

import { BucketingStrategy, Dimension, DimensionJS } from "./dimension";
import { DimensionFixtures } from "./dimension.fixtures";

describe("Dimension", () => {

  describe("serialization", () => {
    describe("should serialize/deserialize simple dimensions", () => {

      const dimensions = [
        DimensionFixtures.wikiTime(),
        DimensionFixtures.wikiCommentLength(),
        DimensionFixtures.countryURL(),
        DimensionFixtures.number(),
        DimensionFixtures.countryString()
      ];

      dimensions.forEach(dimension => {
        it(`should serialize/deserialize dimension: ${dimension.name}`, () => {
          const serialized = dimension.toJS();
          const deserialized = Dimension.fromJS(serialized);
          expect(deserialized.equals(dimension)).to.be.true;
        });
      });
    });
  });

  describe("create valid record", () => {
    const definitions = [
      {
        name: "country",
        title: "important countries",
        formula: "$country",
        kind: "string",
        granularities: [5, 50, 500, 800, 1000],
        sortStrategy: "self"
      },
      // {
      //   name: "country",
      //   title: "important countries",
      //   formula: "$country",
      //   kind: "string",
      //   url: "https://www.country.com/%s",
      //   bucketedBy: 1,
      //   bucketingStrategy: BucketingStrategy.defaultBucket
      // },
      // {
      //   name: "time",
      //   title: "time",
      //   formula: "$time",
      //   kind: "time",
      //   url: "http://www.time.com/%s",
      //   granularities: ["PT1M", "P6M", "PT6H", "P1D", "P1W"]
      // },
      // {
      //   name: "time",
      //   title: "time",
      //   formula: "$time",
      //   kind: "time",
      //   url: "http://www.time.com/%s",
      //   granularities: ["PT1M", "P6M", "PT6H", "P1D", "P1W"],
      //   bucketedBy: "PT6H"
      // }
    ];

    definitions.forEach(def => {
      describe(`from definition ${def.name}`, () => {
        it("should read definition", () => {
          expect(Dimension.fromJS(def)).to.be.instanceOf(Dimension);
        });

        it("should be equal to it's copy", () => {
          const inst = Dimension.fromJS(def);
          const inst2 = Dimension.fromJS(JSON.parse(JSON.stringify(def)));
          expect(inst.granularities.equals(inst2.granularities)).to.be.true;
        });
      });
    });
  });

  describe("back compat", () => {
    it("upgrades expression to formula", () => {
      expect(Dimension.fromJS({
        name: "country",
        title: "important countries",
        expression: "$country",
        kind: "string"
      } as any)).to.deep.equal(Dimension.fromJS({
        name: "country",
        title: "important countries",
        formula: "$country",
        kind: "string"
      }));
    });
    /* TODO: check the correctness of the test */
    /*    it('neverBucket -> default no bucket', () => {
          expect(Dimension.fromJS({
            name: 'country',
            title: 'important countries',
            expression: '$country',
            kind: 'string',
            bucketingStrategy: 'neverBucket'
          } as any).toJS()).to.deep.equal({
            name: 'country',
            title: 'important countries',
            formula: '$country',
            kind: 'string',
            bucketingStrategy: 'defaultNoBucket'
          });
        });*/
    /* TODO: check the correctness of the test */
    /*    it('alwaysBucket -> default bucket', () => {
          expect(Dimension.fromJS({
            name: 'country',
            title: 'important countries',
            expression: '$country',
            kind: 'string',
            bucketingStrategy: 'alwaysBucket'
          } as any).toJS()).to.deep.equal({
            name: 'country',
            title: 'important countries',
            formula: '$country',
            kind: 'string',
            bucketingStrategy: 'defaultBucket'
          });
        });*/

  });

  describe("errors", () => {
    it("throws on invalid type", () => {
      var dimJS = {
        name: "mixed_granularities",
        title: "Mixed Granularities",
        kind: "string",
        granularities: [5, 50, "P1W", 800, 1000]
      };

      expect(() => {
        Dimension.fromJS(dimJS);
      }).to.throw("granularities must have the same type of actions");

      var dimJS2 = {
        name: "bad type",
        title: "Bad Type",
        kind: "string",
        granularities: [false, true, true, false, false]
      };

      expect(() => {
        Dimension.fromJS(dimJS2 as any);
      }).to.throw("input should be number or Duration");

    });

  });

});
