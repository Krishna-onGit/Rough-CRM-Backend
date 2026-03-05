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

        // Set PostgreSQL session variable for RLS using set_config().
        // SET command does not support parameterized values ($1), but
        // set_config() does — this preserves the SQL injection safety
        // of $executeRaw while remaining functionally equivalent to
        // the original SET statement.
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, false)`;

        // Attach to request for convenient access in route handlers
        req.organizationId = organizationId;

        next();
    } catch (error) {
        next(error);
    }
};
