import express from 'express';
import { 
    createUser, 
    getUser, 
    updateUser, 
    deleteUser,
    getUserByEmail,
    getUserByWhatsApp
} from '../controllers/userController.js';

const router = express.Router();

// User CRUD operations
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

// Special queries
router.get('/email/:email', getUserByEmail);
router.get('/whatsapp/:whatsappId', getUserByWhatsApp);

export default router;