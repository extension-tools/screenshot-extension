const button = document.getElementById('capture');

button.addEventListener('click', async () => {
  button.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    const response = await chrome.runtime.sendMessage({
      method: 'capture-active-tab',
      tabId: tab?.id
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Capture failed.');
    }

    window.close();
  }
  catch (error) {
    button.disabled = false;
    button.querySelector('span').textContent = error.message || 'Capture failed.';
  }
});
