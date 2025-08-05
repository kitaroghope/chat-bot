import express from 'express';
import models from '../models/index.js';

const router = express.Router();

// Generic CRUD operations for all models
const createGenericRoutes = (modelName, model) => {
    const routePath = `/${modelName.toLowerCase()}`;
    
    // GET all records
    router.get(`${routePath}`, async (req, res) => {
        try {
            const { limit = 100, offset = 0, ...conditions } = req.query;
            const records = await model.findWhere(conditions, parseInt(limit), parseInt(offset));
            const total = await model.count(conditions);
            
            res.json({
                data: records,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total
                }
            });
        } catch (error) {
            console.error(`Error fetching ${modelName}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    // DELETE records matching conditions
    router.delete(`${routePath}`, async (req, res) => {
        try {
            const { ...conditions } = req.query;
            if (Object.keys(conditions).length === 0) {
                return res.status(400).json({ error: 'No conditions provided for delete' });
            }

            const deletedCount = await model.deleteWhere(conditions);

            if (deletedCount === 0) {
                return res.status(404).json({ error: `No ${modelName} records found matching the conditions` });
            }

            res.json({ message: `${deletedCount} ${modelName} records deleted successfully` });
        } catch (error) {
            console.error(`Error deleting ${modelName}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET single record by ID
    router.get(`${routePath}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const record = await model.findById(id);
            console.log("Model name: "+modelName+" id: "+id);
            // console.log(record);
            
            if (!record) {
                return res.status(404).json({ error: `${modelName} not found` });
            }
            
            res.json(record);
        } catch (error) {
            console.error(`Error fetching ${modelName}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST create new record
    router.post(`${routePath}`, async (req, res) => {
        try {
            // console.log(`Creating ${modelName} with data:`, req.body);
            const record = await model.create(req.body);
            // console.log(`Created ${modelName} record:`, record);
            
            if (!record) {
                throw new Error(`Failed to create ${modelName} - no record returned`);
            }
            
            res.status(201).json(record);
        } catch (error) {
            console.error(`Error creating ${modelName}:`, error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });

    // PUT update record
    router.put(`${routePath}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const record = await model.update(id, req.body);
            
            if (!record) {
                return res.status(404).json({ error: `${modelName} not found` });
            }
            
            res.json(record);
        } catch (error) {
            console.error(`Error updating ${modelName}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE record
    router.delete(`${routePath}/:id`, async (req, res) => {
        try {
            const { id } = req.params;
            const record = await model.delete(id);
            console.log("response: "+record)
            
            if (record != null) {
                return res.status(404).json({ error: `${modelName} not found` });
            }
            
            res.json({ message: `${modelName} deleted successfully` });
        } catch (error) {
            console.error(`Error deleting ${modelName}:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
};

// Create routes for all models except User (has custom routes)
Object.entries(models).forEach(([modelName, model]) => {
    if (modelName !== 'User') {
        createGenericRoutes(modelName, model);
    }
});

export default router;