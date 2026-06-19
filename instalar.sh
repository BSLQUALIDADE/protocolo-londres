#!/bin/bash
# ============================================================
# Script de instalação: Autenticação real via Supabase Auth
# ============================================================
set -e

echo "🏥 Protocolo de Londres — Instalando autenticação real (Supabase Auth)"
echo ""

if [ ! -f "server.js" ]; then
    echo "❌ Não encontrei server.js na pasta atual."
    echo "   Rode este script dentro de ~/protocolo-londres"
    exit 1
fi

BACKUP_DIR="backup-pre-auth-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Fazendo backup dos arquivos atuais em $BACKUP_DIR/ ..."
cp server.js "$BACKUP_DIR/" 2>/dev/null || true
cp auth.js "$BACKUP_DIR/" 2>/dev/null || true
cp usuarios-mock.json "$BACKUP_DIR/" 2>/dev/null || true
cp index.html "$BACKUP_DIR/" 2>/dev/null || true
cp shared-components.js "$BACKUP_DIR/" 2>/dev/null || true
cp novo-protocolo.html "$BACKUP_DIR/" 2>/dev/null || true
for i in $(seq 1 17); do
    cp "etapa-$i.html" "$BACKUP_DIR/" 2>/dev/null || true
done
echo "✅ Backup concluído"
echo ""

if [ ! -f "protocolo-londres-auth-fix.zip" ]; then
    echo "❌ Não encontrei protocolo-londres-auth-fix.zip na pasta atual."
    echo "   Baixe o arquivo e coloque em ~/protocolo-londres antes de rodar este script."
    exit 1
fi

echo "📂 Extraindo arquivos novos..."
unzip -o protocolo-londres-auth-fix.zip -d . > /dev/null
echo "✅ Arquivos extraídos e substituídos"
echo ""

echo "🔍 Validando sintaxe de todos os arquivos..."
for f in server.js auth-supabase.js shared-components.js; do
    node -c "$f" && echo "✅ $f: sintaxe OK" || { echo "❌ $f: ERRO de sintaxe"; exit 1; }
done

for i in $(seq 1 17); do
    node -e "
const fs = require('fs');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const content = fs.readFileSync('etapa-$i.html', 'utf-8');
let match; let blocos = [];
while ((match = re.exec(content)) !== null) { blocos.push(match[1]); }
const code = blocos.join('\n;\n');
try { new Function(code); console.log('✅ etapa-$i.html: sintaxe OK'); }
catch(e) { console.log('❌ etapa-$i.html: ERRO -', e.message); process.exit(1); }
"
done

node -e "
const fs = require('fs');
const content = fs.readFileSync('novo-protocolo.html', 'utf-8');
const match = content.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(match[1]); console.log('✅ novo-protocolo.html: sintaxe OK'); }
catch(e) { console.log('❌ novo-protocolo.html: ERRO -', e.message); process.exit(1); }
"

node -e "
const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf-8');
const match = content.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(match[1]); console.log('✅ index.html: sintaxe OK'); }
catch(e) { console.log('❌ index.html: ERRO -', e.message); process.exit(1); }
"

echo ""
echo "🎉 Arquivos instalados e validados com sucesso!"
echo ""
echo "⚠️  AINDA FALTAM 2 PASSOS MANUAIS IMPORTANTES:"
echo ""
echo "1️⃣  Adicione uma chave de administração ao seu .env.local:"
echo "    echo 'ADMIN_SETUP_KEY=escolha-uma-senha-forte-aqui' >> .env.local"
echo "    (essa chave protege o endpoint de criação de usuários — guarde-a"
echo "     em local seguro, você vai precisar dela para cadastrar a equipe)"
echo ""
echo "2️⃣  Rode o SQL de políticas RLS no painel do Supabase:"
echo "    - Acesse https://supabase.com/dashboard"
echo "    - Abra o projeto, vá em 'SQL Editor'"
echo "    - Cole o conteúdo do arquivo 002-rls-policies.sql e execute"
echo ""
echo "👉 Depois disso, reinicie o servidor:"
echo "   pkill -f 'node server.js'; node server.js &"
echo ""
echo "👉 E crie sua primeira conta real de usuário com:"
echo "   curl -X POST http://localhost:3000/api/admin/criar-usuario \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"chave_admin\":\"SUA_ADMIN_SETUP_KEY\",\"email\":\"seu@email.com\",\"senha\":\"SuaSenhaForte123\",\"nome\":\"Seu Nome\",\"cargo\":\"Seu Cargo\"}'"
echo ""
echo "Se algo der errado, os arquivos originais estão em: $BACKUP_DIR/"
