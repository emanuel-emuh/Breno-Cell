import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('formProduto');
const lista = document.getElementById('listaProdutos');

// Carregar produtos
async function carregar() {
    lista.innerHTML = 'Carregando...';
    const query = await getDocs(collection(db, "iphones"));
    lista.innerHTML = '';
    
    query.forEach((item) => {
        const prod = item.data();
        lista.innerHTML += `
            <div class="item-estoque">
                <p><strong>${prod.modelo}</strong> - R$ ${prod.preco}</p>
                <button onclick="deletar('${item.id}')" style="background:red; color:white; border:none; padding:5px;">Vendido 🗑️</button>
            </div>
        `;
    });
}

// Salvar produto
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const modelo = document.getElementById('modelo').value;
    const preco = document.getElementById('preco').value;
    const imagem = document.getElementById('imagem').value;

    await addDoc(collection(db, "iphones"), { modelo, preco, imagem });
    alert("Salvo!");
    form.reset();
    carregar();
});

// Deletar (Tornar função global)
window.deletar = async (id) => {
    if(confirm("Confirmar venda/exclusão?")) {
        await deleteDoc(doc(db, "iphones", id));
        carregar();
    }
}

carregar();