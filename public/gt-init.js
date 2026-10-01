/* Google Translate widget bootstrap (external file so the CSP can forbid inline scripts) */
function googleTranslateElementInit() {
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
