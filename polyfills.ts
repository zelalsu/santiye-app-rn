const AbortSignalAny = AbortSignal as typeof AbortSignal & {
  any?: (signals: AbortSignal[]) => AbortSignal;
};

if (!AbortSignalAny.any) {
  AbortSignalAny.any = (signals: AbortSignal[]) => {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason);
        return controller.signal;
      }
    }

    const abortHandler = (event: Event) => {
      const target = event.target as AbortSignal;
      controller.abort(target.reason);
      cleanup();
    };

    const cleanup = () => {
      for (const signal of signals) {
        signal.removeEventListener("abort", abortHandler);
      }
    };

    for (const signal of signals) {
      signal.addEventListener("abort", abortHandler);
    }

    return controller.signal;
  };
}
