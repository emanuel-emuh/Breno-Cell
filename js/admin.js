import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. SEGURANÇA (Opcional) ---
const senhaReal = "brenno123";
// Descomente as 2 linhas abaixo para ativar a proteção de senha
// const senhaDigitada = prompt("🔒 Digite a senha de administrador:");
// if (senhaDigitada !== senhaReal) window.location.href = "index.html"; 

// --- 2. ELEMENTOS DO HTML ---
const form = document.getElementById('formProduto');
const lista = document.getElementById('listaAdmin');

// Elementos do Dashboard
const totalEl = document.getElementById('totalProdutos');
const baixoEl = document.getElementById('baixoEstoque'); 

// Elementos de Filtro
const searchInput = document.getElementById('searchBar');
const filterSelect = document.getElementById('filterCategory');

// Elementos do Modal de Promoção
const modal = document.getElementById('modalPromo');
const nomeProdModal = document.getElementById('nomeProdutoModal');
const inputPrecoPromo = document.getElementById('novoPrecoPromo');
let produtoSelecionadoId = null; 
let todosProdutos = [];

// --- 3. CARREGAR ESTOQUE (Função Principal) ---
async function carregarEstoque() {
    lista.innerHTML = '<p style="color:#aaa; text-align:center; padding:20px;">Atualizando estoque...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "iphones"));
        todosProdutos = [];
        let contaBaixoEstoque = 0;

        querySnapshot.forEach((doc) => {
            const dados = doc.data();
            // Garante que a quantidade seja número (se vier vazio, assume 1)
            const qtd = dados.quantidade ? parseInt(dados.quantidade) : 0;
            const preco = parseFloat(dados.preco);
            const precoAntigo = dados.precoAntigo ? parseFloat(dados.precoAntigo) : 0;

            todosProdutos.push({ 
                id: doc.id, 
                ...dados, 
                quantidade: qtd,
                preco: preco,
                precoAntigo: precoAntigo
            });
            
            // Conta produtos com estoque baixo (menos de 2)
            if (qtd < 2) contaBaixoEstoque++;
        });

        // Atualiza os números lá no topo (Dashboard)
        if(totalEl) totalEl.innerText = todosProdutos.length;
        if(baixoEl) baixoEl.innerText = contaBaixoEstoque;
        
        filtrar(); // Renderiza a lista na tela com os filtros atuais
    } catch (error) {
        console.error("Erro:", error);
        lista.innerHTML = '<p style="color:red; text-align:center;">Erro ao conectar com o banco de dados.</p>';
    }
}

