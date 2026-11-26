// Dit gebeurt in de head, vóór de browser de gedeelde stylesheet toepast.
(() => {
  const key = 'se2-thema';
  const root = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme: dark)');
  let radios = [];

  function updateRadios() {
    const choice = radios.find(radio => radio.value === root.dataset.theme);
    const fallback = radios.find(radio => radio.value === (dark.matches ? 'middernacht' : 'daglicht'));
    if (choice || fallback) (choice || fallback).checked = true;
  }

  function restoreTheme() {
    try {
      const saved = localStorage.getItem(key);
      if (saved) root.dataset.theme = saved;
      else delete root.dataset.theme;
    } catch { /* Bij geblokkeerde opslag geldt de systeemvoorkeur. */ }
    updateRadios();
  }

  restoreTheme();
  window.addEventListener('pageshow', restoreTheme);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) restoreTheme();
  });
  dark.addEventListener('change', updateRadios);
  document.addEventListener('DOMContentLoaded', () => {
    radios = [...document.querySelectorAll('.themes input[name="se2-theme"]')];
    updateRadios();
    for (const radio of radios) {
      radio.addEventListener('change', () => {
        root.dataset.theme = radio.value;
        try { localStorage.setItem(key, radio.value); } catch { /* De keuze werkt op deze pagina. */ }
      });
    }
  });
})();

function openAnchor(hash) {
  if (!hash) return;
  let id;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  let parent = target.closest('details');
  while (parent) {
    parent.open = true;
    parent = parent.parentElement.closest('details');
  }
  target.scrollIntoView();
}

window.addEventListener('hashchange', () => openAnchor(location.hash));
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!event.defaultPrevented && link?.hash === location.hash) openAnchor(location.hash);
});
document.addEventListener('DOMContentLoaded', () => openAnchor(location.hash));

