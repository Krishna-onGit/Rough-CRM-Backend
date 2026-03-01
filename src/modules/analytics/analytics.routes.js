import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from
    '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import * as analyticsService from './analytics.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/dashboard',
    requirePermission('analytics:read'),
    async (req, res, next) => {
        try {
            const result =
                await analyticsService.getExecutiveDashboard(
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
    '/sales',
    requirePermission('analytics:read'),
    async (req, res, next) => {
        try {
            const result = await analyticsService.getSalesAnalytics(
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
    '/collections',
    requirePermission('analytics:read'),
    async (req, res, next) => {
        try {
            const result =
                await analyticsService.getCollectionAnalytics(
                    req.organizationId,
                    req.query
                );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
