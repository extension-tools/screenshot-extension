self.NotificationService = class NotificationService {
  constructor({chrome}) {
    this.chrome = chrome;
    this.defaultIconUrl = '/data/icons/48.png';
  }

  async emit(event) {
    const notification = this.normalize(event);
    await this.storeLastEvent(notification).catch(() => {});

    if (notification.silent || !this.chrome.notifications?.create) {
      return;
    }

    await new Promise(resolve => {
      this.chrome.notifications.create({
        type: 'basic',
        iconUrl: notification.iconUrl,
        title: notification.title,
        message: notification.message
      }, id => {
        if (id) {
          setTimeout(() => this.chrome.notifications.clear(id), notification.ttlMs);
        }
        resolve();
      });
    });
  }

  async info(event) {
    await this.emit({
      severity: 'info',
      ...event
    });
  }

  async warning(event) {
    await this.emit({
      severity: 'warning',
      ...event
    });
  }

  async error(error, event = {}) {
    const message = error?.message || String(error);
    await this.emit({
      event: 'capture.error',
      reason: 'capture_failed',
      severity: 'error',
      message,
      ...event
    });
  }

  normalize(event) {
    const manifest = this.chrome.runtime.getManifest();
    const severity = event.severity || 'info';

    return {
      event: event.event || 'notification',
      reason: event.reason || 'unknown',
      severity,
      title: event.title || manifest.name,
      message: event.message || this.defaultMessage(severity),
      cta: event.cta || null,
      fallback: event.fallback || null,
      data: event.data || null,
      silent: Boolean(event.silent),
      iconUrl: event.iconUrl || this.defaultIconUrl,
      ttlMs: event.ttlMs || 5000,
      createdAt: new Date().toISOString()
    };
  }

  defaultMessage(severity) {
    if (severity === 'error') {
      return 'Capture failed.';
    }

    if (severity === 'warning') {
      return 'Capture needs attention.';
    }

    return 'Capture is running.';
  }

  async storeLastEvent(notification) {
    if (!this.chrome.storage?.local?.set) {
      return;
    }

    await this.chrome.storage.local.set({
      lastNotificationEvent: notification
    });
  }
};
