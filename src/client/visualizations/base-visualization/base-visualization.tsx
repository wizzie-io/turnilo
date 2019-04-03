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

import { Dataset } from "plywood";
import * as React from "react";
import { Essence } from "../../../common/models/essence/essence";
import { Measure } from "../../../common/models/measure/measure";
import { Timekeeper } from "../../../common/models/timekeeper/timekeeper";
import { DatasetLoad, error, isError, isLoaded, isLoading, loaded, loading, VisualizationProps } from "../../../common/models/visualization-props/visualization-props";
import { debounceWithPromise, noop } from "../../../common/utils/functional/functional";
import makeQuery from "../../../common/utils/query/visualization-query";
import { GlobalEventListener } from "../../components/global-event-listener/global-event-listener";
import { Loader } from "../../components/loader/loader";
import { QueryError } from "../../components/query-error/query-error";
import { classNames } from "../../utils/dom/dom";
import "./base-visualization.scss";

export interface BaseVisualizationState {
  datasetLoad?: DatasetLoad;
  dragOnMeasure?: Measure;
  scrollLeft?: number;
  scrollTop?: number;
  hoverMeasure?: Measure;
}

export class BaseVisualization<S extends BaseVisualizationState> extends React.Component<VisualizationProps, S> {
  protected className = "base-visualization";

  constructor(props: VisualizationProps) {
    super(props);

    this.state = this.getDefaultState() as S;
  }

  protected getDefaultState(): BaseVisualizationState {
    return {
      datasetLoad: loading,
      scrollLeft: 0,
      scrollTop: 0,
      hoverMeasure: null
    };
  }

  protected globalMouseMoveListener: (e: MouseEvent) => void = noop;

  protected globalMouseUpListener: (e: MouseEvent) => void = noop;

  protected globalKeyDownListener: (e: KeyboardEvent) => void = noop;

  private lastQueryEssence: Essence = null;

  componentDidMount() {
    const { essence, timekeeper } = this.props;
    console.log(essence.toJS());
    this.loadData(essence, timekeeper);
  }

  componentWillUnmount() {
    this.lastQueryEssence = null;
    this.debouncedCallExecutor.cancel();
  }

  componentWillReceiveProps(nextProps: VisualizationProps) {
    if (this.shouldFetchData(nextProps) && this.visualisationNotResized(nextProps)) {
      const { essence, timekeeper } = nextProps;
      const hadDataLoaded = isLoaded(this.state.datasetLoad);
      const essenceChanged = !essence.equals(this.props.essence);
      this.loadData(essence, timekeeper, hadDataLoaded && essenceChanged);
    }
  }

  private loadData(essence: Essence, timekeeper: Timekeeper, showSpinner = true) {
    if (showSpinner) this.handleDatasetLoad(loading);
    this.fetchData(essence, timekeeper)
      .then(loadedDataset => {
        // TODO: encode it better
        // null is here when we get out of order request, so we just ignore it
        if (!loadedDataset) return;
        if (isError(loadedDataset)) {
          this.handleDatasetLoad(loadedDataset);
        }
        if (isLoaded(loadedDataset)) {
          this.handleDatasetLoad(loadedDataset, this.deriveDatasetState(loadedDataset.dataset));
        }
      });
  }

  private fetchData(essence: Essence, timekeeper: Timekeeper): Promise<DatasetLoad | null> {
    this.lastQueryEssence = essence;
    return this.debouncedCallExecutor(essence, timekeeper);
  }

  private callExecutor = (essence: Essence, timekeeper: Timekeeper): Promise<DatasetLoad | null> =>
    essence.dataCube.executor(makeQuery(essence, timekeeper), { timezone: essence.timezone })
      .then((dataset: Dataset) => {
          // signal out of order requests with null
          if (!this.wasUsedForLastQuery(essence)) return null;
          return loaded(dataset);
        },
        err => {
          // signal out of order requests with null
          if (!this.wasUsedForLastQuery(essence)) return null;
          return error(err);
        })

  private wasUsedForLastQuery(essence: Essence) {
    return essence.equals(this.lastQueryEssence);
  }

  private debouncedCallExecutor = debounceWithPromise(this.callExecutor, 500);

  private handleDatasetLoad(dl: DatasetLoad, derivedState: Partial<S> = {}) {
    // as object will be fixed in typescript 3.2 https://github.com/Microsoft/TypeScript/issues/10727
    this.setState({ ...(derivedState as object), datasetLoad: dl, scrollLeft: 0, scrollTop: 0 });
    const { registerDownloadableDataset } = this.props;
    if (registerDownloadableDataset) {
      registerDownloadableDataset(isLoaded(dl) ? dl.dataset : null);
    }
  }

  protected shouldFetchData(nextProps: VisualizationProps): boolean {
    return this.differentVisualizationDefinition(nextProps);
  }

  protected differentVisualizationDefinition(nextProps: VisualizationProps) {
    const { essence, timekeeper } = this.props;
    const nextEssence = nextProps.essence;
    const nextTimekeeper = nextProps.timekeeper;
    return nextEssence.differentDataCube(essence) ||
      nextEssence.differentEffectiveFilter(essence, timekeeper, nextTimekeeper) ||
      nextEssence.differentTimeShift(essence) ||
      nextEssence.differentSplits(essence) ||
      nextEssence.differentColors(essence) ||
      nextEssence.newEffectiveMeasures(essence) ||
      this.differentLastRefreshRequestTimestamp(nextProps);
  }

  private differentLastRefreshRequestTimestamp({ refreshRequestTimestamp }: VisualizationProps): boolean {
    return refreshRequestTimestamp !== this.props.refreshRequestTimestamp;
  }

  private visualisationNotResized(nextProps: VisualizationProps): boolean {
    return this.props.stage.equals(nextProps.stage);
  }

  protected renderInternals(dataset: Dataset): JSX.Element {
    return null;
  }

  deriveDatasetState(dataset: Dataset): Partial<S> {
    return {};
  }

  render() {
    const { datasetLoad } = this.state;

    return <div className={classNames("base-visualization", this.className)}>
      <GlobalEventListener
        mouseMove={this.globalMouseMoveListener}
        mouseUp={this.globalMouseUpListener}
        keyDown={this.globalKeyDownListener} />
      {isLoaded(datasetLoad) && this.renderInternals(datasetLoad.dataset)}
      {isError(datasetLoad) && <QueryError error={datasetLoad.error} />}
      {isLoading(datasetLoad) && <Loader />}
    </div>;
  }
}
