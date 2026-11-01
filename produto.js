// ── Página do produto (produto.html?id=...) ─────────────────────────
// Mesma URL e chave "publishable" do site. A proteção real do banco
// são as regras de RLS no Supabase, não o sigilo dessa chave.
const SUPABASE_URL = 'https://padjfxslzjhgtqujdkbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_50YMqseOFR5Yma5AF1FCuQ_Y5xVaHBj';
const WHATSAPP_NUMERO = '5516992631717';
const CARRINHO_STORAGE_KEY = 'studio-moreira:carrinho'; // mesma chave da loja

// Se o CDN do Supabase não carregar a tempo, supabaseClient fica null e
// a página cai direto no produtos.json local (mesma lógica da loja).
const supabaseClient = (typeof window.supabase !== 'undefined')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const CATEGORIA_LABEL = {
  buques: 'Buquês',
  glitter: 'Buquês com Glitter',
  personalizados: 'Buquês Personalizados',
  cestas: 'Cestas Personalizadas',
  escritorio: 'Escritório',
};

// Mesmo formato que a loja usa (scripts.js), pra os dois conversarem.
function mapearProdutoDoBanco(row) {
  return {
    id: row.id,
    categoria: row.categoria,
    nomeExibicao: row.nome_exibicao,
    nomeCarrinho: row.nome_carrinho,
    descBusca: row.desc_busca,
    imagem: row.imagem_url,
    imagemAlt: row.imagem_alt,
    itens: row.itens || [],
    preco: row.preco,
    imagensExtras: Array.isArray(row.imagens_extras) ? row.imagens_extras : [],
  };
}

// null = o produto não existe. Só cai pro produtos.json se o Supabase
// falhar de verdade (fora do ar, sem CDN) — não quando ele responde
// "esse id não existe".
async function buscarProduto(id) {
  try {
    if (!supabaseClient) throw new Error('Cliente Supabase indisponível');
    const { data, error } = await supabaseClient
      .from('produtos').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapearProdutoDoBanco(data) : null;
  } catch (err) {
    console.error('Erro ao buscar no Supabase, usando produtos.json como backup:', err);
    const resp = await fetch('produtos.json');
    if (!resp.ok) throw new Error(`Falha ao carregar produtos.json (status ${resp.status})`);
    const lista = await resp.json();
    return lista.find(p => p.id === id) || null;
  }
}

// ── Galeria ──────────────────────────────────────────────────────
let fotos = [];
let fotoIndex = 0;
let fotoAlt = '';

const imgPrincipal = document.getElementById('foto-principal');
const btnAnt = document.getElementById('galeria-ant');
const btnProx = document.getElementById('galeria-prox');
const contador = document.getElementById('galeria-contador');
const thumbsEl = document.getElementById('galeria-thumbs');

