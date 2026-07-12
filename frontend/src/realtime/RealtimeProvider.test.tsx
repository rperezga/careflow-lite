import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { RealtimeProvider, useRealtime, useRealtimeEvent } from './RealtimeProvider';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = () => undefined;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
});

function Probe() {
  const { connected } = useRealtime();
  const [count, setCount] = useState(0);
  useRealtimeEvent('care-task.changed', () => setCount((c) => c + 1));
  return (
    <div>
      <span data-testid="status">{connected ? 'live' : 'offline'}</span>
      <span data-testid="count">{count}</span>
    </div>
  );
}

describe('RealtimeProvider', () => {
  it('connects and dispatches events to subscribers of that type', () => {
    render(
      <RealtimeProvider>
        <Probe />
      </RealtimeProvider>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('offline');

    const ws = FakeWebSocket.instances[0]!;
    act(() => ws.onopen?.());
    expect(screen.getByTestId('status')).toHaveTextContent('live');

    act(() => ws.onmessage?.({ data: JSON.stringify({ type: 'care-task.changed' }) }));
    expect(screen.getByTestId('count')).toHaveTextContent('1');

    // An unrelated event must not trigger this subscriber.
    act(() => ws.onmessage?.({ data: JSON.stringify({ type: 'patient.changed' }) }));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('works without a provider (progressive enhancement)', () => {
    render(<Probe />);
    expect(screen.getByTestId('status')).toHaveTextContent('offline');
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
