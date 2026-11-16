import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import {
  getPublicProjects,
  getPublicProjectById,
  getAdminProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/project.controller.js';

const router = Router();

// ==========================================
// Public Endpoints (Published projects only)
// ==========================================
router.get('/projects', getPublicProjects);
router.get('/projects/:id', getPublicProjectById);

// ==========================================
// Admin-only Endpoints (Requires Authorized Admin Session)
// ==========================================
router.get('/admin/projects', requireAdmin, getAdminProjects);
router.post('/admin/projects', requireAdmin, createProject);
router.put('/admin/projects/:id', requireAdmin, updateProject);
router.delete('/admin/projects/:id', requireAdmin, deleteProject);

export default router;
