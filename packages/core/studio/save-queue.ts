/** All callers await the same queue, including edits made while a request runs. */
export function createSaveQueue<T>(options: {
  current: () => T | null;
  needsSave: (document: T) => boolean;
  save: (document: T) => Promise<T>;
  acknowledge: (saving: T, saved: T) => void;
  failed: (error: unknown) => void;
}) {
  let pending: Promise<T | null> | null = null;
  return () => {
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      try {
        let document = options.current();
        while (document && options.needsSave(document)) {
          const saved = await options.save(document);
          options.acknowledge(document, saved);
          document = options.current();
        }
        return document;
      } catch (error) {
        options.failed(error);
        return null;
      } finally {
        pending = null;
      }
    });
    return pending;
  };
}
