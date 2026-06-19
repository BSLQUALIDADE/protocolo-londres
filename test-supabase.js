require('dotenv').config();
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

console.log('🔧 Testando conexão Supabase...');
console.log('URL:', SUPABASE_URL);
console.log('KEY:', SUPABASE_KEY?.substring(0, 20) + '...');

async function testar() {
  try {
    console.log('\n📡 Buscando usuários...');
    
    const response = await axios.get(
      `${SUPABASE_URL}/rest/v1/usuarios`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Sucesso! Usuários encontrados:', response.data.length);
    console.log('Dados:', response.data);
    
  } catch (e) {
    console.log('❌ Erro:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Data:', e.response.data);
    }
  }
}

testar();
