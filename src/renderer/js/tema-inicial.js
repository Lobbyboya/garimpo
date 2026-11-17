// Aplica o último tema usado antes de a página aparecer, para não piscar o tema padrão.
// (Script comum e síncrono no <head>; o tema oficial vem da config logo depois, em aparencia.js.)
try {
  const tema = localStorage.getItem("garimpo-tema");
  if (tema && /^[a-z0-9-]{1,30}$/.test(tema)) document.documentElement.dataset.tema = tema;
} catch {
  // sem localStorage: fica o padrão
}
