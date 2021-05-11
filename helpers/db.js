const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
//   connectionString: 'postgres://xdzshukurwgctn:b9f63d6a9a534d62d6c17011e48ec108b9f55ac502e3a15c686c52259e49c653@ec2-18-215-111-67.compute-1.amazonaws.com:5432/dbpbbhfh3f4r7s',
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();

const readSession = async () => {
    try {
        const res = await client.query('SELECT * FROM wa_session ORDER BY created_at DESC LIMIT 1');
        if (res.rows.length) return res.rows[0].session;
        return '';
    } catch (err) {
        throw err;
    }
}

const saveSession = (session) => {
    client.query('INSERT INTO wa_session (session) VALUES ($1)', [session], (err,result) =>{
        if (err) {
            console.error('Gagal menyimpan Session', err);
        
        } else {
            console.log('Session sukses disimpan');
        }
    });
}

const removeSession = () => {
    client.query('DELETE FROM wa_session');
    if (err) {
        console.error('Gagal menghapus Session', err);
    
    } else {
        console.log('Session sukses dihapus');
    }
}

module.exports = {
    readSession,
    saveSession,
    removeSession,
}