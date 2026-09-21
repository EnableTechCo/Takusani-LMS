/* Prototype-only helper. Not part of the design system and not to be ported.
 *
 * <body data-proto-screen="P0-04" data-proto-title="Task detail and submission"
 *       data-proto-frs="FR-308 FR-309 FR-310 FR-311"
 *       data-proto-states="default:On time|late:After the due date|uploading:Upload interrupted">
 *
 * Any element with data-proto-state="late uploading" is shown only in those states.
 * An element with data-proto-state="!late" is shown in every state except that one.
 * The current state lives in the URL hash (#state=late) so states can be linked to.
 */
(function () {
  var body = document.body;
  var states = (body.getAttribute('data-proto-states') || '')
    .split('|').map(function (s) { return s.trim(); }).filter(Boolean)
    .map(function (s) { var i = s.indexOf(':'); return i < 0 ? { id: s, label: s } : { id: s.slice(0, i).trim(), label: s.slice(i + 1).trim() }; });

  // An in-page link (skip link, error summary, section switcher) changes the hash
  // without naming a state; the screen must stay in the state it was in.
  var last = '';
  function current() {
    var m = /state=([\w-]+)/.exec(location.hash);
    var id = m && m[1];
    if (id && states.some(function (s) { return s.id === id; })) { last = id; return id; }
    if (last) return last;
    last = states.length ? states[0].id : '';
    return last;
  }

  function apply() {
    var now = current();
    body.setAttribute('data-proto-current', now);
    document.querySelectorAll('[data-proto-state]').forEach(function (el) {
      var list = el.getAttribute('data-proto-state').split(/\s+/).filter(Boolean);
      var negated = list.filter(function (s) { return s.charAt(0) === '!'; }).map(function (s) { return s.slice(1); });
      var positive = list.filter(function (s) { return s.charAt(0) !== '!'; });
      var show = positive.length ? positive.indexOf(now) >= 0 : true;
      if (negated.indexOf(now) >= 0) show = false;
      el.hidden = !show;
    });
    panel.querySelectorAll('[data-proto-go]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-proto-go') === now));
    });
    document.dispatchEvent(new CustomEvent('proto:state', { detail: { state: now } }));
  }

  var panel = document.createElement('details');
  panel.className = 'proto-panel';
  panel.open = states.length > 1 && window.matchMedia('(min-width: 64rem)').matches;
  var screen = body.getAttribute('data-proto-screen') || '';
  var title = body.getAttribute('data-proto-title') || document.title;
  var frs = body.getAttribute('data-proto-frs') || '';
  var html = '<summary class="proto-panel__summary">Prototype controls</summary><div class="proto-panel__body">' +
    '<p class="proto-panel__note">Not part of the design.</p>' +
    '<p class="proto-panel__screen"><strong>' + screen + '</strong> ' + title + '</p>' +
    (frs ? '<p class="proto-panel__frs">' + frs + '</p>' : '');
  if (states.length > 1) {
    html += '<p class="proto-panel__label">Show this screen as</p><div class="proto-panel__states">' +
      states.map(function (s) { return '<button type="button" class="proto-panel__state" data-proto-go="' + s.id + '">' + s.label + '</button>'; }).join('') + '</div>';
  }
  html += '<a class="proto-panel__home" href="index.html">All screens</a></div>';
  panel.innerHTML = html;
  body.appendChild(panel);

  panel.addEventListener('click', function (e) {
    var b = e.target.closest('[data-proto-go]');
    if (!b) return;
    location.hash = 'state=' + b.getAttribute('data-proto-go');
  });
  window.addEventListener('hashchange', apply);
  apply();
})();
