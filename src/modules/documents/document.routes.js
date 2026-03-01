import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    uploadDocumentSchema,
    verifyDocumentSchema,
} from './document.schema.js';
import * as documentService from './document.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('documents:read'),
    async (req, res, next) => {
        try {
            const result = await documentService.listDocuments(
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
    requirePermission('documents:create'),
    validateBody(uploadDocumentSchema),
    async (req, res, next) => {
        try {
            const result = await documentService.uploadDocument(
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

router.patch(
    '/:id/verify',
    requirePermission('documents:update'),
    validateBody(verifyDocumentSchema),
    async (req, res, next) => {
        try {
            const result = await documentService.verifyDocument(
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
