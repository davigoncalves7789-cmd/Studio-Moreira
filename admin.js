// ── Conexão com o Supabase ─────────────────────────────────────────
// Mesma URL e mesma chave "publishable" usadas no site principal.
// A proteção de verdade não é essa chave (ela é pública por design),
// e sim: 1) o login abaixo (Supabase Auth) e 2) as regras de RLS que
// exigem estar autenticado pra inserir/editar/apagar produtos.
const SUPABASE_URL = 'https://padjfxslzjhgtqujdkbx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_50YMqseOFR5Yma5AF1FCuQ_Y5xVaHBj';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const telaLogin = document.getElementById('tela-login');
const telaAdmin = document.getElementById('tela-admin');

function mostrarAdmin() {
  telaLogin.classList.add('oculto');
  telaAdmin.classList.remove('oculto');
  carregarListaProdutos();
}

function mostrarLogin() {
  telaAdmin.classList.add('oculto');
  telaLogin.classList.remove('oculto');
}

// Se já existir uma sessão válida (login anterior), pula direto pro painel
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) mostrarAdmin();
});

// ── Login ────────────────────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erroEl = document.getElementById('login-erro');
  erroEl.textContent = '';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
  if (error) {
    erroEl.textContent = 'E-mail ou senha incorretos.';
    return;
  }
  mostrarAdmin();
});

document.getElementById('btn-sair').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  mostrarLogin();
});

// ── Preview da foto escolhida ───────────────────────────────────────
const inputFoto = document.getElementById('produto-foto');
const previewFoto = document.getElementById('produto-preview');
inputFoto.addEventListener('change', () => {
  const arquivo = inputFoto.files[0];
  if (!arquivo) {
    previewFoto.classList.add('oculto');
    return;
  }
  previewFoto.src = URL.createObjectURL(arquivo);
  previewFoto.classList.remove('oculto');
});

// ── Gera um id único e legível a partir do nome do produto ──────────
function gerarId(nome) {
  const slug = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${slug}-${Date.now()}`;
}

async function subirFoto(arquivo, id) {
  const extensao = arquivo.name.split('.').pop();
  const caminho = `${id}.${extensao}`;

  const { error } = await supabaseClient.storage
    .from('produtos-fotos')
    .upload(caminho, arquivo);

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from('produtos-fotos')
    .getPublicUrl(caminho);

  return data.publicUrl;
}

// ── Adicionar produto ────────────────────────────────────────────
document.getElementById('form-produto').addEventListener('submit', async (e) => {
  e.preventDefault();

  const erroEl = document.getElementById('produto-erro');
  const sucessoEl = document.getElementById('produto-sucesso');
  const btn = document.getElementById('btn-salvar-produto');
  erroEl.textContent = '';
  sucessoEl.textContent = '';

  const nome = document.getElementById('produto-nome').value.trim();
  const categoria = document.getElementById('produto-categoria').value;
  const itensTexto = document.getElementById('produto-itens').value.trim();
  const preco = document.getElementById('produto-preco').value.trim();
  const arquivo = inputFoto.files[0];

  if (!nome || !categoria || !itensTexto || !preco || !arquivo) {
    erroEl.textContent = 'Preenche todos os campos, incluindo a foto.';
    return;
  }

  const itens = itensTexto.split('\n').map(l => l.trim()).filter(Boolean);
  const id = gerarId(nome);

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const imagemUrl = await subirFoto(arquivo, id);

    const { error } = await supabaseClient.from('produtos').insert({
      id,
      categoria,
      nome_exibicao: nome,
      nome_busca: nome,
      desc_busca: itens.join(', '),
      nome_carrinho: nome,
      imagem_url: imagemUrl,
      imagem_alt: nome,
      itens,
      preco,
    });

    if (error) throw error;

    sucessoEl.textContent = 'Produto adicionado! Já está no ar.';
    e.target.reset();
    previewFoto.classList.add('oculto');
    carregarListaProdutos();
  } catch (err) {
    console.error('Erro ao adicionar produto:', err);
    erroEl.textContent = 'Não consegui salvar. Tenta de novo em alguns segundos.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar produto';
  }
});

// ── Listar / excluir produtos ────────────────────────────────────
const NOMES_CATEGORIA = {
  buques: 'Buquês',
  glitter: 'Buquês com Glitter',
  personalizados: 'Buquês Personalizados',
  cestas: 'Cestas Personalizadas',
};

async function carregarListaProdutos() {
  const lista = document.getElementById('lista-produtos');
  lista.innerHTML = '<p class="carregando">Carregando...</p>';

  const { data, error } = await supabaseClient
    .from('produtos')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    lista.innerHTML = '<p class="mensagem-erro">Não consegui carregar os produtos.</p>';
    return;
  }

  if (!data || data.length === 0) {
    lista.innerHTML = '<p class="carregando">Nenhum produto cadastrado ainda.</p>';
    return;
  }

  lista.innerHTML = '';
  data.forEach(p => {
    const linha = document.createElement('div');
    linha.className = 'produto-linha';
    linha.innerHTML = `
      <img src="${p.imagem_url}" alt="">
      <div class="info">
        <div class="nome">${p.nome_exibicao}</div>
        <div class="meta">${NOMES_CATEGORIA[p.categoria] || p.categoria} · R$ ${p.preco}</div>
      </div>
      <button class="btn-excluir" data-id="${p.id}">Excluir</button>
    `;
    lista.appendChild(linha);
  });

  lista.querySelectorAll('.btn-excluir').forEach(btn => {
    btn.addEventListener('click', () => excluirProduto(btn.dataset.id));
  });
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que quer excluir esse produto? Essa ação não pode ser desfeita.')) return;

  const { error } = await supabaseClient.from('produtos').delete().eq('id', id);
  if (error) {
    alert('Não consegui excluir. Tenta de novo.');
    return;
  }
  carregarListaProdutos();
}
