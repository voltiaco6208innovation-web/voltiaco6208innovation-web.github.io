/** Navegación O&M consistente */
(function (g) {
  const LINKS = [
    { href: 'control-center.html', label: 'Control Center' },
    { href: 'monitor.html', label: 'Monitor' },
    { href: 'industrial-3d.html', label: '3D Plant' },
    { href: 'performance.html', label: 'Performance' },
    { href: 'environment.html', label: 'Environment' },
    { href: 'incidents.html', label: 'Alarms / Incidents' },
    { href: 'maintenance.html', label: 'Maintenance' },
    { href: 'events.html', label: 'Event History' },
    { href: 'admin.html', label: 'Admin' },
    { href: 'control.html', label: 'Personal' },
    { href: 'index.html', label: 'Home' }
  ];
  function inject(active) {
    var el = document.getElementById('om-nav');
    if (!el) return;
    var path = (location.pathname.split('/').pop() || 'index.html');
    el.innerHTML = LINKS.map(function (l) {
      var on = (active || path) === l.href || path === l.href;
      return '<a href="' + l.href + '" class="' + (on ? 'on' : '') + '">' + l.label + '</a>';
    }).join('');
  }
  g.AEROVOLT_NAV = { inject: inject, links: LINKS };
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () { inject(); });
  }
})(typeof window !== 'undefined' ? window : global);
