const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

// Loads content.js against a fake chrome API and a mutable page.
function load(t) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const sent = [];
  const msgs = [];
  const win = new JSDOM('').window;
  globalThis.document = win.document;
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.MutationObserver = win.MutationObserver;
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener() {} },
      sendMessage: async (m) => { sent.push(m.inCall); msgs.push(m); },
    },
  };
  delete require.cache[require.resolve('./content.js')];
  require('./content.js');
  const inCall = (on, muted = false) =>
    (document.body.innerHTML = on
      ? `<button data-is-muted="${muted}" aria-label="Turn ${muted ? 'on' : 'off'} microphone"></button>`
      : '');
  t.after(() => { delete globalThis.chrome; delete globalThis.document; delete globalThis.addEventListener; delete globalThis.MutationObserver; });
  return { sent, msgs, inCall, tick: (s) => t.mock.timers.tick(s * 1000) };
}

test('reports the page mic state with presence', (t) => {
  const { msgs, inCall, tick } = load(t);
  inCall(true, false);
  tick(1);
  inCall(true, true);
  tick(1);
  assert.deepStrictEqual(msgs.map((m) => m.muted), [false, true]);
});

test('reports a mic change immediately, not on the next tick', async (t) => {
  const { msgs, inCall, tick } = load(t);
  inCall(true, false);
  tick(1);
  const btn = document.querySelector('button');
  btn.setAttribute('aria-label', 'Turn off microphone (ctrl + d)'); // unrelated change: no report
  await new Promise((r) => setImmediate(r));
  btn.setAttribute('data-is-muted', 'true');
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(msgs.map((m) => m.muted), [false, true]);
});

test('keeps reporting while in a call, so a restarted service worker recovers', (t) => {
  const { sent, inCall, tick } = load(t);
  tick(3);
  assert.deepStrictEqual(sent, []);
  inCall(true);
  tick(3);
  assert.deepStrictEqual(sent, [true, true, true]);
});

test('stops once the extension is reloaded out from under it', (t) => {
  const { sent, inCall, tick } = load(t);
  let calls = 0;
  chrome.runtime.sendMessage = () => { calls++; throw new Error('Extension context invalidated.'); };
  inCall(true);
  assert.doesNotThrow(() => tick(3));
  assert.strictEqual(calls, 1);
});

test('reports leaving the call once', (t) => {
  const { sent, inCall, tick } = load(t);
  inCall(true);
  tick(1);
  inCall(false);
  tick(3);
  assert.deepStrictEqual(sent, [true, false]);
});
