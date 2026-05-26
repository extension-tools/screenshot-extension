const buttons = [...document.querySelectorAll('button[data-export-format]')];
const defaultLabels = new Map(
  buttons.map(button => [button, button.querySelector('span')?.textContent || ''])
);

const setButtonsDisabled = disabled => {
  for (const button of buttons) {
    button.disabled = disabled;
  }
};

for (const button of buttons) {
  button.addEventListener('click', async () => {
    setButtonsDisabled(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      const response = await chrome.runtime.sendMessage({
        method: 'capture-active-tab',
        tabId: tab?.id,
        exportFormat: button.dataset.exportFormat
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Capture failed.');
      }

      window.close();
    }
    catch (error) {
      setButtonsDisabled(false);
      for (const targetButton of buttons) {
        const label = targetButton.querySelector('span');
        if (label) {
          label.textContent = defaultLabels.get(targetButton) || '';
        }
      }

      const label = button.querySelector('span');
      if (label) {
        label.textContent = error.message || 'Capture failed.';
      }
    }
  });
}
