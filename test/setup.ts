import "@testing-library/jest-dom/vitest";

type Listener = (e: MessageEvent) => void;

export class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  readyState = 1;
  private listeners = new Map<string, Listener[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: Listener) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, handler: Listener) {
    const handlers = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      handlers.filter((h) => h !== handler),
    );
  }

  dispatchEvent(event: MessageEvent) {
    for (const handler of this.listeners.get(event.type) ?? []) {
      handler(event);
    }
    return true;
  }

  /** Test helper: fire a named SSE event with JSON data */
  __emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  close() {
    this.readyState = 2;
  }
}

// @ts-expect-error jsdom lacks EventSource
globalThis.EventSource = MockEventSource;
