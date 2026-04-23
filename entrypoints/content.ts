const KEEP_ATTRS = new Set(['id', 'name', 'type', 'placeholder', 'for', 'aria-label', 'aria-labelledby']);

function stripHTML(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, svg, img, noscript').forEach(el => el.remove());
  clone.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP_ATTRS.has(attr.name) && !(el.tagName === 'OPTION' && attr.name === 'value')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return clone.outerHTML;
}

function getFormHTML(): string {
  const forms = Array.from(document.querySelectorAll('form'));
  const roots = forms.length ? forms : [document.body];
  return roots.map(stripHTML).join('\n').slice(0, 6_000);
}

function fillFields(values: Record<string, string>) {
  for (const [selector, value] of Object.entries(values)) {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
    if (!el) continue;

    if (el.tagName === 'SELECT') {
      (el as HTMLSelectElement).value = value;
    } else {
      (el as HTMLInputElement).value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'getFormHTML') {
        sendResponse({ html: getFormHTML() });
      } else if (message.type === 'fillFields') {
        fillFields(message.values);
        sendResponse({ ok: true });
      }
      return true;
    });
  },
});
