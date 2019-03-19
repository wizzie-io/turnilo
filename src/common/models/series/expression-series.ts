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

import { Record } from "immutable";
import { RequireOnly } from "../../utils/functional/functional";
import { Measure } from "../measure/measure";
import { BasicSeriesValue, SeriesBehaviours } from "./series";
import { DEFAULT_FORMAT, SeriesFormat } from "./series-format";
import { SeriesType } from "./series-type";

export enum ExpressionSeriesOperation { PERCENT_OF_PARENT = "percent_of_parent", PERCENT_OF_TOTAL = "percent_of_total" }

const DEFAULT_OPERATION: ExpressionSeriesOperation = ExpressionSeriesOperation.PERCENT_OF_PARENT;

interface ExpressionSeriesValue extends BasicSeriesValue {
  type: SeriesType.EXPRESSION;
  reference: string;
  operation: ExpressionSeriesOperation;
  operand?: string;
  format: SeriesFormat;
}

const defaultSeries: ExpressionSeriesValue = {
  reference: null,
  format: DEFAULT_FORMAT,
  type: SeriesType.EXPRESSION,
  operation: DEFAULT_OPERATION
};

export class ExpressionSeries extends Record<ExpressionSeriesValue>(defaultSeries) implements SeriesBehaviours {

  static fromMeasure({ name }: Measure) {
    return new ExpressionSeries({ reference: name, operation: null });
  }

  constructor(params: RequireOnly<ExpressionSeriesValue, "reference" | "operation">) {
    super(params);
  }

  key() {
    return `${this.reference}-${this.operation}${this.operand ? ` ${this.operand}` : ""}`;
  }
}
