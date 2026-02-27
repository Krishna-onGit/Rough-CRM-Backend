import { env } from '../config/env.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * parsePagination — extracts and validates pagination params from query string.
 *
 * Usage in a route handler:
 *   const { skip, take, page, pageSize } = parsePagination(req.query);
 *   const data = await prisma.unit.findMany({ skip, take });
 *   return paginate(data, total, page, pageSize);
 */
export const parsePagination = (query = {}) => {
    let page = parseInt(query.page, 10) || 1;
    let pageSize = parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;

    // Sanitize bounds
    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = DEFAULT_PAGE_SIZE;
    if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    return { skip, take, page, pageSize };
};

/**
 * buildPaginatedResponse — builds the standard API response envelope
 * for paginated endpoints.
 *
 * Usage:
 *   res.json(buildPaginatedResponse(units, total, page, pageSize));
 */
export const buildPaginatedResponse = (data, total, page, pageSize) => {
    const totalPages = Math.ceil(total / pageSize);

    return {
        success: true,
        data,
        meta: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
};

/**
 * buildSingleResponse — standard envelope for single-item responses.
 */
export const buildSingleResponse = (data) => ({
    success: true,
    data,
});

/**
 * buildActionResponse — standard envelope for action responses
 * (create, update, delete, status change).
 */
export const buildActionResponse = (data, message = 'Operation successful') => ({
    success: true,
    message,
    data,
});
