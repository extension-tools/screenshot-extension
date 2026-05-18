(function() {
  class ScrollbarNormalizer {
    constructor({stack}) {
      this.stack = stack;
      this.styleId = '__screenshot_extension_hide_root_scrollbars';
      this.containerAttribute = 'data-screenshot-extension-scroll-container';
      this.prepared = false;
    }

    prepare() {
      if (this.prepared || document.getElementById(this.styleId)) {
        return {
          hidden: false
        };
      }

      const style = document.createElement('style');
      style.id = this.styleId;
      const internalContainer = new globalThis.ScreenshotExtensionScrollTargetFinder().findMainInternalScrollContainer();
      const internalSelector = internalContainer ? `[${this.containerAttribute}="main"]` : '';

      if (internalContainer) {
        this.stack.setAttribute(internalContainer, this.containerAttribute, 'main');
      }

      style.textContent = `
        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        *::-webkit-scrollbar${internalSelector ? `,\n        ${internalSelector}::-webkit-scrollbar` : ''} {
          width: 0 !important;
          height: 0 !important;
        }

        html,
        body,
        *${internalSelector ? `,\n        ${internalSelector}` : ''} {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
      `;

      this.stack.appendNode(document.documentElement, style);
      this.prepared = true;

      return {
        rootHidden: true,
        internalContainerHidden: Boolean(internalContainer)
      };
    }
  }

  globalThis.ScreenshotExtensionScrollbarNormalizer = ScrollbarNormalizer;
})();
