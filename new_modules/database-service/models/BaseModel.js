import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export default class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
        this.pool = pool;
    }

    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const { rows } = await this.pool.query(query, [id]);
        return rows[0] || null;
    }

    async findAll(limit = 100, offset = 0) {
        const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        const { rows } = await this.pool.query(query, [limit, offset]);
        return rows;
    }

    async findWhere(conditions = {}, limit = 100, offset = 0) {
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            return this.findAll(limit, offset);
        }

        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const values = keys.map(key => conditions[key]);
        
        const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${keys.length + 1} OFFSET $${keys.length + 2}`;
        const { rows } = await this.pool.query(query, [...values, limit, offset]);
        return rows;
    }

    async create(data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        
        // Add id and timestamps if not provided
        if (!data.id) {
            keys.unshift('id');
            values.unshift(uuidv4());
        }
        
        if (!data.created_at) {
            keys.push('created_at');
            values.push(new Date());
        }
        
        if (!data.updated_at) {
            keys.push('updated_at');
            values.push(new Date());
        }
        
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        
        const { rows } = await this.pool.query(query, values);
        return rows[0];
    }

    async update(id, data) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            throw new Error('No data provided for update');
        }

        // Add updated_at timestamp
        keys.push('updated_at');
        data.updated_at = new Date();

        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = keys.map(key => data[key]);
        values.push(id);

        const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
        const { rows } = await this.pool.query(query, values);
        return rows[0] || null;
    }

    async delete(id) {
        const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
        const { rows } = await this.pool.query(query, [id]);
        return rows[0] || null;
    }

    async count(conditions = {}) {
        const keys = Object.keys(conditions);
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
            query += ` WHERE ${whereClause}`;
            values = keys.map(key => conditions[key]);
        }

        const { rows } = await this.pool.query(query, values);
        return parseInt(rows[0].count);
    }
}