import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');

class FakeStyle {
  constructor() {
    this.values = new Map();
    this.priorities = new Map();
  }

  getPropertyValue(property) {
    return this.values.get(property) || '';
  }

  getPropertyPriority(property) {
    return this.priorities.get(property) || '';
  }

  setProperty(property, value, priority = '') {
    this.values.set(property, String(value));
    this.priorities.set(property, priority || '');
  }

  removeProperty(property) {
    const value = this.getPropertyValue(property);
    this.values.delete(property);
    this.priorities.delete(property);
    return value;
  }
}

class FakeElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.style = new FakeStyle();
    this.shadowRoot = null;
    this.computedPosition = 'static';
  }

  appendChild(node) {
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelectorAll(selector) {
    const results = [];
    const visit = node => {
      for (const child of node.childNodes) {
        if (selector === '*' || child.matchesSelector(selector)) {
          results.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return results;
  }

  matchesSelector(selector) {
    const attributeMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (!attributeMatch) {
      return selector === '*';
    }

    const [, name, expected] = attributeMatch;
    if (!this.hasAttribute(name)) {
      return false;
    }
    return expected === undefined || this.getAttribute(name) === expected;
  }

  getRootNode() {
    let current = this;
    while (current.parentNode) {
      current = current.parentNode;
    }
    return current instanceof FakeShadowRoot ? current : this.ownerDocument;
  }
}

class FakeShadowRoot extends FakeElement {
  constructor(ownerDocument) {
    super('#shadow-root', ownerDocument);
  }
}

class FakeDocument {
  constructor() {
    this.documentElement = new FakeElement('html', this);
    this.head = new FakeElement('head', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

const document = new FakeDocument();
const lightSticky = document.createElement('aside');
lightSticky.computedPosition = 'sticky';
document.body.appendChild(lightSticky);

const shadowHost = document.createElement('section');
shadowHost.shadowRoot = new FakeShadowRoot(document);
const shadowSticky = document.createElement('nav');
shadowSticky.computedPosition = 'sticky';
shadowSticky.style.setProperty('top', '12px');
shadowHost.shadowRoot.appendChild(shadowSticky);
document.body.appendChild(shadowHost);

const context = vm.createContext({
  document,
  window: {
    innerWidth: 1200,
    innerHeight: 800
  },
  getComputedStyle(element) {
    return {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      position: element.computedPosition || 'static'
    };
  },
  globalThis: null,
  self: null
});
context.globalThis = context;
context.self = context;

for (const relativePath of [
  'code/content/DomMutationStack.js',
  'code/content/FixedStickyNormalizer.js',
  'code/capture/ContentAgentClient.js'
]) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  vm.runInContext(source, context, {filename: relativePath});
}

const stack = new context.ScreenshotExtensionDomMutationStack();
const normalizer = new context.ScreenshotExtensionFixedStickyNormalizer({stack});

const result = normalizer.prepareStickyNormalization({
  capturePolicy: {mode: 'full-page'}
});

assert.equal(result.applied, true);
assert.equal(result.normalized, 2);
assert.equal(result.shadowRootCount, 1);
assert.equal(result.ruleRootCount, 2);
assert.equal(lightSticky.getAttribute('data-screenshot-extension-sticky-normalized'), 'true');
assert.equal(shadowSticky.getAttribute('data-screenshot-extension-sticky-normalized'), 'true');
assert.equal(lightSticky.style.getPropertyValue('position'), 'relative');
assert.equal(lightSticky.style.getPropertyPriority('position'), 'important');
assert.equal(lightSticky.style.getPropertyValue('top'), 'auto');
assert.equal(shadowSticky.style.getPropertyValue('top'), 'auto');
assert.equal(document.head.querySelectorAll('[data-screenshot-extension-sticky-normalization]').length, 1);
assert.equal(shadowHost.shadowRoot.querySelectorAll('[data-screenshot-extension-sticky-normalization]').length, 1);

const client = new context.ContentAgentClient({chrome: null});
const aggregate = client.aggregateFrameResults([
  {
    result: {
      stickyNormalization: result,
      mutations: 2
    }
  },
  {
    result: {
      applied: true,
      normalized: 1,
      shadowRootCount: 0,
      ruleRootCount: 1,
      reason: 'raw-sticky-result',
      mutations: 1
    }
  }
]).stickyNormalization;

assert.equal(aggregate.applied, true);
assert.equal(aggregate.normalized, 3);
assert.equal(aggregate.framesWithNormalizedSticky, 2);
assert.equal(aggregate.shadowRootCount, 1);
assert.equal(aggregate.ruleRootCount, 3);
assert.deepEqual(Array.from(aggregate.reasons), [
  'blanket-sticky-to-relative',
  'raw-sticky-result'
]);

stack.restoreAll();

assert.equal(lightSticky.hasAttribute('data-screenshot-extension-sticky-normalized'), false);
assert.equal(shadowSticky.hasAttribute('data-screenshot-extension-sticky-normalized'), false);
assert.equal(lightSticky.style.getPropertyValue('position'), '');
assert.equal(lightSticky.style.getPropertyValue('top'), '');
assert.equal(shadowSticky.style.getPropertyValue('top'), '12px');
assert.equal(document.head.querySelectorAll('[data-screenshot-extension-sticky-normalization]').length, 0);
assert.equal(shadowHost.shadowRoot.querySelectorAll('[data-screenshot-extension-sticky-normalization]').length, 0);

console.log('sticky-cleanup-smoke: ok');
