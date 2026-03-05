import { Router } from 'express';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody, blockUnitSchema, tokenSchema } from './unit.schema.js';
import * as unitService from './unit.service.js';

const router = Router();

router.get(
    '/',
    requirePermission('units:read'),
    async (req, res, next) => {
        try {
            const result = await unitService.listUnits(
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
    requirePermission('units:read'),
    async (req, res, next) => {
        try {
            const result = await unitService.getUnit(
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
    '/:id/block',
    requirePermission('units:block'),
    validateBody(blockUnitSchema),
    async (req, res, next) => {
        try {
            const result = await unitService.blockUnit(
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
    '/:id/release',
    requirePermission('units:block'),
    async (req, res, next) => {
        try {
            const result = await unitService.releaseUnit(
                req.organizationId,
                req.params.id,
                req.user.userId
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.post(
    '/:id/token',
    requirePermission('units:token'),
    validateBody(tokenSchema),
    async (req, res, next) => {
        try {
            const result = await unitService.recordToken(
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
    '/:id/cost-sheet',
    requirePermission('units:read'),
    async (req, res, next) => {
        try {
            const result = await unitService.getCostSheet(
                req.organizationId,
                req.params.id
            );
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

export default router;
