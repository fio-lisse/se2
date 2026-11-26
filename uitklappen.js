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
openAnchor(location.hash);

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
    const state = image && (!navigator.clipboard?.write || !window.ClipboardItem ||
      ClipboardItem.supports?.('image/png') === false) ? 'download' : 'copy';
    const control = {source, filename, image, labels, pending: false};
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

  const main = document.querySelector('main');
  mount(main);
  const stage = main.querySelector('#stagebody');
  if (stage) {
    new MutationObserver(() => mount(stage)).observe(stage, {childList: true});
  }
})();
