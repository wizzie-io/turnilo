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

import { List, Record } from "immutable";
import { $, Expression } from "plywood";
import { isTruthy, makeTitle, verifyUrlSafeName } from "../../utils/general/general";
import { Bucket, fromJS as bucketFromJS } from "../granularity/bucket";
import { GranularityJS } from "../granularity/granularity";
import { DimensionOrGroupVisitor } from "./dimension-group";

function typeToKind(type: string): string {
  if (!type) return type;
  return type.toLowerCase().replace(/_/g, "-").replace(/-range$/, "");
}

export enum BucketingStrategy {
  defaultBucket = "defaultBucket",
  defaultNoBucket = "defaultNoBucket"
}

const bucketingStrategies: { [strategy in BucketingStrategy]: BucketingStrategy } = {
  defaultBucket: BucketingStrategy.defaultBucket,
  defaultNoBucket: BucketingStrategy.defaultNoBucket
};

function assertGranularities(granularities: List<Bucket>, dimensionName: string) {
  if (granularities) {
    if (granularities.count() !== 5) {
      throw new Error(`must have list of 5 granularities in dimension '${dimensionName}'`);
    }
    const sameType = granularities.every(g => g.kind() === granularities.first().kind());
    if (!sameType) throw new Error("granularities must have the same type of actions");
  }
}

function assertUrlFormat(url?: string) {
  if (url && typeof url !== "string") {
    throw new Error(`unsupported url: ${url}: only strings are supported`);
  }
}

export interface DimensionValue {
  name: string;
  title?: string;
  description?: string;
  formula?: string;
  kind?: string;
  url?: string;
  granularities?: List<Bucket>;
  bucketedBy?: Bucket;
  bucketingStrategy?: BucketingStrategy;
  sortStrategy?: string;
}

export interface DimensionJS {
  name: string;
  title?: string;
  description?: string;
  formula?: string;
  kind?: string;
  url?: string;
  granularities?: GranularityJS[];
  bucketedBy?: GranularityJS;
  bucketingStrategy?: BucketingStrategy;
  sortStrategy?: string;
}

const defaultDimension: DimensionValue = {
  name: null,
  title: undefined,
  description: undefined,
  formula: null,
  kind: null,
  url: undefined,
  granularities: undefined,
  bucketedBy: undefined,
  bucketingStrategy: undefined,
  sortStrategy: undefined
};

function initializeParameters(parameters: DimensionValue): DimensionValue {
  const { name, url, title: initialTitle, formula: initialFormula, granularities } = parameters;
  verifyUrlSafeName(name);
  assertGranularities(granularities, name);
  assertUrlFormat(url);

  const title = initialTitle || makeTitle(name);
  const formula = initialFormula || $(name).toString();
  const kind = parameters.kind || typeToKind(Expression.parse(formula).type) || "string";

  return { ...parameters, title, formula, kind };
}

export class Dimension extends Record<DimensionValue>(defaultDimension) {

  static fromJS(parameters: DimensionJS): Dimension {
    const value: DimensionValue = {
      name: parameters.name,
      title: parameters.title,
      description: parameters.description,
      formula: parameters.formula,
      kind: parameters.kind || typeToKind((parameters as any).type),
      url: parameters.url
    };

    if (parameters.granularities) {
      value.granularities = List(parameters.granularities.map(bucketFromJS));
    }
    if (parameters.bucketedBy) {
      value.bucketedBy = bucketFromJS(parameters.bucketedBy);
    }
    if (parameters.bucketingStrategy) {
      value.bucketingStrategy = bucketingStrategies[parameters.bucketingStrategy];
    }
    if (parameters.sortStrategy) {
      value.sortStrategy = parameters.sortStrategy;
    }

    return new Dimension(value);
  }

  // TODO: check if need to memoize for perf
  public get expression(): Expression {
    return Expression.parse(this.formula);
  }

  constructor(parameters: DimensionValue) {
    super(initializeParameters(parameters));
  }

  toJS(): any {
    const js = super.toJS();
    return Object.keys(js).reduce((acc, key) => {
      // @ts-ignore
      const val = js[key];
      return isTruthy(val) ? { ...acc, [key]: val } : acc;
    }, {});
  }

  /**
   * @deprecated
   */
  accept<R>(visitor: DimensionOrGroupVisitor<R>): R {
    return visitor.visitDimension(this);
  }

  public toString(): string {
    return `[Dimension: ${this.name}]`;
  }

  public canBucketByDefault(): boolean {
    return this.isContinuous() && this.bucketingStrategy !== BucketingStrategy.defaultNoBucket;
  }

  public isContinuous() {
    const { kind } = this;
    return kind === "time" || kind === "number";
  }

  changeKind(newKind: string): Dimension {
    return this.set("kind", newKind);
  }

  changeName(newName: string): Dimension {
    return this.set("name", newName);
  }

  changeTitle(newTitle: string): Dimension {
    return this.set("title", newTitle);
  }

  public changeFormula(newFormula: string): Dimension {
    return this.set("formula", newFormula);
  }
}
