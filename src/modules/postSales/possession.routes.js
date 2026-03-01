import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    updatePossessionSchema,
    completePossessionSchema,
    createSnagSchema,
    updateSnagSchema,
} from './possession.schema.js';
import * as possessionService from './possession.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

// ── Possession Routes ─────────────────────────────────────────────────────────

router.get(
    '/',
    requirePermission('possession:read'),
    async (req, res, next) => {
        try {
            const result = await possessionService.listPossessions(
                req.organizationId,
                req.query
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/:id',
    requirePermission('possession:read'),
    async (req, res, next) => {
        try {
            const result = await possessionService.getPossession(
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
    requirePermission('possession:update'),
    validateBody(updatePossessionSchema),
    async (req, res, next) => {
        try {
            const result = await possessionService.updatePossession(
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

router.post(
    '/:id/complete',
    requirePermission('possession:update'),
    validateBody(completePossessionSchema),
    async (req, res, next) => {
        try {
            const result = await possessionService.completePossession(
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

// ── Snag Routes ───────────────────────────────────────────────────────────────

router.get(
    '/:id/snags',
    requirePermission('possession:read'),
    async (req, res, next) => {
        try {
            const result = await possessionService.listSnags(
                req.organizationId,
                req.params.id,
                req.query
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/snags',
    requirePermission('possession:create'),
    validateBody(createSnagSchema),
    async (req, res, next) => {
        try {
            const result = await possessionService.createSnag(
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

router.patch(
    '/snags/:snagId',
    requirePermission('possession:update'),
    validateBody(updateSnagSchema),
    async (req, res, next) => {
        try {
            const result = await possessionService.updateSnag(
                req.organizationId,
                req.params.snagId,
                req.user.userId,
                req.body
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
