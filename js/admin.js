import { db, auth } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. ELEMENTOS DE SEGURANÇA E TELA ---
const loginSection = document.getElementById('loginSection');
const painelAdmin = document.getElementById('painelAdmin');
const formLogin = document.getElementById('formLogin');
const btnLogout = document.getElementById('btnLogout');

// --- 2. ELEMENTOS DO ADMIN (DO CÓDIGO ANTIGO) ---
const form = document.getElementById('formProduto');
const lista = document.getElementById('listaAdmin');
const totalEl = document.getElementById('totalProdutos');
const baixoEl = document.getElementById('baixoEstoque'); 
const searchInput = document.getElementById('searchBar');
const filterSelect = document.getElementById('filterCategory');

// Elementos do Modal de Promoção
const modal = document.getElementById('modalPromo');
const nomeProdModal = document.getElementById('nomeProdutoModal');
const inputPrecoPromo = document.getElementById('novoPrecoPromo');
let produtoSelecionadoId = null; 
let todosProdutos = [];

// --- 3. LÓGICA DE AUTENTICAÇÃO (O GUARDIÃO) ---

// Monitora em tempo real: Está logado ou não?
onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- SE ESTIVER LOGADO ---
        console.log("Usuário autenticado:", user.email);
        loginSection.style.display = 'none';   // Esconde login
        painelAdmin.style.display = 'block';   // Mostra painel
        carregarEstoque();                     // Só agora carrega os dados!
    } else {
        // --- SE NÃO ESTIVER LOGADO ---
        loginSection.style.display = 'flex';   // Mostra login
        painelAdmin.style.display = 'none';    // Esconde painel
        lista.innerHTML = '';                  // Limpa dados da tela por segurança
    }
});

// Botão de Entrar (Login)
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailLogin').value;
    const senha = document.getElementById('senhaLogin').value;
    const btn = formLogin.querySelector('button');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...'; 
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        // Não precisa fazer nada aqui, o onAuthStateChanged vai detectar e abrir o painel
    } catch (error) {
        console.error(error);
        alert("❌ Acesso Negado! Verifique e-mail e senha.");
        btn.innerHTML = 'ENTRAR NO SISTEMA';
        btn.disabled = false;
    }
});

// Botão de Sair (Logout)
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        if(confirm("Tem certeza que deseja sair?")) {
            await signOut(auth);
            window.location.reload(); // Recarrega para garantir limpeza
        }
    });
}

// --- 4. FUNÇÕES ÚTEIS (FORMATAÇÃO E IMAGEM) ---

// Formata o input enquanto digita (R$ 1.200,00)
window.formatarMoedaInput = (elemento) => {
    let valor = elemento.value.replace(/\D/g, "");
    valor = (valor / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
    elemento.value = valor;
}

// Limpa formatação para salvar no banco (1200.00)
const converterPrecoParaBanco = (valorString) => {
    if (!valorString) return 0;
    let limpo = valorString.replace(/^R\$\s?/, "").replace(/\./g, "").replace(",", ".").trim();
    return parseFloat(limpo);
}

// Formata visualmente (R$ 1.200,00)
const formatarMoeda = (valor) => {
    return parseFloat(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Comprime imagem para Base64
const comprimirImagem = (arquivo) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(arquivo);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 800;
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(base64);
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

// --- 5. LÓGICA DO SISTEMA (CRUD) ---

async function carregarEstoque() {
    lista.innerHTML = '<p style="color:#aaa; text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Carregando estoque...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "iphones"));
        todosProdutos = [];
        let contaBaixoEstoque = 0;

        querySnapshot.forEach((doc) => {
            const dados = doc.data();
            const qtd = dados.quantidade ? parseInt(dados.quantidade) : 0;
            todosProdutos.push({ 
                id: doc.id, 
                ...dados, 
                quantidade: qtd,
                preco: parseFloat(dados.preco),
                precoAntigo: parseFloat(dados.precoAntigo || 0)
            });
            if (qtd < 2) contaBaixoEstoque++;
        });

        if(totalEl) totalEl.innerText = todosProdutos.length;
        if(baixoEl) baixoEl.innerText = contaBaixoEstoque;
        filtrar(); 
    } catch (error) {
        console.error("Erro:", error);
        lista.innerHTML = '<p style="color:red; text-align:center;">Erro de permissão ou conexão.</p>';
    }
}

function renderizarLista(produtos) {
    lista.innerHTML = '';
    if (produtos.length === 0) {
        lista.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Nenhum produto encontrado.</p>';
        return;
    }

    produtos.forEach((prod) => {
        let precoFormatado = formatarMoeda(prod.preco);
        let htmlPreco = precoFormatado;
        let textoBotaoPromo = "⚡ CRIAR OFERTA";
        let classeBotaoPromo = ""; 

        if (prod.precoAntigo && prod.precoAntigo > prod.preco) {
            let antigoFormatado = formatarMoeda(prod.precoAntigo);
            htmlPreco = `
                <span style="text-decoration:line-through; color:#777; font-size:0.9rem;">${antigoFormatado}</span> 
                <span style="color:#00e676; font-weight:bold;">${precoFormatado}</span>
            `;
            textoBotaoPromo = "❌ REMOVER OFERTA";
            classeBotaoPromo = "ativo"; 
        }

        lista.innerHTML += `
            <div class="card">
                <span class="cat-tag">${prod.categoria || 'Geral'}</span>
                <img src="${prod.imagem}" alt="${prod.modelo}">
                <div class="card-info" style="padding: 15px;">
                    <h3 style="font-size: 1rem;">${prod.modelo}</h3>
                    <small>${prod.detalhes}</small>
                    <div class="preco" style="font-size: 1.1rem; margin: 10px 0;">${htmlPreco}</div>
                    <div class="estoque-control">
                        <button class="qtd-btn" onclick="alterarQtd('${prod.id}', -1, ${prod.quantidade})">-</button>
                        <span class="qtd-display ${prod.quantidade == 0 ? 'sem-estoque' : ''}">${prod.quantidade}</span>
                        <button class="qtd-btn" onclick="alterarQtd('${prod.id}', 1, ${prod.quantidade})">+</button>
                    </div>
                    <button onclick="gerenciarPromo('${prod.id}', '${prod.modelo}', ${prod.preco}, '${prod.precoAntigo}')" 
                            class="btn-promo ${classeBotaoPromo}">
                        ${textoBotaoPromo}
                    </button>
                    <button onclick="deletarProduto('${prod.id}')" class="btn-delete">
                        <i class="fas fa-trash"></i> EXCLUIR
                    </button>
                </div>
            </div>
        `;
    });
}

// Cadastro com Login Protegido
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.innerHTML = 'Processando...'; btn.disabled = true;

    try {
        const arquivoInput = document.getElementById('imagemInput');
        if (!arquivoInput.files || arquivoInput.files.length === 0) throw new Error("Selecione uma imagem!");

        const imagemBase64 = await comprimirImagem(arquivoInput.files[0]);
        const precoInput = document.getElementById('preco').value;
        const precoFloat = converterPrecoParaBanco(precoInput);

        if (isNaN(precoFloat) || precoFloat === 0) throw new Error("Preço inválido!");

        await addDoc(collection(db, "iphones"), {
            modelo: document.getElementById('modelo').value,
            categoria: document.getElementById('categoria').value,
            quantidade: parseInt(document.getElementById('quantidade').value) || 1,
            preco: precoFloat,
            detalhes: document.getElementById('detalhes').value,
            imagem: imagemBase64, 
            precoAntigo: 0, 
            data_cadastro: new Date()
        });
        
        alert("✅ Produto cadastrado!");
        form.reset();
        document.getElementById('quantidade').value = "1"; 
        carregarEstoque();
    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        btn.innerHTML = 'CADASTRAR'; btn.disabled = false;
    }
});

