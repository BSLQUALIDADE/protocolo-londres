#!/bin/bash

# Array com info das 17 etapas
declare -a ETAPAS=(
    "1|Dados do Residente|Informações pessoais e clínicas"
    "2|Informações do Evento|Data, hora, tipo e classificação"
    "3|Cronologia|Timeline detalhada do evento"
    "4|Entrevistas|Depoimentos de envolvidos"
    "5|Análise por IA|Análise automatizada"
    "6|PPC|Prevenção, Proteção, Compensação"
    "7|Fatores Contribuintes|Causas raiz identificadas"
    "8|Segunda Vítima|Suporte aos profissionais"
    "9|Disclosure|Comunicação com paciente/família"
    "10|Jurídico|Análise legal"
    "11|Matriz GUT|Gravidade, Urgência, Tendência"
    "12|Esforço × Impacto|Priorização de ações"
    "13|Ishikawa|Diagrama de causa e efeito"
    "14|5W2H|Plano de ação detalhado"
    "15|Diário de Bordo|Registro de ações"
    "16|Monitoramento|Acompanhamento"
    "17|Relatório Final|Geração de PDF"
)

# Função pra gerar HTML de cada etapa
gerar_etapa() {
    local num=$1
    local titulo=$2
    local descricao=$3
    
    cat > "etapa-${num}.html" << "HTML_EOF"
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Etapa ${num} - ${titulo}</title>
    <style>
        :root {
            --color-primary: #0F5C8F;
            --color-teal: #2DACA4;
            --color-accent: #D4A574;
            --color-bg: #FFFFFF;
            --color-bg-secondary: #F8FAFB;
            --color-text-primary: #1A2332;
            --color-text-secondary: #667085;
            --color-border: #E0E6ED;
            --font-primary: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif;
            --shadow-md: 0 4px 12px rgba(15,92,143,0.1);
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: var(--font-primary); background: var(--color-bg-secondary); min-height: 100vh; }
        
        .header {
            background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-teal) 100%);
            color: white;
            padding: 24px 32px;
            box-shadow: var(--shadow-md);
        }
        
        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .stage-info { font-size: 14px; opacity: 0.9; }
        .stage-title { font-size: 24px; font-weight: 700; }
        
        .btn-group { display: flex; gap: 12px; }
        .btn { padding: 10px 16px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
        .btn-secondary { background: rgba(255,255,255,0.15); color: white; }
        .btn-primary { background: var(--color-accent); color: white; }
        
        .main-content { max-width: 1200px; margin: 0 auto; padding: 32px; }
        
        .progress-bar {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 32px;
            box-shadow: var(--shadow-md);
        }
        
        .progress-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .progress-label { font-weight: 600; }
        .progress-track {
            height: 8px;
            background: var(--color-border);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--color-primary), var(--color-teal));
            width: ${num}%;
            transition: width 0.3s;
        }
        
        .form-card {
            background: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: var(--shadow-md);
        }
        
        .form-section {
            margin-bottom: 32px;
        }
        
        .form-section-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 20px;
            color: var(--color-primary);
            padding-bottom: 12px;
            border-bottom: 2px solid var(--color-border);
        }
        
        .form-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .form-group {
            display: flex;
            flex-direction: column;
        }
        
        label {
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--color-text-secondary);
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        
        input, textarea, select {
            padding: 12px;
            border: 2px solid var(--color-border);
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
            color: var(--color-text-primary);
            transition: all 0.3s;
        }
        
        input:focus, textarea:focus, select:focus {
            outline: none;
            border-color: var(--color-primary);
            box-shadow: 0 0 0 3px rgba(15,92,143,0.1);
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        .form-actions {
            display: flex;
            gap: 12px;
            margin-top: 32px;
            padding-top: 32px;
            border-top: 2px solid var(--color-border);
        }
        
        .btn-save {
            background: var(--color-teal);
            color: white;
            padding: 14px 32px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        
        .btn-back {
            background: var(--color-border);
            color: var(--color-text-primary);
            padding: 14px 32px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        
        .btn-prev-next {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }
        
        .btn-nav {
            padding: 10px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            background: var(--color-border);
            color: var(--color-text-primary);
        }
        
        .btn-nav:hover { background: var(--color-primary); color: white; }
        
        .alert {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: none;
        }
        
        .alert.success {
            background: #E8F8F0;
            color: #00A86B;
            border-left: 4px solid #00A86B;
            display: block;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <div>
                <div class="stage-info">ETAPA ${num} DE 17</div>
                <div class="stage-title">${titulo}</div>
            </div>
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="window.location.href='/novo-protocolo.html'">← Voltar</button>
            </div>
        </div>
    </div>
    
    <div class="main-content">
        <div class="progress-bar">
            <div class="progress-info">
                <span class="progress-label">Progresso: ${descricao}</span>
                <span style="font-size: 14px;">Etapa ${num} de 17</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill"></div>
            </div>
        </div>
        
        <div class="form-card">
            <div class="alert" id="alert"></div>
            
            <form id="formEtapa${num}">
                <div class="form-section">
                    <div class="form-section-title">📝 Conteúdo da Etapa ${num}</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="conteudo">Informações</label>
                            <textarea id="conteudo" placeholder="Digite aqui o conteúdo desta etapa..." required></textarea>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn-save">💾 Salvar Etapa</button>
                    <button type="button" class="btn-back" onclick="window.location.href='/novo-protocolo.html'">Voltar</button>
                </div>
                
                <div class="btn-prev-next">
                    ${num > 1 ? '<button type="button" class="btn-nav" onclick="window.location.href=\\'/etapa-'$((num-1))'.html\\'">← Etapa Anterior</button>' : ''}
                    ${num < 17 ? '<button type="button" class="btn-nav" onclick="window.location.href=\\'/etapa-'$((num+1))'.html\\'">Próxima Etapa →</button>' : ''}
                </div>
            </form>
        </div>
    </div>

    <script>
        const form = document.getElementById('formEtapa${num}');
        const alertDiv = document.getElementById('alert');
        
        function loadData() {
            const saved = localStorage.getItem('etapa-${num}');
            if (saved) {
                const data = JSON.parse(saved);
                document.getElementById('conteudo').value = data.conteudo || '';
            }
        }
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = {
                conteudo: document.getElementById('conteudo').value,
                dataSalva: new Date().toLocaleString('pt-BR')
            };
            
            localStorage.setItem('etapa-${num}', JSON.stringify(formData));
            
            alertDiv.textContent = '✓ Etapa ${num} salva com sucesso!';
            alertDiv.classList.add('success');
            
            setTimeout(() => {
                window.location.href = '/novo-protocolo.html';
            }, 1500);
        });
        
        loadData();
    </script>
</body>
</html>
HTML_EOF

    echo "✓ Etapa ${num} criada: ${titulo}"
}

# Gerar todas as 17 etapas
echo "🚀 Gerando 17 etapas..."
for etapa in "${ETAPAS[@]}"; do
    IFS='|' read -r num titulo descricao <<< "$etapa"
    gerar_etapa "$num" "$titulo" "$descricao"
done

echo "✅ Todas as 17 etapas foram criadas com sucesso!"
ls -la etapa-*.html | wc -l
echo "arquivos criados"

