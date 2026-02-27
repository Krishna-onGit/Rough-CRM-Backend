import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createProjectSchema,
    updateProjectSchema,
    updateProjectStatusSchema,
    addTowerSchema,
} from './project.schema.js';
import * as projectService from './project.service.js';

const router = Router();

// All project routes require auth + organization context
router.use(requireAuth);
router.use(requireOrganization);

// ── Project Routes ───────────────────────────────────────────────────────────

router.get(
    '/',
    requirePermission('projects:read'),
    async (req, res, next) => {
        try {
            const result = await projectService.listProjects(
                req.organizationId,
                req.query
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    requirePermission('projects:create'),
    validateBody(createProjectSchema),
    async (req, res, next) => {
        try {
            const result = await projectService.createProject(
                req.organizationId,
                req.user.userId,
                req.body
            );
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id',
    requirePermission('projects:read'),
    async (req, res, next) => {
        try {
            const result = await projectService.getProject(
                req.organizationId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:id',
    requirePermission('projects:update'),
    validateBody(updateProjectSchema),
    async (req, res, next) => {
        try {
            const result = await projectService.updateProject(
                req.organizationId,
                req.params.id,
                req.user.userId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:id/status',
    requirePermission('projects:update'),
    validateBody(updateProjectStatusSchema),
    async (req, res, next) => {
        try {
            const result = await projectService.updateProjectStatus(
                req.organizationId,
                req.params.id,
                req.user.userId,
                req.body.status
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id/towers',
    requirePermission('projects:read'),
    async (req, res, next) => {
        try {
            const result = await projectService.listTowers(
                req.organizationId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/towers',
    requirePermission('projects:create'),
    validateBody(addTowerSchema),
    async (req, res, next) => {
        try {
            const result = await projectService.addTowers(
                req.organizationId,
                req.params.id,
                req.user.userId,
                req.body.towers
            );
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id/units/stats',
    requirePermission('units:read'),
    async (req, res, next) => {
        try {
            const result = await projectService.getProjectUnitStats(
                req.organizationId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
