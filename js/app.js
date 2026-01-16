import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const vitrine = document.getElementById('vitrine');

async function carregarVitrine() {
    const query = await getDocs(collection(db, "iphones"));
    vitrine.innerHTML = '';

    query.forEach((item) => {
        const prod = item.data();
        const zapMsg = `Olá! Vi o *${prod.modelo}* por R$ ${prod.preco} no site. Ainda tem?`;
        const linkZap = `https://wa.me/5584999999999?text=${encodeURIComponent(zapMsg)}`;

        vitrine.innerHTML += `
            <div class="card">
                <img src="${prod.imagem}" width="100%">
                <h3>${prod.modelo}</h3>
                <p class="preco">R$ ${prod.preco}</p>
                <a href="${linkZap}" target="_blank" class="btn-comprar">Comprar no Zap</a>
            </div>
        `;
    });
}

carregarVitrine();