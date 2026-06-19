// ============================================================
// Autenticação mock - compatível com server.js v2
// ============================================================
const fs = require('fs');
const path = require('path');

function carregarUsuarios() {
    try {
        const filePath = path.join(__dirname, 'usuarios-mock.json');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
        console.error('Erro ao carregar usuarios-mock.json:', err.message);
        return [];
    }
}

function autenticar(email, senha) {
    const usuarios = carregarUsuarios();
    const usuario = usuarios.find(u => u.email === email && u.senha === senha);
    if (!usuario) return null;
    const { senha: _senha, ...usuarioSemSenha } = usuario;
    return usuarioSemSenha;
}

module.exports = { autenticar };
