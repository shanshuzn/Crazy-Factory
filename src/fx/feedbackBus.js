export function createFeedbackBus() {
  const handlers = new Map();

  return {
    on(eventName, handler) {
      const set = handlers.get(eventName) || new Set();
      set.add(handler);
      handlers.set(eventName, set);
      return () => set.delete(handler);
    },
    emit(eventName, payload) {
      const set = handlers.get(eventName);
      if (!set) return;
      for (const handler of set) handler(payload);
    }
  };
}
