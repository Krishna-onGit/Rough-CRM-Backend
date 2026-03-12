import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from
    '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createApprovalSchema,
    reviewApprovalSchema,
} from './approval.schema.js';
import * as approvalService from './approval.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/pending-count',
    requirePermission('approvals:read'),
    async (req, res, next) => {
        try {
            const result = await approvalService.getPendingCount(
                req.organizationId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/',
    requirePermission('approvals:read'),
    async (req, res, next) => {
        try {
            const result = await approvalService.listApprovals(
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
    requirePermission('approvals:create'),
    validateBody(createApprovalSchema),
    async (req, res, next) => {
        try {
            const result = await approvalService.createApproval(
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
    requirePermission('approvals:read'),
    async (req, res, next) => {
        try {
            const result = await approvalService.getApproval(
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
    '/:id/review',
    requirePermission('approvals:approve'),
    validateBody(reviewApprovalSchema),
    async (req, res, next) => {
        try {
            const result = await approvalService.reviewApproval(
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
