import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createSalesPersonSchema,
    updateSalesPersonSchema,
} from './salesPerson.schema.js';
import * as salesPersonService from './salesPerson.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('sales_team:read'),
    async (req, res, next) => {
        try {
            const result = await salesPersonService.listSalesPersons(
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
    requirePermission('sales_team:create'),
    validateBody(createSalesPersonSchema),
    async (req, res, next) => {
        try {
            const result = await salesPersonService.createSalesPerson(
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
    '/performance',
    requirePermission('sales_team:read'),
    async (req, res, next) => {
        try {
            const result = await salesPersonService.getTeamPerformance(
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
    requirePermission('sales_team:read'),
    async (req, res, next) => {
        try {
            const result = await salesPersonService.getSalesPerson(
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
    requirePermission('sales_team:update'),
    validateBody(updateSalesPersonSchema),
    async (req, res, next) => {
        try {
            const result = await salesPersonService.updateSalesPerson(
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
