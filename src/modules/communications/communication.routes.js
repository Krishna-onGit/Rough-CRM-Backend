import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    logCommunicationSchema,
} from './communication.schema.js';
import * as communicationService from './communication.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('communications:read'),
    async (req, res, next) => {
        try {
            const result = await communicationService.listCommunications(
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
    requirePermission('communications:create'),
    validateBody(logCommunicationSchema),
    async (req, res, next) => {
        try {
            const result = await communicationService.logCommunication(
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
    '/summary',
    requirePermission('communications:read'),
    async (req, res, next) => {
        try {
            const result =
                await communicationService.getCommunicationSummary(
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
