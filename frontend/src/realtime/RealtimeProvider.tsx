import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface RealtimeEvent {
  type: string;
  action?: string;
  id?: string;
}

type Handler = (event: RealtimeEvent) => void;

interface RealtimeState {
  connected: boolean;
  subscribe: (type: string, handler: Handler) => () => void;
}

// Realtime is a progressive enhancement: outside a provider (e.g. in unit tests)
// the app still works, it just does not receive live updates.
const FALLBACK: RealtimeState = { connected: false, subscribe: () => () => undefined };

const RealtimeContext = createContext<RealtimeState | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const handlers = useRef(new Map<string, Set<Handler>>());

  useEffect(() => {
    let closed = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;

    function connect() {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socket = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(String(e.data)) as RealtimeEvent;
          handlers.current.get(event.type)?.forEach((h) => h(event));
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        // Exponential backoff (capped) so a restarted server is picked up.
        attempt += 1;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);
        timer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, []);

  const subscribe = useCallback((type: string, handler: Handler) => {
    const set = handlers.current.get(type) ?? new Set<Handler>();
    set.add(handler);
    handlers.current.set(type, set);
    return () => {
      set.delete(handler);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ connected, subscribe }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext) ?? FALLBACK;
}

/** Subscribe to one realtime event type for the lifetime of the component. */
export function useRealtimeEvent(type: string, handler: Handler): void {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(type, (e) => ref.current(e)), [type, subscribe]);
}
