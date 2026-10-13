const HOST = 'rahul.mutebridge';

// Frames currently in a call, keyed "tabId:frameId". The host holds a system-wide VoIP call
// (visible to Windows and Bluetooth headsets), so it runs only while this is non-empty.
const inCall = new Map();
let port = null;
let pageMuted = null; // latest page mic state; mirrored to the host so Windows' toggle stays in step

function sync() {
  if (inCall.size && !port) {
    const p = (port = chrome.runtime.connectNative(HOST));
    if (pageMuted !== null) p.postMessage({ muted: pageMuted });
    p.onMessage.addListener(({ muted }) => {
      for (const { tabId, frameId } of inCall.values()) {
        chrome.tabs.sendMessage(tabId, { type: 'mute', muted }, { frameId }).catch(() => {});
      }
    });
    p.onDisconnect.addListener(() => {
      if (port !== p) return;
      port = null;
      setTimeout(sync, 5000); // host crashed or failed to start; retry if still in a call
    });
  } else if (!inCall.size && port) {
    port.disconnect(); // closes host stdin -> host ends the call and exits
    port = null;
  }
}

chrome.runtime.onMessage.addListener((m, sender) => {
  if (m?.type !== 'presence' || !sender.tab) return;
  const key = `${sender.tab.id}:${sender.frameId}`;
  if (m.inCall) {
    // Forward only changes: a periodic report can lag a hotkey-driven click and would undo it.
    if (inCall.get(key)?.muted !== m.muted) {
      pageMuted = m.muted;
      port?.postMessage({ muted: m.muted });
    }
    inCall.set(key, { tabId: sender.tab.id, frameId: sender.frameId, muted: m.muted });
  } else inCall.delete(key);
  sync();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [key, v] of inCall) if (v.tabId === tabId) inCall.delete(key);
  sync();
});
