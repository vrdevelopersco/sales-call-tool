require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  let client;
  try {
    console.log('Intentando conectar a la base de datos...');
    console.log(`Usando connection string: ${process.env.DATABASE_URL ? 'cargada desde .env' : 'NO se encontró DATABASE_URL'}`);
    
    client = await pool.connect(); // Intenta obtener un cliente del pool de conexiones
    console.log('✅ ¡Conexión exitosa!');
    
    const res = await client.query('SELECT NOW()'); // Ejecuta una consulta simple
    console.log('🕒 Hora actual de la base de datos:', res.rows[0].now);

  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN A LA BASE DE DATOS:');
    console.error(err.stack);
  } finally {
    if (client) {
      client.release(); // Libera el cliente de vuelta al pool
    }
    await pool.end(); // Cierra todas las conexiones
    console.log('Prueba finalizada.');
  }
}

testConnection();

