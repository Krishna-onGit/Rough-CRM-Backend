import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createDemandLetterSchema,
    sendReminderSchema,
} from './demandLetter.schema.js';
import * as demandLetterService from './demandLetter.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('demand_letters:read'),
    async (req, res, next) => {
        try {
            const result = await demandLetterService.listDemandLetters(
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
    requirePermission('demand_letters:create'),
    validateBody(createDemandLetterSchema),
    async (req, res, next) => {
        try {
            const result = await demandLetterService.createDemandLetter(
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
    requirePermission('demand_letters:read'),
    async (req, res, next) => {
        try {
            const result = await demandLetterService.getDemandLetter(
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
    '/:id/remind',
    requirePermission('demand_letters:create'),
    validateBody(sendReminderSchema),
    async (req, res, next) => {
        try {
            const result = await demandLetterService.sendReminder(
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
