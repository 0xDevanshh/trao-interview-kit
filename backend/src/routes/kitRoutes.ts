import { Router } from 'express';
import { createKit, deleteKit, getKit, listKits, patchKit } from '../controllers/kitController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.post('/', createKit);
router.get('/', listKits);
router.get('/:id', getKit);
router.patch('/:id', patchKit);
router.delete('/:id', deleteKit);

export default router;
