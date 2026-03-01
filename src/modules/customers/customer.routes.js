import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createCustomerSchema,
    updateCustomerSchema,
    verifyKycSchema,
} from './customer.schema.js';
import * as customerService from './customer.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('customers:read'),
    async (req, res, next) => {
        try {
            const result = await customerService.listCustomers(
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
    requirePermission('customers:read'),
    validateBody(createCustomerSchema),
    async (req, res, next) => {
        try {
            const result = await customerService.createCustomer(
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
    requirePermission('customers:read'),
    async (req, res, next) => {
        try {
            const result = await customerService.getCustomer(
                req.organizationId,
                req.params.id,
                req.user
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.patch(
    '/:id',
    requirePermission('customers:update'),
    validateBody(updateCustomerSchema),
    async (req, res, next) => {
        try {
            const result = await customerService.updateCustomer(
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
    '/:id/kyc',
    requirePermission('customers:update'),
    validateBody(verifyKycSchema),
    async (req, res, next) => {
        try {
            const result = await customerService.verifyKyc(
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
