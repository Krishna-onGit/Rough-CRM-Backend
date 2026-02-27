import prisma from '../config/database.js';
import { AuthorizationError } from '../shared/errors.js';

/**
 * requireOrganization — sets PostgreSQL RLS context for every request.
 * Must run AFTER requireAuth middleware.
 * Sets app.current_organization_id session variable so RLS policies
 * automatically filter all queries to the correct organization.
 */
export const requireOrganization = async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
            throw new AuthorizationError('No organization context found in token.');
        }

        // Set PostgreSQL session variable for RLS
        // This scopes ALL subsequent queries in this request to the org
        await prisma.$executeRawUnsafe(
            `SET app.current_organization_id = '${organizationId}'`
        );

        // Attach to request for convenient access in route handlers
        req.organizationId = organizationId;

        next();
    } catch (error) {
        next(error);
    }
};
