import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireOrganization } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
    validateBody,
    createBookingSchema,
} from './booking.schema.js';
import * as bookingService from './booking.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOrganization);

router.get(
    '/',
    requirePermission('bookings:read'),
    async (req, res, next) => {
        try {
            const result = await bookingService.listBookings(
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
    requirePermission('bookings:read'),
    async (req, res, next) => {
        try {
            const result = await bookingService.getBooking(
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
    '/',
    requirePermission('bookings:create'),
    validateBody(createBookingSchema),
    async (req, res, next) => {
        try {
            const result = await bookingService.createBooking(
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

// PATCH /v1/bookings/:id/register
router.patch(
    '/:id/register',
    requirePermission('bookings:update'),
    async (req, res, next) => {
        try {
            const result = await bookingService.registerBooking(
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
