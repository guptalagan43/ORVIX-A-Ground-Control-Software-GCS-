/**
 * ORVIX Ground Control Software — DOM Utilities
 *
 * Purpose: Thin, null-safe wrappers around common DOM operations.
 *          All functions handle missing elements gracefully so that
 *          callers never need to check for null before acting.
 *
 * Dependencies: None (loaded before all other modules)
 *
 * @module utils/dom
 */
"use strict";

const DOM = (function () {

  // ── Selectors ─────────────────────────────────────────────────

  /**
   * Return the first element matching a CSS selector.
   * @param {string} selector
   * @returns {Element|null}
   */
  function getElement(selector) {
    return document.querySelector(selector);
  }

  /**
   * Return all elements matching a CSS selector.
   * @param {string} selector
   * @returns {NodeList}
   */
  function getElements(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Return element by ID (faster than querySelector for IDs).
   * @param {string} id - Element ID without the # prefix
   * @returns {Element|null}
   */
  function byId(id) {
    return document.getElementById(id);
  }

  // ── Content ───────────────────────────────────────────────────

  /**
   * Set the text content of an element by CSS selector.
   * No-op if the element is not found.
   * @param {string} selector
   * @param {string|number} text
   */
  function setTextContent(selector, text) {
    var el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  /**
   * Set the text content of an element by ID.
   * No-op if element is not found.
   * @param {string} id
   * @param {string|number} text
   */
  function setTextById(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /**
   * Set the inner HTML of an element.
   * No-op if element is not found.
   * @param {string} selector
   * @param {string} html
   */
  function setHTML(selector, html) {
    var el = document.querySelector(selector);
    if (el) el.innerHTML = html;
  }

  /**
   * Set the inner HTML of an element by ID.
   * @param {string} id
   * @param {string} html
   */
  function setHTMLById(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // ── Classes ───────────────────────────────────────────────────

  /**
   * Add a class to an element found by selector.
   * @param {string} selector
   * @param {string} className
   */
  function addClass(selector, className) {
    var el = document.querySelector(selector);
    if (el) el.classList.add(className);
  }

  /**
   * Remove a class from an element found by selector.
   * @param {string} selector
   * @param {string} className
   */
  function removeClass(selector, className) {
    var el = document.querySelector(selector);
    if (el) el.classList.remove(className);
  }

  /**
   * Toggle a class on an element found by selector.
   * @param {string} selector
   * @param {string} className
   * @param {boolean} [force] - If provided, add (true) or remove (false)
   */
  function toggleClass(selector, className, force) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (force === undefined) {
      el.classList.toggle(className);
    } else {
      el.classList.toggle(className, force);
    }
  }

  /**
   * Add a class to an element by ID.
   * @param {string} id
   * @param {string} className
   */
  function addClassById(id, className) {
    var el = document.getElementById(id);
    if (el) el.classList.add(className);
  }

  /**
   * Remove a class from an element by ID.
   * @param {string} id
   * @param {string} className
   */
  function removeClassById(id, className) {
    var el = document.getElementById(id);
    if (el) el.classList.remove(className);
  }

  /**
   * Check if an element has a given class.
   * @param {string} selector
   * @param {string} className
   * @returns {boolean}
   */
  function hasClass(selector, className) {
    var el = document.querySelector(selector);
    return el ? el.classList.contains(className) : false;
  }

  // ── Visibility ────────────────────────────────────────────────

  /**
   * Hide an element (display: none).
   * @param {string} selector
   */
  function hideElement(selector) {
    var el = document.querySelector(selector);
    if (el) el.style.display = "none";
  }

  /**
   * Show a previously hidden element.
   * @param {string} selector
   * @param {string} [displayType='block']
   */
  function showElement(selector, displayType) {
    var el = document.querySelector(selector);
    if (el) el.style.display = displayType || "block";
  }

  /**
   * Hide an element by ID.
   * @param {string} id
   */
  function hideById(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  /**
   * Show an element by ID.
   * @param {string} id
   * @param {string} [displayType='block']
   */
  function showById(id, displayType) {
    var el = document.getElementById(id);
    if (el) el.style.display = displayType || "block";
  }

  // ── Creation ──────────────────────────────────────────────────

  /**
   * Create a new DOM element with optional class and innerHTML.
   * @param {string} tag - Element tag name
   * @param {string} [className] - CSS class string
   * @param {string} [innerHTML] - Inner HTML content
   * @returns {Element}
   */
  function createElement(tag, className, innerHTML) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }

  /**
   * Prepend a child element to a parent.
   * @param {string} parentSelector
   * @param {Element} child
   */
  function prepend(parentSelector, child) {
    var parent = document.querySelector(parentSelector);
    if (parent) parent.insertBefore(child, parent.firstChild);
  }

  /**
   * Append a child element to a parent.
   * @param {string} parentSelector
   * @param {Element} child
   */
  function append(parentSelector, child) {
    var parent = document.querySelector(parentSelector);
    if (parent) parent.appendChild(child);
  }

  // ── Attributes ────────────────────────────────────────────────

  /**
   * Set an attribute on an element.
   * @param {string} selector
   * @param {string} attr
   * @param {string} value
   */
  function setAttr(selector, attr, value) {
    var el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  /**
   * Set a CSS custom property on an element.
   * @param {string} selector
   * @param {string} property - CSS variable name including --
   * @param {string} value
   */
  function setCSSVar(selector, property, value) {
    var el = document.querySelector(selector);
    if (el) el.style.setProperty(property, value);
  }

  // ── Public interface ──────────────────────────────────────────

  return {
    getElement: getElement,
    getElements: getElements,
    byId: byId,
    setTextContent: setTextContent,
    setTextById: setTextById,
    setHTML: setHTML,
    setHTMLById: setHTMLById,
    addClass: addClass,
    removeClass: removeClass,
    toggleClass: toggleClass,
    addClassById: addClassById,
    removeClassById: removeClassById,
    hasClass: hasClass,
    hideElement: hideElement,
    showElement: showElement,
    hideById: hideById,
    showById: showById,
    createElement: createElement,
    prepend: prepend,
    append: append,
    setAttr: setAttr,
    setCSSVar: setCSSVar,
  };
})();
