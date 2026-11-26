/* Google Translate widget bootstrap (external file so the CSP can forbid inline scripts).
 * The widget script is injected ONCE, after the page has loaded and gone idle, so it never
 * delays the first paint. (Loading it twice caused repeated "Maximum call stack" errors.) */
function googleTranslateElementInit() {
  if (window.__dgcGtInit) return;
  window.__dgcGtInit = true;
  try {
    new google.translate.TranslateElement(
      {
        pageLanguage: 'am',
        includedLanguages: 'am,en,om,ti,so',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false,
      },
      'gt-mount-point'
    );
  } catch (e) {
    console.warn('Google Translate widget failed to initialise:', e);
  }
}
(function () {
  if (window.__dgcGtScheduled) return;
  window.__dgcGtScheduled = true;
  function inject() {
    if (document.getElementById('gt-script')) return;
    var s = document.createElement('script');
    s.id = 'gt-script';
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    s.async = true;
    document.head.appendChild(s);
  }
  function schedule() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(inject, { timeout: 6000 });
    else setTimeout(inject, 3000);
  }
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule);
})();
