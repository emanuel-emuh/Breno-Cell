import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. SEGURANÇA (Opcional) ---
const senhaReal = "brenno123";
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

// --- FUNÇÕES DE FORMATAÇÃO DE PREÇO (ESSENCIAIS) ---

// 1. Formata o Input ENQUANTO você digita (Visual: R$ 3.400,00)
// Precisa estar no window para o HTML "enxergar" o oninput
window.formatarMoedaInput = (elemento) => {
    let valor = elemento.value.replace(/\D/g, ""); // Remove tudo que não é número
    
    // Converte para moeda (divide por 100 para ter centavos)
    valor = (valor / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    elemento.value = valor;
}

// 2. Limpa a formatação para salvar no Banco (Banco aceita: 3400.00)
const converterPrecoParaBanco = (valorString) => {
    if (!valorString) return 0;
    // Remove "R$", espaços e pontos de milhar. Troca vírgula por ponto.
    // Ex: "R$ 1.200,50" -> "1200.50"
    let limpo = valorString.replace(/^R\$\s?/, "").replace(/\./g, "").replace(",", ".").trim();
    return parseFloat(limpo);
}

// 3. Formata número do banco para exibir na lista (Visual: R$ 3.400,00)
const formatarMoeda = (valor) => {
    return parseFloat(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// --- FUNÇÃO: COMPRIMIR IMAGEM (BASE64) ---
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
                // Redimensionar para max 800px (para não pesar o banco)
                const maxWidth = 800;
                const scaleSize = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scaleSize;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // Converte para JPG qualidade 70%
                const base64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve(base64);
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

// --- 3. CARREGAR ESTOQUE ---
async function carregarEstoque() {
    lista.innerHTML = '<p style="color:#aaa; text-align:center; padding:20px;">Atualizando estoque...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "iphones"));
        todosProdutos = [];
        let contaBaixoEstoque = 0;

        querySnapshot.forEach((doc) => {
            const dados = doc.data();
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
            
            if (qtd < 2) contaBaixoEstoque++;
        });

        if(totalEl) totalEl.innerText = todosProdutos.length;
        if(baixoEl) baixoEl.innerText = contaBaixoEstoque;
        
        filtrar(); 
    } catch (error) {
        console.error("Erro:", error);
        lista.innerHTML = '<p style="color:red; text-align:center;">Erro ao conectar com o banco.</p>';
    }
}

// --- 4. RENDERIZAR A LISTA ---
function renderizarLista(produtos) {
    lista.innerHTML = '';

    if (produtos.length === 0) {
        lista.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Nenhum produto encontrado.</p>';
        return;
    }

    produtos.forEach((prod) => {
        // Usa a função de formatação para exibir bonito
        let precoFormatado = formatarMoeda(prod.preco);
        let htmlPreco = precoFormatado;
        
        let textoBotaoPromo = "⚡ CRIAR OFERTA";
        let classeBotaoPromo = ""; 

        if (prod.precoAntigo && parseFloat(prod.precoAntigo) > parseFloat(prod.preco)) {
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

// --- 5. CADASTRO (COM UPLOAD DE FOTO E PREÇO CORRIGIDO) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = form.querySelector('button');
    btn.innerHTML = 'Processando...'; btn.disabled = true;

    try {
        const arquivoInput = document.getElementById('imagemInput');
        
        if (!arquivoInput.files || arquivoInput.files.length === 0) {
            throw new Error("Selecione uma imagem!");
        }

        // 1. Converte a imagem
        const imagemBase64 = await comprimirImagem(arquivoInput.files[0]);

        // 2. Converte o preço formatado (R$ 1.200,00) para número (1200.00)
        const precoInput = document.getElementById('preco').value;
        const precoFloat = converterPrecoParaBanco(precoInput);

        if (isNaN(precoFloat) || precoFloat === 0) {
            throw new Error("Preço inválido! Digite apenas números.");
        }

        await addDoc(collection(db, "iphones"), {
            modelo: document.getElementById('modelo').value,
            categoria: document.getElementById('categoria').value,
            quantidade: parseInt(document.getElementById('quantidade').value) || 1,
            preco: precoFloat, // Salva o número limpo
            detalhes: document.getElementById('detalhes').value,
            imagem: imagemBase64, 
            precoAntigo: 0, 
            data_cadastro: new Date()
        });
        
        alert("✅ Produto cadastrado com sucesso!");
        form.reset();
        document.getElementById('quantidade').value = "1"; 
        carregarEstoque();
    } catch (error) {
        alert("Erro: " + error.message);
        console.error(error);
    } finally {
        btn.innerHTML = 'CADASTRAR'; btn.disabled = false;
    }
});

// --- 6. FUNÇÕES EXTRAS ---

window.alterarQtd = async (id, delta, qtdAtual) => {
    let novaQtd = parseInt(qtdAtual) + delta;
    if (novaQtd < 0) novaQtd = 0; 

    try {
        const prodRef = doc(db, "iphones", id);
        await updateDoc(prodRef, { quantidade: novaQtd });
        const index = todosProdutos.findIndex(p => p.id === id);
        if (index !== -1) todosProdutos[index].quantidade = novaQtd;
        filtrar(); 
        carregarEstoque(); 
    } catch (error) {
        alert("Erro ao atualizar estoque.");
    }
}

window.gerenciarPromo = (id, nome, precoAtual, precoAntigoExistente) => {
    if (precoAntigoExistente && parseFloat(precoAntigoExistente) > parseFloat(precoAtual)) {
        if(confirm(`Remover oferta?`)) removerPromo(id, precoAntigoExistente);
    } else {
        produtoSelecionadoId = id;
        nomeProdModal.innerText = nome; 
        inputPrecoPromo.value = "";     
        if(modal) modal.style.display = 'flex'; 
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
    
    const prod = todosProdutos.find(p => p.id === produtoSelecionadoId);
    
    if (novoValor >= parseFloat(prod.preco)) return alert("O preço da oferta deve ser MENOR que o preço atual!");

    try {
        await updateDoc(doc(db, "iphones", produtoSelecionadoId), {
            preco: novoValor,         
            precoAntigo: prod.preco   
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
        await updateDoc(doc(db, "iphones", id), { preco: parseFloat(precoOriginal), precoAntigo: 0 });
        carregarEstoque();
    } catch (error) {
        alert("Erro ao remover oferta.");
    }
}

window.deletarProduto = async (id) => {
    if(confirm("Tem certeza que deseja excluir este produto do estoque?")) {
        try {
            await deleteDoc(doc(db, "iphones", id));
            todosProdutos = todosProdutos.filter(p => p.id !== id);
            filtrar();
            carregarEstoque(); 
        } catch (error) {
            alert("Erro ao deletar.");
        }
    }
}

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

// Inicia o sistema
carregarEstoque();