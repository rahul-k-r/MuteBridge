const test = require('node:test');
const assert = require('node:assert');

// Loads a fresh background.js against a fake chrome API.
function load() {
  const on = {};
  const ports = [];
  const sent = [];
  const ev = (name) => ({ addListener: (f) => (on[name] = f) });
  globalThis.chrome = {
    runtime: {
      onMessage: ev('message'),
      connectNative: () => {
        const p = { closed: false, posted: [], disconnect: () => (p.closed = true) };
        p.postMessage = (m) => p.posted.push(m.muted);
        p.onMessage = { addListener: (f) => (p.emit = f) };
        p.onDisconnect = { addListener: (f) => (p.drop = f) };
        ports.push(p);
        return p;
      },
    },
    tabs: { onRemoved: ev('removed'), sendMessage: async (...a) => sent.push(a) },
  };
  delete require.cache[require.resolve('./background.js')];
  require('./background.js');
  const presence = (tabId, frameId, inCall, muted = false) =>
    on.message({ type: 'presence', inCall, muted }, { tab: { id: tabId }, frameId });
  return { on, ports, sent, presence };
}

test('a new host is told the page mic state', () => {
  const { ports, presence } = load();
  presence(1, 0, true, true);
  assert.deepStrictEqual(ports[0].posted, [true]);
});

test('page mic changes reach the host; repeated reports do not', () => {
  const { ports, presence } = load();
  presence(1, 0, true, false);
  presence(1, 0, true, false);
  presence(1, 0, true, true);
  presence(1, 0, true, true);
  assert.deepStrictEqual(ports[0].posted, [false, true]);
});

test('host runs only while some frame is in a call', () => {
  const { ports, presence } = load();
  assert.strictEqual(ports.length, 0);
  presence(1, 0, true);
  presence(2, 3, true);
  assert.strictEqual(ports.length, 1);
  presence(1, 0, false);
  assert.strictEqual(ports[0].closed, false);
  presence(2, 3, false);
  assert.strictEqual(ports[0].closed, true);
});

test('mute is sent only to in-call frames', () => {
  const { ports, sent, presence } = load();
  presence(1, 0, true);
  presence(2, 3, true);
  presence(1, 0, false);
  ports[0].emit({ muted: true });
  assert.deepStrictEqual(sent, [[2, { type: 'mute', muted: true }, { frameId: 3 }]]);
});

test('closing the tab stops the host', () => {
  const { on, ports, presence } = load();
  presence(1, 0, true);
  presence(1, 5, true);
  on.removed(1);
  assert.strictEqual(ports[0].closed, true);
});

test('reconnects after host drop only if still in a call', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { ports, presence } = load();
  presence(1, 0, true);
  ports[0].drop();
  t.mock.timers.tick(5000);
  assert.strictEqual(ports.length, 2);
  ports[1].drop();
  presence(1, 0, false);
  t.mock.timers.tick(5000);
  assert.strictEqual(ports.length, 2);
});
