const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
const { micButton, isMuted, setMuted } = require('./content.js');

const page = (html) => new JSDOM(html).window.document;
const track = (doc) => {
  const b = micButton(doc);
  let clicks = 0;
  b.click = () => clicks++;
  return () => clicks;
};

const meet = (muted) =>
  `<button aria-label="Turn on camera"></button>
   <button data-is-muted="${muted}" aria-label="Turn ${muted ? 'on' : 'off'} microphone (ctrl + d)"></button>`;
const zoom = (muted) =>
  `<button aria-label="${muted ? 'unmute' : 'mute'} my microphone"></button>`;

test('Meet: reads state from data-is-muted and ignores the camera button', () => {
  assert.strictEqual(isMuted(micButton(page(meet(true)))), true);
  assert.strictEqual(isMuted(micButton(page(meet(false)))), false);
});

test('Zoom: reads state from aria-label', () => {
  assert.strictEqual(isMuted(micButton(page(zoom(true)))), true);
  assert.strictEqual(isMuted(micButton(page(zoom(false)))), false);
});

for (const [name, html] of [['Meet', meet], ['Zoom', zoom]]) {
  test(`${name}: clicks only when state differs`, () => {
    let d = page(html(false)); let clicks = track(d);
    setMuted(d, true); assert.strictEqual(clicks(), 1);
    d = page(html(true)); clicks = track(d);
    setMuted(d, true); assert.strictEqual(clicks(), 0);
    setMuted(d, false); assert.strictEqual(clicks(), 1);
  });
}

test('no mic button: no-op', () => {
  assert.doesNotThrow(() => setMuted(page('<button aria-label="Leave call"></button>'), true));
});
