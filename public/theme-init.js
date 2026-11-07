/*
 * Sets the colour theme before the page is drawn, so there is no flash of the
 * wrong colours. Loaded as a same-origin file because the Content Security
 * Policy blocks inline scripts. Reads the same local preferences as the app
 * (src/lib/storage.ts, key "myShifts.prefs.v1"); mirrors src/lib/theme.ts.
 * Nothing is sent anywhere.
 */
(function () {
  var palettes = ['stone', 'rose', 'sage', 'ocean', 'sand'];
  var prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem('myShifts.prefs.v1') || '{}') || {};
  } catch (e) {
    prefs = {};
  }
  var appearance = prefs.appearance === 'light' || prefs.appearance === 'dark' ? prefs.appearance : 'system';
  var mode = appearance;
  if (appearance === 'system') {
    mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.setAttribute('data-palette', palettes.indexOf(prefs.palette) >= 0 ? prefs.palette : 'stone');
  root.style.colorScheme = mode;
})();
