self.CaptureStore = class CaptureStore {
  constructor({chrome}) {
    this.chrome = chrome;
  }

  sanitizeFilenamePart(value, fallback = 'Page') {
    value = String(value || '')
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
      .replace(/[\\/:"*?<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/g, '')
      .replace(/[. ]+$/g, '');

    if (!value || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(value)) {
      return fallback;
    }

    return value;
  }

  sanitizeFilename(filename, maxLength = 120) {
    filename = this.sanitizeFilenamePart(filename, 'screenshot');

    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) {
      filename = filename.substring(0, maxLength);
    }
    else if (platform.includes('mac') || platform.includes('linux')) {
      filename = filename.substring(0, maxLength);
    }

    return filename.replace(/[. ]+$/g, '') || 'screenshot';
  }

  async buildFilename(tab) {
    const metadata = await this.collectPageMetadata(tab);
    const siteName = this.sanitizeFilenamePart(metadata.siteName, 'Website');
    const titleSource = metadata.h1 ?
      this.sanitizeFilenamePart(metadata.h1, 'Page') :
      this.titleFromPath(metadata.urlPathTitle);
    const pageTitle = this.truncateMeaningful(titleSource, 50);
    const date = new Intl.DateTimeFormat('en-CA').format();

    return this.sanitizeFilename(`${siteName} - ${pageTitle} - ${date}`, 110);
  }

  async collectPageMetadata(tab) {
    const fallback = this.metadataFromUrl(tab.url);

    if (!tab.id) {
      return fallback;
    }

    try {
      const [result] = await this.chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {
          const isGeneric = value => {
            const normalized = String(value || '').trim().toLowerCase();
            return !normalized ||
              ['home', 'homepage', 'welcome', 'untitled', 'page', 'sign in', 'log in'].includes(normalized);
          };
          const isUsableHeading = element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            return style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 1 &&
              rect.height > 1 &&
              !isGeneric(element.textContent);
          };
          const url = new URL(location.href);
          const h1 = Array.from(document.querySelectorAll('h1'))
            .find(isUsableHeading)?.textContent?.trim() || '';
          const siteName = document.querySelector('meta[property="og:site_name"]')?.content?.trim() ||
            url.hostname.replace(/^www\./, '');

          return {
            h1,
            siteName,
            urlPathTitle: url.pathname
          };
        },
        injectImmediately: true
      });

      return {
        ...fallback,
        ...(result?.result || {})
      };
    }
    catch (error) {
      return fallback;
    }
  }

  metadataFromUrl(url) {
    try {
      const parsed = new URL(url);
      return {
        siteName: parsed.hostname.replace(/^www\./, ''),
        h1: '',
        urlPathTitle: parsed.pathname
      };
    }
    catch (error) {
      return {
        siteName: 'Website',
        h1: '',
        urlPathTitle: 'Page'
      };
    }
  }

  titleFromPath(pathname) {
    const segments = String(pathname || '')
      .split('/')
      .filter(Boolean);
    const last = segments[segments.length - 1] || segments[0] || 'Page';

    try {
      return decodeURIComponent(last).replace(/[-_]+/g, ' ');
    }
    catch (error) {
      return last.replace(/[-_]+/g, ' ');
    }
  }

  truncateMeaningful(value, maxLength) {
    value = this.sanitizeFilenamePart(value, 'Page');

    if (value.length <= maxLength) {
      return value;
    }

    const separators = [': ', ' - ', ' | '];
    for (const separator of separators) {
      const index = value.lastIndexOf(separator, maxLength);
      if (index >= 20) {
        return value.slice(0, index).trim();
      }
    }

    const truncated = value.slice(0, maxLength + 1);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace >= 20) {
      return truncated.slice(0, lastSpace).trim();
    }

    return value.slice(0, maxLength).trim();
  }

  filenameWithExtension(filename, extension) {
    const safeExtension = this.sanitizeFilenamePart(extension, 'png').toLowerCase();
    const suffix = '.' + safeExtension;
    const maxBaseLength = Math.max(1, 120 - suffix.length);

    return this.sanitizeFilename(filename, maxBaseLength) + suffix;
  }

  async blobToUrl(blob) {
    if (typeof blob === 'string') {
      return blob;
    }

    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  extensionFromBlob({blob, url}) {
    const mime = blob.type || url.split(',')[0].split(':')[1].split(';')[0];
    return mime.split('/')[1].split(';')[0];
  }

  download({url, filename, extension, saveAs}) {
    return new Promise(resolve => {
      const attempts = [];
      const tryDownload = candidateFilename => {
        this.chrome.downloads.download({
          url,
          filename: candidateFilename,
          saveAs
        }, downloadId => {
          const lastError = this.chrome.runtime.lastError;
          attempts.push({
            filename: candidateFilename,
            downloadId: downloadId || null,
            error: lastError?.message || null
          });
          resolve({
            ok: !lastError,
            filename: candidateFilename,
            downloadId: downloadId || null,
            error: lastError?.message || null,
            attempts
          });
        });
      };
      const finalFilename = this.filenameWithExtension(filename, extension);

      this.chrome.downloads.download({
        url,
        filename: finalFilename,
        saveAs
      }, downloadId => {
        const lastError = this.chrome.runtime.lastError;
        attempts.push({
          filename: finalFilename,
          downloadId: downloadId || null,
          error: lastError?.message || null
        });
        if (lastError) {
          tryDownload('image.' + extension);
          return;
        }

        resolve({
          ok: true,
          filename: finalFilename,
          downloadId: downloadId || null,
          error: null,
          attempts
        });
      });
    });
  }

  async save(blob, tab) {
    const prefs = await this.chrome.storage.local.get({
      'saveAs': false
    });

    const filename = await this.buildFilename(tab);
    const url = await this.blobToUrl(blob);
    const extension = this.extensionFromBlob({blob, url});

    const download = await this.download({
      url,
      filename,
      extension,
      saveAs: prefs.saveAs
    });

    return {
      status: download.ok ? 'saved' : 'failed',
      files: [{
        part: 1,
        total: 1,
        filename: download.filename,
        extension,
        downloadId: download.downloadId,
        ok: download.ok,
        error: download.error
      }],
      errors: download.ok ? [] : [download.error || 'Download failed.']
    };
  }

  async saveMultiple(files, tab) {
    const prefs = await this.chrome.storage.local.get({
      'saveAs': false
    });
    const filename = await this.buildFilename(tab);

    const statuses = [];
    for (const file of files) {
      const url = await this.blobToUrl(file.blob);
      const extension = this.extensionFromBlob({
        blob: file.blob,
        url
      });

      const download = await this.download({
        url,
        filename: `${filename} - part ${String(file.index + 1).padStart(2, '0')} of ${String(file.total).padStart(2, '0')}`,
        extension,
        saveAs: false
      });

      statuses.push({
        part: file.index + 1,
        total: file.total,
        filename: download.filename,
        extension,
        downloadId: download.downloadId,
        width: file.width,
        height: file.height,
        ok: download.ok,
        error: download.error
      });
    }

    const errors = statuses
      .filter(status => !status.ok)
      .map(status => status.error || `Part ${status.part} failed.`);

    return {
      status: errors.length ? 'partial_or_failed' : 'saved',
      files: statuses,
      errors
    };
  }
};
