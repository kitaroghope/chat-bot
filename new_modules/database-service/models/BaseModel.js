import database from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export default class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
        this.database = database;
    }

    async findById(id) {
        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            const doc = await collection.findOne({ _id: id });
            return doc || null;
        }
        console.log(this.tableName);
        
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const { rows } = await this.database.query(query, [id]);
        return rows[0] || null;
    }

    async findAll(limit = 100, offset = 0) {
        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            const docs = await collection.find({})
                .sort({ created_at: -1 })
                .limit(limit)
                .skip(offset)
                .toArray();
            return docs;
        }
        // console.log('heare');
        
        const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        const { rows } = await this.database.query(query, [limit, offset]);
        return rows;
    }

    async findWhere(conditions = {}, limit = 100, offset = 0) {
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            return this.findAll(limit, offset);
        }
        console.log('Correct');

        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            const docs = await collection.find(conditions)
                .sort({ created_at: -1 })
                .limit(limit)
                .skip(offset)
                .toArray();
            return docs;
        }

        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        console.log('condition: ', whereClause);
        const values = keys.map(key => conditions[key]);
        console.log('values: ', values);
        console.log('table: ',this.tableName);
        
        const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${keys.length + 1} OFFSET $${keys.length + 2}`;
        const { rows } = await this.database.query(query, [...values, limit, offset]);
        // console.log(rows);
        return rows;
    }

    
    async deleteWhere(conditions = {}) {
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            throw new Error('No conditions provided for delete');
        }

        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            const result = await collection.deleteMany(conditions);
            return result.deletedCount;
        }

        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const values = keys.map(key => conditions[key]);
        console.log('condition: ', whereClause);
        console.log('values: ', values);
        console.log('table: ',this.tableName);
        
        const query = `DELETE FROM ${this.tableName} WHERE ${whereClause}`;
        const result = await this.database.query(query, values);
        return result.rowCount;
    }
    

    async create(data) {
        // Add id and timestamps if not provided
        if (!data.id) {
            data.id = uuidv4();
        }
        
        if (!data.created_at) {
            data.created_at = new Date();
        }
        
        if (!data.updated_at) {
            data.updated_at = new Date();
        }

        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            data._id = data.id;
            const result = await collection.insertOne(data);
            return { ...data, _id: result.insertedId };
        }
        
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        
        if (this.database.type === 'sqlite') {
            // SQLite doesn't support RETURNING, so we insert then select
            const insertQuery = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
            const result = await this.database.query(insertQuery, values);
            
            // Get the inserted record by ID
            if (result.lastID) {
                const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = ?`;
                const selectResult = await this.database.query(selectQuery, [data.id || result.lastID]);
                return selectResult.rows[0];
            } else {
                // If no lastID, try to find by our generated ID
                const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = ?`;
                const selectResult = await this.database.query(selectQuery, [data.id]);
                return selectResult.rows[0];
            }
        } else {
            // PostgreSQL supports RETURNING
            const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
            const { rows } = await this.database.query(query, values);
            return rows[0];
        }
    }

    async update(id, data) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            throw new Error('No data provided for update');
        }

        // Add updated_at timestamp
        data.updated_at = new Date();

        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            const result = await collection.findOneAndUpdate(
                { _id: id },
                { $set: data },
                { returnDocument: 'after' }
            );
            return result.value;
        }

        const updatedKeys = Object.keys(data);
        const setClause = updatedKeys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = updatedKeys.map(key => data[key]);
        values.push(id);

        if (this.database.type === 'sqlite') {
            // SQLite doesn't support RETURNING, so we update then select
            const updateQuery = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${updatedKeys.length + 1}`;
            await this.database.query(updateQuery, values);
            
            // Get the updated record
            const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = ?`;
            const selectResult = await this.database.query(selectQuery, [id]);
            return selectResult.rows[0] || null;
        } else {
            // PostgreSQL supports RETURNING
            const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = $${updatedKeys.length + 1} RETURNING *`;
            const { rows } = await this.database.query(query, values);
            return rows[0] || null;
        }
    }

    async delete(id) {
        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            const result = await collection.findOneAndDelete({ _id: id });
            return result.value;
        }
        console.log('command sent');

        const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
        const { rows } = await this.database.query(query, [id]);
        console.log(rows);
        return rows[0] || null;
    }

    async count(conditions = {}) {
        if (this.database.type === 'mongodb') {
            const collection = this.database.getCollection(this.tableName);
            return await collection.countDocuments(conditions);
        }

        const keys = Object.keys(conditions);
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
            query += ` WHERE ${whereClause}`;
            values = keys.map(key => conditions[key]);
        }

        const { rows } = await this.database.query(query, values);
        return parseInt(rows[0].count);
    }
}