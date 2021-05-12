const { Client } = require('pg');

const client = new Client({
//   connectionString: process.env.DATABASE_URL,
  connectionString: 'postgres://rugphqyulgdcnq:5a57b10bcebd2cbb6cd4da513fa1da1d4efb0596963ad5335516ec91681ffd06@ec2-54-158-232-223.compute-1.amazonaws.com:5432/dp0gf7dk3abum',
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