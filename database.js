import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('vectors.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the vectors database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT,
        vector TEXT
    )`);
});

export default db;