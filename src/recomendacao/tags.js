// Tags do Last.fm e gêneros do Spotify viram "gêneros" limpos e comparáveis.
const { normalizar } = require("../comum/texto");

// Tags do Last.fm que não são gênero.
const NAO_E_GENERO = /^(seen live|favou?rites?|favou?rite artists?|all|spotify|albums i own|under \d+ listeners|beautiful|awesome|love|cool|\d{2,4}s?|male vocalists?|female vocalists?)$/;

// Minúsculas, hífen vira espaço, sem repetidas, sem as que não são gênero.
function limparTags(tags) {
  const vistos = new Set();
  return (tags || [])
    .map((t) => normalizar(String(t)).replace(/-/g, " "))
    .filter((t) => t && t.length <= 30 && !NAO_E_GENERO.test(t) && !vistos.has(t) && vistos.add(t));
}

// "post rock" -> "Post rock"
const titulo = (tag) => tag.charAt(0).toUpperCase() + tag.slice(1);

module.exports = { limparTags, titulo };
