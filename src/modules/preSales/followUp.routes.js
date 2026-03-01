import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createFollowUpSchema,
    updateFollowUpSchema,
} from './followUp.schema.js';
import * as followUpService from './followUp.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('follow_ups:read'),
    async (req, res, next) => {
        try {
            const result = await followUpService.listFollowUps(
                req.organizationId,
                req.query,
                req.user
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    requirePermission('follow_ups:create'),
    validateBody(createFollowUpSchema),
    async (req, res, next) => {
        try {
            const result = await followUpService.createFollowUp(
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
    '/:id',
    requirePermission('follow_ups:update'),
    validateBody(updateFollowUpSchema),
    async (req, res, next) => {
        try {
            const result = await followUpService.updateFollowUp(
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

export default router;
