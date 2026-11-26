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
