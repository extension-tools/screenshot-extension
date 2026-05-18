(function() {
  class DomMutationStack {
    constructor() {
      this.restoreSteps = [];
      this.mutationCount = 0;
    }

    push(restore) {
      this.restoreSteps.push(restore);
    }

    setStyle(element, property, value, priority = '') {
      const previousValue = element.style.getPropertyValue(property);
      const previousPriority = element.style.getPropertyPriority(property);

      this.push(() => {
        if (previousValue) {
          element.style.setProperty(property, previousValue, previousPriority);
        }
        else {
          element.style.removeProperty(property);
        }
      });

      element.style.setProperty(property, value, priority);
      this.mutationCount += 1;
    }

    appendNode(parent, node) {
      parent.appendChild(node);
      this.push(() => {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      });
      this.mutationCount += 1;
    }

    setAttribute(element, name, value) {
      const hadAttribute = element.hasAttribute(name);
      const previousValue = element.getAttribute(name);

      this.push(() => {
        if (hadAttribute) {
          element.setAttribute(name, previousValue);
        }
        else {
          element.removeAttribute(name);
        }
      });

      element.setAttribute(name, value);
      this.mutationCount += 1;
    }

    restoreAll() {
      while (this.restoreSteps.length) {
        const restore = this.restoreSteps.pop();
        try {
          restore();
        }
        catch (e) {}
      }
      this.mutationCount = 0;
    }

    count() {
      return this.mutationCount;
    }
  }

  globalThis.ScreenshotExtensionDomMutationStack = DomMutationStack;
})();
