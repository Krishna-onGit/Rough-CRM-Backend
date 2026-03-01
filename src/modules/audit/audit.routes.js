import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from
    '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import * as auditService from './audit.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('audit:read'),
    async (req, res, next) => {
        try {
            const result = await auditService.listAuditLogs(
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
    '/entity/:entityType/:entityId',
    requirePermission('audit:read'),
    async (req, res, next) => {
        try {
            const result = await auditService.getEntityAuditTrail(
                req.organizationId,
                req.params.entityType,
                req.params.entityId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.get(
    '/user/:userId',
    requirePermission('audit:read'),
    async (req, res, next) => {
        try {
            const result = await auditService.getUserActivity(
                req.organizationId,
                req.params.userId,
                req.query
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