// Funções Globais (necessárias para o HTML chamar onclick)
window.alterarQtd = async (id, delta, qtdAtual) => {
    let novaQtd = parseInt(qtdAtual) + delta;
    if (novaQtd < 0) novaQtd = 0; 
    try {
        await updateDoc(doc(db, "iphones", id), { quantidade: novaQtd });
        const index = todosProdutos.findIndex(p => p.id === id);
        if (index !== -1) todosProdutos[index].quantidade = novaQtd;
        filtrar(); 
        carregarEstoque();
    } catch (e) { console.error(e); }
}

window.gerenciarPromo = (id, nome, precoAtual, precoAntigo) => {
    if (precoAntigo && parseFloat(precoAntigo) > parseFloat(precoAtual)) {
        if(confirm(`Remover oferta?`)) removerPromo(id, precoAntigo);
    } else {
        produtoSelecionadoId = id;
        nomeProdModal.innerText = nome; 
        inputPrecoPromo.value = "";     
        if(modal) modal.style.display = 'flex'; 
        inputPrecoPromo.focus();
    }
}

window.fecharModal = () => { if(modal) modal.style.display = 'none'; produtoSelecionadoId = null; }

window.confirmarPromo = async () => {
    const novoValor = parseFloat(inputPrecoPromo.value);
    const prod = todosProdutos.find(p => p.id === produtoSelecionadoId);
    if (!novoValor || novoValor <= 0) return alert("Valor inválido!");
    if (novoValor >= prod.preco) return alert("A oferta deve ser menor que o preço atual!");

    try {
        await updateDoc(doc(db, "iphones", produtoSelecionadoId), {
            preco: novoValor, precoAntigo: prod.preco   
        });
        alert("🔥 Oferta ativada!");
        fecharModal();
        carregarEstoque();
    } catch (e) { alert("Erro: " + e.message); }
}

async function removerPromo(id, precoOriginal) {
    try {
        await updateDoc(doc(db, "iphones", id), { preco: parseFloat(precoOriginal), precoAntigo: 0 });
        carregarEstoque();
    } catch (e) { alert("Erro ao remover."); }
}

window.deletarProduto = async (id) => {
    if(confirm("Excluir este produto?")) {
        try {
            await deleteDoc(doc(db, "iphones", id));
            carregarEstoque(); 
        } catch (e) { alert("Erro ao deletar."); }
    }
}

function filtrar() {
    const termo = searchInput.value.toLowerCase();
    const cat = filterSelect.value;
    const filtrados = todosProdutos.filter(prod => {
        return prod.modelo.toLowerCase().includes(termo) && (cat === 'todos' || prod.categoria === cat);
    });
    renderizarLista(filtrados);
}

searchInput.addEventListener('input', filtrar);
filterSelect.addEventListener('change', filtrar);