// Gedeelde kopieerknoppen voor tekst, code en afbeeldingen.
(() => {
  const icons = {
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    success: '<path d="m5 12 4 4L19 6"/>',
    download: '<path d="M12 4v11m-4-4 4 4 4-4M5 16v4h14v-4"/>'
  };
  const controls = new WeakMap();

  function icon(shape) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + shape + '</svg>';
  }

  function prepare(button, source, label, filename, image = false) {
    if (controls.has(button)) return;
    button.classList.add('copy-button');
    const labels = {copy: label, success: 'Gekopieerd', download: 'Download'};
    for (const [state, text] of Object.entries(labels)) {
      const face = document.createElement('span');
      face.className = 'copy-face';
      face.dataset.face = state;
      face.innerHTML = icon(icons[state]);
      face.append(text);
      button.append(face);
    }
    const mail = source instanceof HTMLIFrameElement;
    const mime = image ? 'image/png' : mail ? 'text/html' : null;
    const state = mime && (!navigator.clipboard?.write || !window.ClipboardItem ||
      ClipboardItem.supports?.(mime) === false) ? 'download' : 'copy';
    const control = {source, filename, image, mail, labels, pending: false};
    controls.set(button, control);
    show(button, control, state);
  }

  function show(button, control, state) {
    clearTimeout(control.timer);
    button.dataset.copyState = state;
    const label = control.labels[state];
    button.setAttribute('aria-label', control.image && state !== 'success' ? label + ' afbeelding' : label);
    if (state === 'success') {
      control.timer = setTimeout(() => show(button, control, 'copy'), 1600);
    }
  }

  function mount(main) {
    for (const button of main.querySelectorAll('[data-copy-mail]')) {
      const frame = document.getElementById(button.dataset.copyMail);
      button.replaceChildren();
      prepare(button, frame, 'Kopieer mail', 'voorbeeldbeoordeling.html');
      function fit() {
        const doc = frame.contentDocument;
        const mail = doc.querySelector('.mail');
        if (!mail) return;
        const size = () => {
          const margin = parseFloat(doc.defaultView.getComputedStyle(doc.body).marginBottom);
          frame.height = Math.ceil(mail.getBoundingClientRect().bottom + margin);
        };
        new ResizeObserver(size).observe(mail);
        size();
        button.disabled = false;
      }
      button.disabled = true;
      frame.addEventListener('load', fit);
      fit();
    }
    for (const button of main.querySelectorAll('.ticket-copy > [data-copy]')) {
      if (controls.has(button)) continue;
      const label = button.textContent;
      button.replaceChildren();
      prepare(button, button.parentElement.querySelector('textarea'), label,
        button.dataset.copy === 'gemini' ? 'gemini-hulpvraag.txt' : button.dataset.copy + '.md');
    }
    for (const source of main.querySelectorAll('pre, img.inhoudsbeeld, img.b01-balletje')) {
      if (source.parentElement.classList.contains('copy-target')) continue;
      const image = source instanceof HTMLImageElement;
      const markdown = source.classList.contains('markdown');
      const frame = document.createElement(image ? 'span' : 'div');
      frame.className = 'copy-target ' + (image ? 'copy-image' : 'copy-code');
      if (source.classList.contains('b01-balletje')) frame.classList.add('copy-ball');
      source.before(frame);
      const toolbar = document.createElement('span');
      toolbar.className = 'copy-toolbar';
      const button = document.createElement('button');
      button.type = 'button';
      toolbar.append(button);
      frame.append(toolbar, source);
      const label = image ? 'Kopieer' : markdown ? 'Kopieer Markdown' : 'Kopieer code';
      prepare(button, source, label, markdown ? 'voorbeeld.md' : 'code.txt', image);
    }
  }

  function toPng(image) {
    return image.decode().then(() => {
      const canvas = document.createElement('canvas');
      const edge = Math.max(image.naturalWidth, image.naturalHeight);
      if (!edge) throw new Error('Afbeelding niet beschikbaar');
      const scale = Math.min(2400 / edge, Math.max(1, 2 * image.clientWidth / image.naturalWidth));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG niet beschikbaar')), 'image/png');
      });
    });
  }

  function save(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    save(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function download(control, value) {
    if (control.mail) {
      saveBlob(new Blob([mailContents(control.source).html], {type: 'text/html;charset=utf-8'}), control.filename);
      return;
    }
    if (!control.image) {
      saveBlob(new Blob([value], {type: 'text/plain;charset=utf-8'}), control.filename);
      return;
    }
    const url = control.source.currentSrc || control.source.src;
    const filename = decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'afbeelding.svg';
    try {
      saveBlob(await toPng(control.source), filename.replace(/\.[^.]+$/, '') + '.png');
    } catch {
      save(url, filename);
    }
  }

  function mailContents(frame) {
    const doc = frame.contentDocument;
    const mail = doc.querySelector('.mail');
    const wrap = doc.createElement('div');
    const clone = mail.cloneNode(true);
    wrap.append(clone);
    // Rich-text editors may discard a stylesheet. Inline the existing desktop rules for copying.
    const originals = [doc.body, mail, ...mail.querySelectorAll('*')];
    const copies = [wrap, clone, ...clone.querySelectorAll('*')];
    const rules = [...doc.styleSheets[0].cssRules].filter(rule => rule.type === CSSRule.STYLE_RULE);
    for (const [i, original] of originals.entries()) {
      for (const rule of rules) {
        if (original.matches(rule.selectorText)) {
          for (const property of rule.style) {
            copies[i].style.setProperty(property, rule.style.getPropertyValue(property));
          }
        }
      }
    }
    return {html: wrap.outerHTML, text: mail.innerText};
  }

  function legacyCopy(value, button) {
    const field = document.createElement('textarea');
    field.className = 'copy-buffer';
    field.value = value;
    field.readOnly = true;
    document.body.append(field);
    field.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
      button.focus({preventScroll: true});
    }
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('.copy-button');
    const control = controls.get(button);
    if (!control || control.pending) return;
    control.pending = true;
    const value = control.image ? '' : (control.source.value ?? control.source.textContent);
    try {
      if (button.dataset.copyState === 'download') {
        await download(control, value);
        return;
      }
      if (control.image) {
        // Start the clipboard write during the click, while canvas conversion runs.
        const png = toPng(control.source);
        // Some browsers refuse the write without consuming the promised blob.
        png.catch(() => {});
        await navigator.clipboard.write([new ClipboardItem({'image/png': png})]);
      } else if (control.mail) {
        const {html, text} = mailContents(control.source);
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], {type: 'text/html'}),
          'text/plain': new Blob([text], {type: 'text/plain'})
        })]);
      } else {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          if (!legacyCopy(value, button)) throw new Error('Klembord niet beschikbaar');
        }
      }
      show(button, control, 'success');
    } catch {
      show(button, control, 'download');
    } finally {
      control.pending = false;
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.matches('.se2, .issues')) return;
    const main = document.querySelector('main');
    mount(main);
    const stage = main.querySelector('#stagebody');
    if (stage) {
      new MutationObserver(() => mount(stage)).observe(stage, {childList: true});
    }
  });
})();
