import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    initiateTransferSchema,
    processTransferSchema,
} from './transfer.schema.js';
import * as transferService from './transfer.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('transfers:read'),
    async (req, res, next) => {
        try {
            const result = await transferService.listTransfers(
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
    requirePermission('transfers:create'),
    validateBody(initiateTransferSchema),
    async (req, res, next) => {
        try {
            const result = await transferService.initiateTransfer(
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
    requirePermission('transfers:read'),
    async (req, res, next) => {
        try {
            const transfer = await transferService.listTransfers(
                req.organizationId,
                { bookingId: req.params.id }
            );
            res.json(transfer);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/process',
    requirePermission('approvals:approve'),
    validateBody(processTransferSchema),
    async (req, res, next) => {
        try {
            const result = await transferService.processTransfer(
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
