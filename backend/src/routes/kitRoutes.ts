import { Router } from 'express';
import { createKit, deleteKit, generateKitRoute, getKit, listKits, patchKit } from '../controllers/kitController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.post('/', createKit);
router.get('/', listKits);
router.get('/:id', getKit);
router.post('/:id/generate', generateKitRoute);
router.patch('/:id', patchKit);
router.delete('/:id', deleteKit);

export default router;
