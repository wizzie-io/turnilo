/*
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

import { Duration } from "chronoshift";
import { Record } from "immutable";
import { Expression, NumberBucketExpression, TimeBucketExpression } from "plywood";
import nullableEquals from "../../utils/immutable-utils/nullable-equals";
import { isValidDuration } from "../../utils/plywood/duration";
import { ContinuousDimensionKind } from "./granularity";

interface NumberBucketValue {
  size: number;
}

export class NumberBucket extends Record<NumberBucketValue>({ size: null }) {

  static fromNumber(size: number): NumberBucket {
    return new NumberBucket({ size });
  }

  toExpression(): Expression {
    return new NumberBucketExpression({ size: this.size });
  }

  kind(): ContinuousDimensionKind {
    return "number";
  }

  toString(): string {
    return this.size.toString();
  }
}

interface TimeBucketValue {
  duration: Duration;
}

export class TimeBucket extends Record<TimeBucketValue>({ duration: null }) {

  static fromJS(str: string): TimeBucket {
    return TimeBucket.fromDuration(Duration.fromJS(str));
  }

  static fromDuration(duration: Duration): TimeBucket {
    return new TimeBucket({ duration });
  }

  equals(other: any): boolean {
    return other instanceof TimeBucket && nullableEquals(this.duration, other.duration);
  }

  toExpression(): Expression {
    return new TimeBucketExpression({ duration: this.duration });
  }

  toString(): string {
    return this.duration.toString();
  }

  kind(): ContinuousDimensionKind {
    return "time";
  }
}

export function fromJS(input: any): Bucket {
  if (typeof input === "number") return NumberBucket.fromNumber(input);
  if (isValidDuration(input)) return TimeBucket.fromJS(input);
  throw new Error("input should be number or Duration");
}

export type Bucket = TimeBucket | NumberBucket;
