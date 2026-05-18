'use strict';

const toast = document.getElementById('toast');

function restore() {
  chrome.storage.local.get({
    'delay': 600,
    'offset': 50,
    'saveAs': false,
    'format': 'png',
    'format-canvas': 'png',
    'quality': 0.95
  }, prefs => {
    document.getElementById('delay').value = prefs.delay;
    document.getElementById('offset').value = prefs.offset;
    document.getElementById('saveAs').checked = prefs.saveAs;
    document.getElementById('format').value = prefs.format;
    document.getElementById('format-canvas').value = prefs['format-canvas'];
    document.getElementById('quality').value = prefs.quality;
  });
}

function save() {
  const delay = Math.max(document.getElementById('delay').value, 100);
  const offset = Math.max(document.getElementById('offset').value, 10);
  const saveAs = document.getElementById('saveAs').checked;
  const format = document.getElementById('format').value;
  const quality = Math.min(Math.max(document.getElementById('quality').valueAsNumber, 0.3), 1);

  chrome.storage.local.set({
    delay,
    offset,
    saveAs,
    format,
    quality,
    'format-canvas': document.getElementById('format-canvas').value
  }, () => {
    toast.textContent = 'Options saved.';
    setTimeout(() => toast.textContent = '', 750);
    restore();
  });
}

document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', save);

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
