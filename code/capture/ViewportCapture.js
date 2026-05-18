self.ViewportCapture = class ViewportCapture {
  constructor({
    chrome,
    retryDelay = 100,
    maxRetries = 3
  }) {
    this.chrome = chrome;
    this.retryDelay = retryDelay;
    this.maxRetries = maxRetries;
  }

  async capture(prefs) {
    const options = {
      format: prefs.format,
      quality: parseInt(prefs.quality * 100)
    };
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const dataUrl = await this.chrome.tabs.captureVisibleTab(null, options);
        return fetch(dataUrl).then(r => r.blob());
      }
      catch (error) {
        lastError = error;

        if (!this.isQuotaError(error) || attempt >= this.maxRetries) {
          throw error;
        }

        await this.wait(this.retryDelay * (attempt + 1));
      }
    }

    throw lastError;
  }

  isQuotaError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('max_capture_visible_tab_calls_per_second') ||
      message.includes('quota') ||
      message.includes('too frequent') ||
      message.includes('capturevisibletab') && message.includes('second');
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
