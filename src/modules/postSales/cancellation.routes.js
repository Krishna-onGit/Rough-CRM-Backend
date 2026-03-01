import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    initiateCancellationSchema,
    processCancellationSchema,
} from './cancellation.schema.js';
import * as cancellationService from './cancellation.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('cancellations:read'),
    async (req, res, next) => {
        try {
            const result = await cancellationService.listCancellations(
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
    '/preview/:bookingId',
    requirePermission('cancellations:read'),
    async (req, res, next) => {
        try {
            const result = await cancellationService.getCancellationPreview(
                req.organizationId,
                req.params.bookingId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/',
    requirePermission('cancellations:create'),
    validateBody(initiateCancellationSchema),
    async (req, res, next) => {
        try {
            const result = await cancellationService.initiateCancellation(
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

router.post(
    '/:id/process',
    requirePermission('approvals:approve'),
    validateBody(processCancellationSchema),
    async (req, res, next) => {
        try {
            const result = await cancellationService.processCancellation(
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
