import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createComplaintSchema,
    updateComplaintSchema,
    resolveComplaintSchema,
    escalateComplaintSchema,
} from './complaint.schema.js';
import * as complaintService from './complaint.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('complaints:read'),
    async (req, res, next) => {
        try {
            const result = await complaintService.listComplaints(
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
    requirePermission('complaints:create'),
    validateBody(createComplaintSchema),
    async (req, res, next) => {
        try {
            const result = await complaintService.createComplaint(
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
    requirePermission('complaints:read'),
    async (req, res, next) => {
        try {
            const result = await complaintService.getComplaint(
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
    requirePermission('complaints:update'),
    validateBody(updateComplaintSchema),
    async (req, res, next) => {
        try {
            const result = await complaintService.updateComplaint(
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
    '/:id/resolve',
    requirePermission('complaints:update'),
    validateBody(resolveComplaintSchema),
    async (req, res, next) => {
        try {
            const result = await complaintService.resolveComplaint(
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
    '/:id/escalate',
    requirePermission('complaints:update'),
    validateBody(escalateComplaintSchema),
    async (req, res, next) => {
        try {
            const result = await complaintService.escalateComplaint(
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
