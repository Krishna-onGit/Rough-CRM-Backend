import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from
    '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createLoanSchema,
    updateLoanSchema,
    recordDisbursementSchema,
    updateLoanStatusSchema,
} from './loan.schema.js';
import * as loanService from './loan.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('loans:read'),
    async (req, res, next) => {
        try {
            const result = await loanService.listLoans(
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
    requirePermission('loans:create'),
    validateBody(createLoanSchema),
    async (req, res, next) => {
        try {
            const result = await loanService.createLoan(
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
    requirePermission('loans:read'),
    async (req, res, next) => {
        try {
            const result = await loanService.getLoan(
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
    requirePermission('loans:update'),
    validateBody(updateLoanSchema),
    async (req, res, next) => {
        try {
            const result = await loanService.updateLoan(
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
    '/:id/disbursement',
    requirePermission('loans:update'),
    validateBody(recordDisbursementSchema),
    async (req, res, next) => {
        try {
            const result = await loanService.recordDisbursement(
                req.organizationId,
                req.params.id,
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
    '/:id/status',
    requirePermission('loans:update'),
    validateBody(updateLoanStatusSchema),
    async (req, res, next) => {
        try {
            const result = await loanService.updateLoanStatus(
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
