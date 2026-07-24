import "@testing-library/jest-dom/vitest";

// jsdom does not expose localStorage on globalThis in all Node versions.
// Provide a fallback so tests that reference global localStorage work.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (index: number) => {
        const keys = Array.from(store.keys());
        return keys[index] ?? null;
      },
    },
    writable: true,
    configurable: true,
  });
}
