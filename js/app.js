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

// Variáveis Globais
let catalogoGlobal = [];
let filtroAtual = {
    texto: "",
    categoria: "todos",
    ordem: "relevancia"
};

// Variáveis do Carrossel (Novo)
let slideIndex = 0;
let fotosAtuais = [];

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
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            filtroAtual.texto = e.target.value.toLowerCase();
            aplicarFiltros();
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            filtroAtual.categoria = btn.dataset.cat;
            aplicarFiltros();
        });
    });

    if(sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            filtroAtual.ordem = e.target.value;
            aplicarFiltros();
        });
    }
}

function aplicarFiltros() {
    if (!divCompleta) return;

    let resultado = catalogoGlobal.filter(prod => {
        const matchTexto = prod.modelo.toLowerCase().includes(filtroAtual.texto) || 
                           (prod.detalhes && prod.detalhes.toLowerCase().includes(filtroAtual.texto));
        
        const catProduto = prod.categoria || "Outros"; 
        const matchCat = filtroAtual.categoria === "todos" || catProduto === filtroAtual.categoria;

        return matchTexto && matchCat;
    });

    if (filtroAtual.ordem === 'menor') {
        resultado.sort((a, b) => parseFloat(a.preco) - parseFloat(b.preco));
    } else if (filtroAtual.ordem === 'maior') {
        resultado.sort((a, b) => parseFloat(b.preco) - parseFloat(a.preco));
    }

    if(resultCount) {
        resultCount.innerText = `${resultado.length} produtos encontrados`;
    }

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

// --- LÓGICA DO MODAL (CARROSSEL) ---

window.abrirProduto = (prodStr) => {
    // Decodifica o objeto do produto
    const prod = JSON.parse(decodeURIComponent(prodStr));
    
    // 1. Popula textos do modal
    document.getElementById('modalModelo').innerText = prod.modelo;
    document.getElementById('modalDetalhes').innerText = prod.detalhes;
    
    // Preço
    const precoAtual = parseFloat(prod.preco);
    document.getElementById('modalPreco').innerText = formatarMoeda(precoAtual);
    
    // Link Zap
    const zapMsg = `Olá! Vi o *${prod.modelo}* no site e tenho interesse.`;
    const link = `https://wa.me/5584996248150?text=${encodeURIComponent(zapMsg)}`;
    document.getElementById('modalLinkZap').href = link;

    // 2. Configura Galeria (prioriza 'galeria', senão usa 'imagem' única)
    fotosAtuais = prod.galeria || [prod.imagem];
    slideIndex = 0; 
    
    renderizarCarrossel();
    
    // 3. Mostra Modal
    document.getElementById('modalProduto').style.display = 'flex';
}

window.fecharModalProduto = () => {
    document.getElementById('modalProduto').style.display = 'none';
}

function renderizarCarrossel() {
    const container = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');
    
    container.innerHTML = '';
    dotsContainer.innerHTML = '';

    fotosAtuais.forEach((foto, index) => {
        // Cria imagem (só a primeira visível)
        container.innerHTML += `<img src="${foto}" class="carousel-slide" style="display: ${index === 0 ? 'block' : 'none'}">`;
        
        // Cria bolinha
        dotsContainer.innerHTML += `<span class="dot ${index === 0 ? 'active' : ''}" onclick="irParaSlide(${index})"></span>`;
    });
}

window.mudarSlide = (n) => {
    mostrarSlide(slideIndex += n);
}

window.irParaSlide = (n) => {
    mostrarSlide(slideIndex = n);
}

function mostrarSlide(n) {
    const slides = document.getElementsByClassName("carousel-slide");
    const dots = document.getElementsByClassName("dot");
    
    if (n >= slides.length) slideIndex = 0;
    if (n < 0) slideIndex = slides.length - 1;
    
    // Esconde todos
    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
        dots[i].className = dots[i].className.replace(" active", "");
    }
    
    // Mostra atual
    slides[slideIndex].style.display = "block";
    dots[slideIndex].className += " active";
}

// --- CRIAR CARD (VISUAL) ---
function criarCard(prod, divAlvo) {
    const precoAtual = parseFloat(prod.preco);
    const precoAntigo = parseFloat(prod.precoAntigo);
    
    let htmlPreco = formatarMoeda(precoAtual);
    let htmlBadge = ''; 

    if (precoAntigo && precoAntigo > precoAtual) {
        const antigoFormatado = formatarMoeda(precoAntigo);
        htmlPreco = `
            <span class="old-price">${antigoFormatado}</span>
            <span style="color:#00e676;">${htmlPreco}</span>
        `;
        htmlBadge = `<span class="promo-badge">OFERTA 🔥</span>`;
    }

    // Prepara objeto seguro para passar na função onclick
    const prodString = encodeURIComponent(JSON.stringify(prod));

    divAlvo.innerHTML += `
        <div class="card" onclick="abrirProduto('${prodString}')" style="cursor: pointer;">
            ${htmlBadge}
            <img src="${prod.imagem}" alt="${prod.modelo}" loading="lazy">
            <div class="card-info">
                <h3>${prod.modelo}</h3>
                <small>${prod.detalhes}</small>
                <div class="preco">${htmlPreco}</div>
                <button class="btn-comprar">VER DETALHES</button>
            </div>
        </div>
    `;
}

carregarProdutos();