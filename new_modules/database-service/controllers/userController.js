import models from '../models/index.js';
import Joi from 'joi';

const userValidationSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    full_name: Joi.string().max(255).optional(),
    phone_number: Joi.string().max(20).optional(),
    whatsapp_id: Joi.string().max(255).optional()
});

const updateUserValidationSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).optional(),
    email: Joi.string().email().optional(),
    full_name: Joi.string().max(255).optional(),
    phone_number: Joi.string().max(20).optional(),
    whatsapp_id: Joi.string().max(255).optional(),
    avatar_url: Joi.string().uri().optional()
});

export const createUser = async (req, res) => {
    try {
        const { error, value } = userValidationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Check if user already exists
        const existingUserByEmail = await models.User.findByEmail(value.email);
        if (existingUserByEmail) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const existingUserByUsername = await models.User.findByUsername(value.username);
        if (existingUserByUsername) {
            return res.status(409).json({ error: 'User with this username already exists' });
        }

        const user = await models.User.create(value);
        
        // Remove password_hash from response
        delete user.password_hash;
        
        res.status(201).json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await models.User.findById(id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password_hash from response
        delete user.password_hash;
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { error, value } = updateUserValidationSchema.validate(req.body);
        
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const user = await models.User.update(id, value);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password_hash from response
        delete user.password_hash;
        
        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await models.User.deactivate(id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getUserByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const user = await models.User.findByEmail(email);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password_hash from response
        delete user.password_hash;
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user by email:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getUserByWhatsApp = async (req, res) => {
    try {
        const { whatsappId } = req.params;
        const user = await models.User.findByWhatsAppId(whatsappId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Remove password_hash from response
        delete user.password_hash;
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user by WhatsApp ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};