import { AuthorizationError } from '../shared/errors.js';

/**
 * requirePermission — RBAC guard factory.
 *
 * Usage on a route:
 *   router.post('/units/:id/block', requirePermission('units:block'), handler)
 *   router.post('/bookings', requirePermission('bookings:create'), handler)
 *
 * Multiple permissions (user must have ALL):
 *   requirePermission('bookings:create', 'units:block')
 *
 * @param {...string} requiredPermissions - Permission strings to check
 * @returns Express middleware function
 */
export const requirePermission = (...requiredPermissions) => {
    return (req, res, next) => {
        try {
            const userPermissions = req.user?.permissions || [];
            const userRole = req.user?.role;

            // Admin role bypasses all permission checks
            if (userRole === 'admin') {
                return next();
            }

            // Check all required permissions are present
            const missingPermissions = requiredPermissions.filter(
                (permission) => !userPermissions.includes(permission)
            );

            if (missingPermissions.length > 0) {
                throw new AuthorizationError(
                    `Insufficient permissions. Missing: ${missingPermissions.join(', ')}`
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * requireRole — Role-level guard (coarser than permission check).
 * Use when an entire route section is role-gated.
 *
 * Usage: requireRole('admin', 'finance')
 *
 * @param {...string} allowedRoles
 * @returns Express middleware function
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            const userRole = req.user?.role;

            if (!allowedRoles.includes(userRole)) {
                throw new AuthorizationError(
                    `This action requires one of the following roles: ${allowedRoles.join(', ')}`
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * PERMISSIONS REFERENCE — used across all route files
 *
 * Projects:      projects:read, projects:create, projects:update
 * Units:         units:read, units:block, units:token
 * Bookings:      bookings:read, bookings:create, bookings:update
 * Payments:      payments:read, payments:create, payments:update
 * Leads:         leads:read, leads:create, leads:update
 * Site Visits:   site_visits:read, site_visits:create, site_visits:update
 * Follow-ups:    follow_ups:read, follow_ups:create, follow_ups:update
 * Sales Team:    sales_team:read, sales_team:create, sales_team:update
 * Agents:        agents:read, agents:create, agents:update
 * Commissions:   commissions:read, commissions:update
 * Demand Letters:demand_letters:read, demand_letters:create, demand_letters:update
 * Cancellations: cancellations:read, cancellations:create
 * Transfers:     transfers:read, transfers:create
 * Possession:    possession:read, possession:create, possession:update
 * Complaints:    complaints:read, complaints:create, complaints:update
 * Customers:     customers:read, customers:update
 * Documents:     documents:read, documents:create, documents:update
 * Communications:communications:read, communications:create
 * Loans:         loans:read, loans:create, loans:update
 * Approvals:     approvals:read, approvals:approve
 * Analytics:     analytics:read, analytics:financial
 * Audit:         audit:read
 * Org Settings:  org:settings:update
 */
