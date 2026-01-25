import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ELEMENTOS ---
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");
const divDestaque = document.getElementById('vitrine-destaque');
const divCompleta = document.getElementById('vitrine-completa');

// Elementos de Filtro (Só existem na pag catalogo)
const searchInput = document.getElementById('searchClient');
const filterButtons = document.querySelectorAll('.pill');
const sortSelect = document.getElementById('sortPrice');
const resultCount = document.getElementById('resultCount');

// Variável Global para guardar produtos do catálogo
let catalogoGlobal = [];
let filtroAtual = {
    texto: "",
    categoria: "todos",
    ordem: "relevancia"
};

// --- HELPER: FORMATAR MOEDA (R$ 0.000,00) ---
const formatarMoeda = (valor) => {
    return parseFloat(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// --- MENU MOBILE ---
if (hamburger && navMenu) {
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");
    });
    document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }));
}

// --- CARREGAR PRODUTOS ---
async function carregarProdutos() {
    try {
        const querySnapshot = await getDocs(collection(db, "iphones"));
        const produtos = [];

        querySnapshot.forEach((doc) => {
            produtos.push(doc.data());
        });

        // 1. PÁGINA INICIAL (Destaques - Filtra Ofertas)
        if (divDestaque) {
            divDestaque.innerHTML = '';
            const ofertasReais = produtos.filter(p => {
                const antigo = parseFloat(p.precoAntigo);
                const atual = parseFloat(p.preco);
                return antigo && antigo > atual;
            });

            if (ofertasReais.length === 0) {
                divDestaque.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:20px;">Sem ofertas hoje.</p>';
            } else {
                ofertasReais.slice(0, 4).forEach(prod => criarCard(prod, divDestaque));
            }
        }

        // 2. CATÁLOGO COMPLETO (Com Filtros)
        if (divCompleta) {
            catalogoGlobal = produtos; // Salva na memória
            aplicarFiltros(); // Renderiza a primeira vez
            configurarEventosFiltro(); // Ativa os botões
        }

    } catch (error) {
        console.error("Erro ao carregar:", error);
    }
}

// --- LÓGICA DE FILTRAGEM (CATÁLOGO) ---
function configurarEventosFiltro() {
    // Busca por Texto
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            filtroAtual.texto = e.target.value.toLowerCase();
            aplicarFiltros();
        });
    }

    // Filtro por Categoria (Botões)
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active de todos e põe no clicado
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            filtroAtual.categoria = btn.dataset.cat;
            aplicarFiltros();
        });
    });

    // Ordenação
    if(sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            filtroAtual.ordem = e.target.value;
            aplicarFiltros();
        });
    }
}

function aplicarFiltros() {
    if (!divCompleta) return;

    // 1. Filtrar
    let resultado = catalogoGlobal.filter(prod => {
        // Texto
        const matchTexto = prod.modelo.toLowerCase().includes(filtroAtual.texto) || 
                           (prod.detalhes && prod.detalhes.toLowerCase().includes(filtroAtual.texto));
        
        // Categoria
        const catProduto = prod.categoria || "Outros"; // Proteção caso categoria esteja vazia
        const matchCat = filtroAtual.categoria === "todos" || catProduto === filtroAtual.categoria;

        return matchTexto && matchCat;
    });

    // 2. Ordenar
    if (filtroAtual.ordem === 'menor') {
        resultado.sort((a, b) => parseFloat(a.preco) - parseFloat(b.preco));
    } else if (filtroAtual.ordem === 'maior') {
        resultado.sort((a, b) => parseFloat(b.preco) - parseFloat(a.preco));
    }

    // 3. Atualizar Contador
    if(resultCount) {
        resultCount.innerText = `${resultado.length} produtos encontrados`;
    }

    // 4. Renderizar
    divCompleta.innerHTML = '';
    if (resultado.length === 0) {
        divCompleta.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <i class="fas fa-search" style="font-size: 3rem; color: #333; margin-bottom: 15px;"></i>
                <p>Nenhum produto encontrado com esses filtros.</p>
            </div>
        `;
    } else {
        resultado.forEach(prod => criarCard(prod, divCompleta));
    }
}

// --- CRIAR CARD (VISUAL COM FORMATAÇÃO) ---
function criarCard(prod, divAlvo) {
    const precoAtual = parseFloat(prod.preco);
    const precoAntigo = parseFloat(prod.precoAntigo);
    
    // Formata o preço novo (ex: R$ 2.500,00)
    let htmlPreco = formatarMoeda(precoAtual);
    let htmlBadge = ''; 

    if (precoAntigo && precoAntigo > precoAtual) {
        // Formata o preço antigo
        const antigoFormatado = formatarMoeda(precoAntigo);
        htmlPreco = `
            <span class="old-price">${antigoFormatado}</span>
            <span style="color:#00e676;">${htmlPreco}</span>
        `;
        htmlBadge = `<span class="promo-badge">OFERTA 🔥</span>`;
    }

    const zapMsg = `Olá! Vi o *${prod.modelo}* (${prod.detalhes}) por ${formatarMoeda(precoAtual)} no site. Tenho interesse!`;
    const linkZap = `https://wa.me/5584996248150?text=${encodeURIComponent(zapMsg)}`;

    divAlvo.innerHTML += `
        <div class="card">
            ${htmlBadge}
            <img src="${prod.imagem}" alt="${prod.modelo}" loading="lazy">
            <div class="card-info">
                <h3>${prod.modelo}</h3>
                <small>${prod.detalhes}</small>
                <div class="preco">${htmlPreco}</div>
                <a href="${linkZap}" target="_blank" class="btn-comprar">COMPRAR</a>
            </div>
        </div>
    `;
}

carregarProdutos();