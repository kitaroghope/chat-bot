import BaseModel from './BaseModel.js';
import bcrypt from 'bcrypt';

export default class User extends BaseModel {
    constructor() {
        super('users');
    }

    async create(userData) {
        if (userData.password) {
            const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
            userData.password_hash = await bcrypt.hash(userData.password, saltRounds);
            delete userData.password;
        }
        
        return super.create(userData);
    }

    async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
        const { rows } = await this.pool.query(query, [email]);
        return rows[0] || null;
    }

    async findByUsername(username) {
        const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
        const { rows } = await this.pool.query(query, [username]);
        return rows[0] || null;
    }

    async findByWhatsAppId(whatsappId) {
        const query = 'SELECT * FROM users WHERE whatsapp_id = $1 AND is_active = true';
        const { rows } = await this.pool.query(query, [whatsappId]);
        return rows[0] || null;
    }

    async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    async updateLastLogin(id) {
        const query = 'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING *';
        const { rows } = await this.pool.query(query, [id]);
        return rows[0] || null;
    }

    async deactivate(id) {
        return this.update(id, { is_active: false });
    }

    async activate(id) {
        return this.update(id, { is_active: true });
    }
}