function irParaFoto(i) {
  const total = fotos.length;
  if (total === 0) return;
  fotoIndex = ((i % total) + total) % total;

  imgPrincipal.src = fotos[fotoIndex];
  imgPrincipal.alt = total > 1 ? `${fotoAlt} (foto ${fotoIndex + 1} de ${total})` : fotoAlt;
  contador.textContent = `${fotoIndex + 1} / ${total}`;

  thumbsEl.querySelectorAll('.galeria-thumb').forEach((t, idx) => {
    const ativa = idx === fotoIndex;
    t.classList.toggle('ativa', ativa);
    if (ativa) {
      t.setAttribute('aria-current', 'true');
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else {
      t.removeAttribute('aria-current');
    }
  });
}

function montarGaleria(p) {
  fotos = [p.imagem, ...(Array.isArray(p.imagensExtras) ? p.imagensExtras : [])].filter(Boolean);
  fotoAlt = p.imagemAlt || p.nomeExibicao;

  const varias = fotos.length > 1;
  [btnAnt, btnProx, contador, thumbsEl].forEach(el => el.classList.toggle('oculto', !varias));

  thumbsEl.innerHTML = '';
  if (varias) {
    fotos.forEach((url, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'galeria-thumb';
      btn.setAttribute('aria-label', `Ver foto ${i + 1} de ${fotos.length}`);
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.decoding = 'async';
      btn.appendChild(img);
      btn.addEventListener('click', () => irParaFoto(i));
      thumbsEl.appendChild(btn);
    });
  }
  irParaFoto(0);
}

btnAnt.addEventListener('click', () => irParaFoto(fotoIndex - 1));
btnProx.addEventListener('click', () => irParaFoto(fotoIndex + 1));

// Deslizar o dedo na foto troca de foto (celular).
(function ativarSwipe() {
  const area = document.getElementById('galeria-principal');
  let inicioX = null;
  area.addEventListener('touchstart', e => { inicioX = e.touches[0].clientX; }, { passive: true });
  area.addEventListener('touchend', e => {
    if (inicioX === null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    inicioX = null;
    if (Math.abs(dx) > 40) irParaFoto(fotoIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();

// ── Lightbox (foto ampliada) ───────────────────────────────────────
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

function abrirLightbox() {
  lightboxImg.src = imgPrincipal.src;
  lightboxImg.alt = imgPrincipal.alt;
  lightbox.classList.remove('oculto');
}
function fecharLightbox() { lightbox.classList.add('oculto'); }

imgPrincipal.addEventListener('click', abrirLightbox);
lightbox.addEventListener('click', fecharLightbox);
lightboxImg.addEventListener('click', e => e.stopPropagation());

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharLightbox();
  if (document.getElementById('produto').classList.contains('oculto')) return;
  if (e.key === 'ArrowLeft') irParaFoto(fotoIndex - 1);
  if (e.key === 'ArrowRight') irParaFoto(fotoIndex + 1);
});

// ── Carrinho (mesmo localStorage da loja) ────────────────────────────
function lerCarrinho() {
  try {
    const dados = JSON.parse(localStorage.getItem(CARRINHO_STORAGE_KEY) || '[]');
    if (!Array.isArray(dados)) return [];
    return dados
      .filter(i => i && typeof i.nome === 'string' && typeof i.preco === 'string')
      .map(i => ({ ...i, quantidade: Number.isInteger(i.quantidade) && i.quantidade > 0 ? i.quantidade : 1 }));
  } catch (err) {
    console.warn('Não foi possível ler o carrinho salvo:', err);
    return [];
  }
}

function atualizarContadorCarrinho() {
  const total = lerCarrinho().reduce((s, i) => s + i.quantidade, 0);
  document.getElementById('carrinho-count').textContent = total;
}

function adicionarAoCarrinho(p, btn) {
  const carrinho = lerCarrinho();
  const nome = p.nomeCarrinho || p.nomeExibicao;
  const existente = carrinho.find(i => i.nome === nome && i.preco === p.preco);
  if (existente) {
    existente.quantidade += 1;
  } else {
    carrinho.push({ nome, preco: p.preco, descricao: p.descBusca || '', quantidade: 1 });
  }
  try {
    localStorage.setItem(CARRINHO_STORAGE_KEY, JSON.stringify(carrinho));
  } catch (err) {
    console.warn('Não foi possível salvar o carrinho:', err);
  }
  atualizarContadorCarrinho();

  const original = btn.textContent;
  btn.textContent = '✓ Adicionado!';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1400);
}

// ── Montagem da página ─────────────────────────────────────────────
function mostrarProduto(p) {
  document.title = `${p.nomeExibicao} — Studio Moreira`;
  const resumo = (p.itens || []).join(', ');
  document.getElementById('meta-descricao').setAttribute('content',
    `${p.nomeExibicao} em Franca SP — ${resumo}. R$ ${p.preco}. Encomende pelo WhatsApp!`);

  document.getElementById('produto-categoria').textContent = CATEGORIA_LABEL[p.categoria] || p.categoria;
  document.getElementById('produto-titulo').textContent = p.nomeExibicao;
  document.getElementById('produto-preco').textContent = `R$ ${p.preco}`;

  const lista = document.getElementById('produto-itens');
  lista.innerHTML = '';
  (p.itens || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item; // textContent: o texto vem do admin, nunca vira HTML
    lista.appendChild(li);
  });

  montarGaleria(p);

  const btnCarrinho = document.getElementById('btn-carrinho');
  btnCarrinho.addEventListener('click', () => adicionarAoCarrinho(p, btnCarrinho));

  const texto = `Olá! Tenho uma dúvida sobre o produto: ${p.nomeExibicao} (R$ ${p.preco}).`;
  document.getElementById('btn-whatsapp').href =
    `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;

  document.getElementById('estado').classList.add('oculto');
  document.getElementById('produto').classList.remove('oculto');
}

function mostrarNaoEncontrado(mensagemErro) {
  document.getElementById('estado').classList.add('oculto');
  const caixa = document.getElementById('nao-encontrado');
  if (mensagemErro) caixa.querySelector('p').textContent = mensagemErro;
  caixa.classList.remove('oculto');
}

window.addEventListener('load', async () => {
  atualizarContadorCarrinho();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) return mostrarNaoEncontrado();

  try {
    const produto = await buscarProduto(id);
    if (produto) mostrarProduto(produto);
    else mostrarNaoEncontrado();
  } catch (err) {
    console.error('Erro ao carregar o produto:', err);
    mostrarNaoEncontrado('Não conseguimos carregar o produto agora. Tente novamente em instantes.');
  }
});
