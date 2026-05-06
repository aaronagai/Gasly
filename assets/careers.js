/* Exclusive accordion: only one role open at a time (fallback where details[name] is unsupported). */
(function () {
  var roles = document.querySelectorAll('.careers-roles .careers-role');
  if (!roles.length) return;

  roles.forEach(function (details) {
    details.addEventListener('toggle', function () {
      if (!details.open) return;
      roles.forEach(function (other) {
        if (other !== details) other.removeAttribute('open');
      });
    });
  });
})();
