import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createAgentSchema,
    updateAgentSchema,
    recordCommissionPaymentSchema,
} from './agent.schema.js';
import * as agentService from './agent.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('agents:read'),
    async (req, res, next) => {
        try {
            const result = await agentService.listAgents(
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
    requirePermission('agents:create'),
    validateBody(createAgentSchema),
    async (req, res, next) => {
        try {
            const result = await agentService.createAgent(
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
    requirePermission('agents:read'),
    async (req, res, next) => {
        try {
            const result = await agentService.getAgent(
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
    requirePermission('agents:update'),
    validateBody(updateAgentSchema),
    async (req, res, next) => {
        try {
            const result = await agentService.updateAgent(
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
    '/:id/commission-payment',
    requirePermission('commissions:update'),
    validateBody(recordCommissionPaymentSchema),
    async (req, res, next) => {
        try {
            const result = await agentService.recordCommissionPayment(
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
    '/:id/rating',
    requirePermission('agents:update'),
    async (req, res, next) => {
        try {
            const { rating } = req.body;
            const result = await agentService.rateAgent(
                req.organizationId,
                req.params.id,
                req.user.userId,
                rating
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
