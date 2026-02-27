/**
 * buildDateRangeFilter — converts from/to query params into
 * a Prisma date range filter.
 *
 * Usage:
 *   where.createdAt = buildDateRangeFilter(query.from, query.to);
 */
export const buildDateRangeFilter = (from, to) => {
    if (!from && !to) return undefined;

    const filter = {};
    if (from) filter.gte = new Date(from);
    if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999); // inclusive end of day
        filter.lte = toDate;
    }
    return filter;
};

/**
 * buildSearchFilter — builds a Prisma contains filter for
 * case-insensitive string search across multiple fields.
 *
 * Usage:
 *   const searchFilter = buildSearchFilter(query.search,
 *     ['fullName', 'mobile', 'email']);
 *   if (searchFilter) where.OR = searchFilter;
 */
export const buildSearchFilter = (searchTerm, fields = []) => {
    if (!searchTerm || !fields.length) return undefined;

    return fields.map((field) => ({
        [field]: {
            contains: searchTerm,
            mode: 'insensitive',
        },
    }));
};

/**
 * buildEnumFilter — converts a comma-separated query param
 * into a Prisma IN filter.
 *
 * Usage:
 *   where.status = buildEnumFilter(query.status);
 *   // query.status = "available,blocked" → { in: ['available', 'blocked'] }
 */
export const buildEnumFilter = (value) => {
    if (!value) return undefined;
    const values = value.split(',').map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return undefined;
    if (values.length === 1) return values[0];
    return { in: values };
};

/**
 * buildBooleanFilter — safely converts string query param to boolean.
 *
 * Usage:
 *   where.isActive = buildBooleanFilter(query.isActive);
 */
export const buildBooleanFilter = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
};

/**
 * buildNumericRangeFilter — converts min/max query params
 * into a Prisma range filter for BigInt or numeric fields.
 *
 * Usage:
 *   where.totalPrice = buildNumericRangeFilter(query.minPrice, query.maxPrice);
 */
export const buildNumericRangeFilter = (min, max) => {
    if (!min && !max) return undefined;

    const filter = {};
    if (min) filter.gte = BigInt(min);
    if (max) filter.lte = BigInt(max);
    return filter;
};

/**
 * cleanObject — removes undefined keys from a WHERE clause object
 * so Prisma doesn't error on undefined values.
 *
 * Usage:
 *   const where = cleanObject({ organizationId, status, config });
 */
export const cleanObject = (obj) => {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
    );
};