// --- 4. RENDERIZAR A LISTA (Visão do Admin) ---
function renderizarLista(produtos) {
    lista.innerHTML = '';

    if (produtos.length === 0) {
        lista.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Nenhum produto encontrado.</p>';
        return;
    }

    produtos.forEach((prod) => {
        // Lógica visual: Se tem promoção, mostra riscado
        let htmlPreco = `R$ ${prod.preco}`;
        let textoBotaoPromo = "⚡ CRIAR OFERTA";
        let classeBotaoPromo = ""; // Estilo padrão (transparente/dourado)

        if (prod.precoAntigo && prod.precoAntigo > prod.preco) {
            htmlPreco = `
                <span style="text-decoration:line-through; color:#777; font-size:0.9rem;">R$ ${prod.precoAntigo}</span> 
                <span style="color:#00e676; font-weight:bold;">R$ ${prod.preco}</span>
            `;
            textoBotaoPromo = "❌ REMOVER OFERTA";
            classeBotaoPromo = "ativo"; // Fica preenchido de amarelo
        }

        // HTML do Card de Admin
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

// --- 5. ALTERAR QUANTIDADE (+ e -) ---
window.alterarQtd = async (id, delta, qtdAtual) => {
    let novaQtd = parseInt(qtdAtual) + delta;
    if (novaQtd < 0) novaQtd = 0; // Impede estoque negativo

    try {
        const prodRef = doc(db, "iphones", id);
        await updateDoc(prodRef, { quantidade: novaQtd });
        
        // Atualiza a lista localmente para ser rápido, depois recarrega
        const index = todosProdutos.findIndex(p => p.id === id);
        if (index !== -1) todosProdutos[index].quantidade = novaQtd;
        
        filtrar(); // Atualiza visualmente sem ir no banco de novo (mais rápido)
        carregarEstoque(); // Garante sincronia com o banco
    } catch (error) {
        alert("Erro ao atualizar estoque: " + error.message);
    }
}

// --- 6. SISTEMA DE PROMOÇÃO (MODAL) ---
window.gerenciarPromo = (id, nome, precoAtual, precoAntigoExistente) => {
    // Se já tem oferta ativa, perguntamos se quer remover
    if (precoAntigoExistente && parseFloat(precoAntigoExistente) > parseFloat(precoAtual)) {
        if(confirm(`O produto está em oferta. Deseja voltar o preço para R$ ${precoAntigoExistente}?`)) {
            removerPromo(id, precoAntigoExistente);
        }
    } else {
        // Se não tem oferta, abre o modal para criar
        produtoSelecionadoId = id;
        nomeProdModal.innerText = nome; // Mostra nome no modal
        inputPrecoPromo.value = "";     // Limpa campo
        if(modal) modal.style.display = 'flex'; // Exibe modal
        inputPrecoPromo.focus();
    }
}

window.fecharModal = () => {
    if(modal) modal.style.display = 'none';
    produtoSelecionadoId = null;
}

window.confirmarPromo = async () => {
    const novoValor = parseFloat(inputPrecoPromo.value);
    
    if (!novoValor || novoValor <= 0) return alert("Digite um valor de oferta válido!");
    
    // Busca o produto na lista local para pegar o preço original (que vai virar antigo)
    const prod = todosProdutos.find(p => p.id === produtoSelecionadoId);
    
    if (novoValor >= parseFloat(prod.preco)) return alert("O preço da oferta deve ser MENOR que o preço atual!");

    try {
        const prodRef = doc(db, "iphones", produtoSelecionadoId);
        
        await updateDoc(prodRef, {
            preco: novoValor,         // O preço vira o valor da oferta
            precoAntigo: prod.preco   // O preço antigo guarda o valor original
        });

        alert("🔥 Oferta criada com sucesso!");
        fecharModal();
        carregarEstoque();
    } catch (error) {
        alert("Erro ao criar oferta: " + error.message);
    }
}

async function removerPromo(id, precoOriginal) {
    try {
        const prodRef = doc(db, "iphones", id);
        await updateDoc(prodRef, {
            preco: parseFloat(precoOriginal), // Volta ao preço original
            precoAntigo: 0                    // Zera o campo de preço antigo
        });
        carregarEstoque();
    } catch (error) {
        alert("Erro ao remover oferta.");
    }
}

// --- 7. CADASTRAR NOVO PRODUTO ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = form.querySelector('button');
    btn.innerHTML = 'Salvando...'; btn.disabled = true;

    try {
        await addDoc(collection(db, "iphones"), {
            modelo: document.getElementById('modelo').value,
            categoria: document.getElementById('categoria').value,
            // Pega a quantidade do input (ou 1 se estiver vazio)
            quantidade: parseInt(document.getElementById('quantidade').value) || 1,
            preco: parseFloat(document.getElementById('preco').value),
            detalhes: document.getElementById('detalhes').value,
            imagem: document.getElementById('imagem').value,
            precoAntigo: 0, // Começa sem promoção
            data_cadastro: new Date()
        });
        
        alert("✅ Produto cadastrado!");
        form.reset();
        document.getElementById('quantidade').value = "1"; // Reseta qtd para 1
        carregarEstoque();
    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        btn.innerHTML = 'CADASTRAR'; btn.disabled = false;
    }
});

// --- 8. FILTROS E BUSCA (Ao digitar) ---
function filtrar() {
    const termo = searchInput.value.toLowerCase();
    const cat = filterSelect.value;

    const filtrados = todosProdutos.filter(prod => {
        const matchNome = prod.modelo.toLowerCase().includes(termo);
        const matchCat = cat === 'todos' || prod.categoria === cat;
        return matchNome && matchCat;
    });
    renderizarLista(filtrados);
}

searchInput.addEventListener('input', filtrar);
filterSelect.addEventListener('change', filtrar);

// --- 9. DELETAR PRODUTO ---
window.deletarProduto = async (id) => {
    if(confirm("Tem certeza que deseja excluir este produto do estoque?")) {
        try {
            await deleteDoc(doc(db, "iphones", id));
            // Remove da lista local para atualizar rápido
            todosProdutos = todosProdutos.filter(p => p.id !== id);
            filtrar();
            carregarEstoque(); // Sincroniza
        } catch (error) {
            alert("Erro ao deletar.");
        }
    }
}

// Inicia o sistema
carregarEstoque();