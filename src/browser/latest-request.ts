export interface LatestRequestToken {
  isCurrent(): boolean;
}

export interface LatestRequestController {
  start(): LatestRequestToken;
}

export function createLatestRequest(): LatestRequestController {
  let generation = 0;

  return {
    start() {
      const requestGeneration = ++generation;
      return {
        isCurrent: () => requestGeneration === generation,
      };
    },
  };
}
