import { Router } from 'express';
import { createKit, deleteKit, generateKitRoute, getKit, listKits, patchKit } from '../controllers/kitController.js';
import {
  addFlashcard,
  addQuestion,
  deleteFlashcard,
  deleteQuestion,
  moveQuestion,
  reorderFlashcards,
  reorderQuestions,
  updateCompanyBrief,
  updateFlashcard,
  updateQuestion,
} from '../controllers/kitItemsController.js';
import {
  regenerateCompanyBrief,
  regenerateQuestionsCategory,
  regenerateSchedule,
} from '../controllers/kitRegenerateController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);

router.post('/', createKit);
router.get('/', listKits);
router.get('/:id', getKit);
router.post('/:id/generate', generateKitRoute);
router.patch('/:id', patchKit);
router.delete('/:id', deleteKit);

router.patch('/:id/company-brief', updateCompanyBrief);

// Static sub-paths ("reorder") must be registered before the ":questionId"
// param route, or Express would match "reorder" as a questionId.
router.post('/:id/questions', addQuestion);
router.patch('/:id/questions/reorder', reorderQuestions);
router.patch('/:id/questions/:questionId/move', moveQuestion);
router.patch('/:id/questions/:questionId', updateQuestion);
router.delete('/:id/questions/:questionId', deleteQuestion);

router.post('/:id/flashcards', addFlashcard);
router.patch('/:id/flashcards/reorder', reorderFlashcards);
router.patch('/:id/flashcards/:flashcardId', updateFlashcard);
router.delete('/:id/flashcards/:flashcardId', deleteFlashcard);

router.post('/:id/regenerate/company-brief', regenerateCompanyBrief);
router.post('/:id/regenerate/questions/:category', regenerateQuestionsCategory);
router.post('/:id/regenerate/schedule', regenerateSchedule);

export default router;
