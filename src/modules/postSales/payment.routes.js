import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    recordPaymentSchema,
    updatePaymentStatusSchema,
} from './payment.schema.js';
import * as paymentService from './payment.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('payments:read'),
    async (req, res, next) => {
        try {
            const result = await paymentService.listPayments(
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
    requirePermission('payments:create'),
    validateBody(recordPaymentSchema),
    async (req, res, next) => {
        try {
            const result = await paymentService.recordPayment(
                req.organizationId,
                req.user.userId,
                req.body
            );
            const statusCode = result?.data?.isDuplicate ? 200 : 201;
            res.status(statusCode).json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:id/status',
    requirePermission('payments:update'),
    validateBody(updatePaymentStatusSchema),
    async (req, res, next) => {
        try {
            const result = await paymentService.updatePaymentStatus(
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

router.get(
    '/booking/:bookingId/summary',
    requirePermission('payments:read'),
    async (req, res, next) => {
        try {
            const result = await paymentService.getBookingPaymentSummary(
                req.organizationId,
                req.params.bookingId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
