(function () {
  var form = document.getElementById('inquiry');
  var msg = document.getElementById('msg');
  var typeSelect = document.getElementById('org_type');

  // "Hubungi kami" buttons preselect the organization type.
  document.querySelectorAll('a[data-type]').forEach(function (a) {
    a.addEventListener('click', function () {
      typeSelect.value = a.getAttribute('data-type');
    });
  });

  function show(text, ok) {
    msg.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'msg ' + (ok ? 'ok' : 'err');
    div.textContent = text;
    msg.appendChild(div);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]');
    var data = {
      org_type: form.org_type.value,
      org_name: form.org_name.value,
      contact_name: form.contact_name.value,
      position: form.position.value,
      phone: form.phone.value,
      email: form.email.value,
      size: form.size.value,
      message: form.message.value,
      website: form.website.value,
      consent: form.consent.checked
    };
    btn.disabled = true;
    fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(r.body.error || 'Gagal mengirim. Silakan coba lagi.');
        form.reset();
        show('Terima kasih! Pesan Anda sudah kami terima. Kami akan menghubungi Anda dalam 2 hari kerja.', true);
      })
      .catch(function (err) {
        show(err.message || 'Gagal mengirim. Silakan coba lagi.', false);
      })
      .finally(function () {
        btn.disabled = false;
      });
  });
})();
