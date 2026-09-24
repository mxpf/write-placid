import assert from "node:assert/strict";
import test from "node:test";
import { attachScrollFade, scrollFadeDefaults } from "../site/scroll-fade.mjs";

function createElement() {
  const attributes = new Map();
  const properties = new Map();
  return {
    attributes,
    properties,
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); },
    },
  };
}

function observerHarness({ failObserve = false } = {}) {
  const state = { callback: null, disconnected: false, observed: null, options: null };
  class Observer {
    constructor(callback, options) {
      state.callback = callback;
      state.options = options;
    }
    observe(element) {
      if (failObserve) throw new Error("observer unavailable");
      state.observed = element;
    }
    disconnect() { state.disconnected = true; }
  }
  return { Observer, state };
}

test("shared scroll fade follows intersection ratio in both directions", () => {
  const element = createElement();
  const { Observer, state } = observerHarness();
  const cleanup = attachScrollFade(element, { IntersectionObserver: Observer, matchMedia: () => ({ matches: false }) });

  assert.equal(element.attributes.has(scrollFadeDefaults.activeAttribute), true);
  assert.equal(element.properties.get(scrollFadeDefaults.opacityProperty), "0.6");
  assert.equal(state.options.threshold.length, 101);

  state.callback([{ intersectionRatio: 1 / 3 }]);
  assert.equal(element.properties.get(scrollFadeDefaults.opacityProperty), "0.8");
  state.callback([{ intersectionRatio: 2 / 3 }]);
  assert.equal(element.properties.get(scrollFadeDefaults.opacityProperty), "1");
  state.callback([{ intersectionRatio: 0 }]);
  assert.equal(element.properties.get(scrollFadeDefaults.opacityProperty), "0.6");

  cleanup();
  assert.equal(state.disconnected, true);
  assert.equal(element.attributes.has(scrollFadeDefaults.activeAttribute), false);
  assert.equal(element.properties.has(scrollFadeDefaults.opacityProperty), false);
});

test("missing or failed observers leave the image fully visible", () => {
  const missing = createElement();
  attachScrollFade(missing, { IntersectionObserver: null, matchMedia: () => ({ matches: false }) });
  assert.equal(missing.attributes.size, 0);
  assert.equal(missing.properties.size, 0);

  const failed = createElement();
  const { Observer, state } = observerHarness({ failObserve: true });
  attachScrollFade(failed, { IntersectionObserver: Observer, matchMedia: () => ({ matches: false }) });
  assert.equal(state.disconnected, true);
  assert.equal(failed.attributes.size, 0);
  assert.equal(failed.properties.size, 0);

  const failedMotionQuery = createElement();
  attachScrollFade(failedMotionQuery, {
    IntersectionObserver: Observer,
    matchMedia: () => { throw new Error("media query unavailable"); },
  });
  assert.equal(failedMotionQuery.attributes.size, 0);
  assert.equal(failedMotionQuery.properties.size, 0);
});

test("reduced motion leaves the image fully visible without an observer", () => {
  const element = createElement();
  const { Observer, state } = observerHarness();
  attachScrollFade(element, { IntersectionObserver: Observer, matchMedia: () => ({ matches: true }) });
  assert.equal(state.callback, null);
  assert.equal(element.attributes.size, 0);
  assert.equal(element.properties.size, 0);
});

test("installation-specific fade settings are supported", () => {
  const element = createElement();
  const { Observer, state } = observerHarness();
  attachScrollFade(element, {
    IntersectionObserver: Observer,
    matchMedia: () => ({ matches: false }),
    minimumOpacity: 0.75,
    fullyVisibleRatio: 0.5,
    thresholdSteps: 4,
  });
  state.callback([{ intersectionRatio: 0.25 }]);
  assert.equal(element.properties.get(scrollFadeDefaults.opacityProperty), "0.875");
  assert.deepEqual(state.options.threshold, [0, 0.25, 0.5, 0.75, 1]);
});
