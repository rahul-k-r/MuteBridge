// Sets the mic to an absolute state on Meet / Zoom web by clicking their mic button
// only when the current state differs.
function micButton(doc) {
  return (
    // Meet: <button data-is-muted="true|false" aria-label="Turn on/off microphone ...">
    doc.querySelector('button[data-is-muted][aria-label*="microphone" i]') ||
    // Zoom web: aria-label "mute my microphone" / "unmute my microphone"
    doc.querySelector('button[aria-label^="mute" i][aria-label*="microphone" i], button[aria-label^="unmute" i][aria-label*="microphone" i]')
  );
}

function isMuted(btn) {
  const attr = btn.getAttribute('data-is-muted');
  if (attr !== null) return attr === 'true';
  return /^unmute/i.test(btn.getAttribute('aria-label') || '');
}

function setMuted(doc, want) {
  const btn = micButton(doc);
  if (btn && isMuted(btn) !== want) btn.click();
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((m) => {
    if (m?.type === 'mute') setMuted(document, m.muted);
  });

  // A visible mic button means we're in a call (or its lobby); background runs the host only then.
  // Re-sent every tick while in a call: the MV3 service worker can be restarted and lose its state.
  let reported = false;
  let reportedMuted;
  const report = (inCall, muted) => {
    if (!inCall && !reported) return;
    reported = inCall;
    reportedMuted = muted;
    try {
      chrome.runtime.sendMessage({ type: 'presence', inCall, muted }).catch(() => {});
    } catch {
      // extension reloaded; this orphaned copy is dead, the new one takes over
      clearInterval(timer);
      observer.disconnect();
    }
  };
  const check = () => {
    const btn = micButton(document);
    report(!!btn, btn ? isMuted(btn) : undefined);
  };
  const timer = setInterval(check, 1000);
  // Report mic changes (e.g. Ctrl+D) at once, so a quick Win+Alt+K toggles from the new state.
  const observer = new MutationObserver(() => {
    const btn = micButton(document);
    if (btn && isMuted(btn) !== reportedMuted) check();
  });
  observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['data-is-muted', 'aria-label'] });
  addEventListener('pagehide', () => report(false));
}
if (typeof module !== 'undefined') module.exports = { micButton, isMuted, setMuted };
