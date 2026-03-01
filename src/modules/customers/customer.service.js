import prisma from '../../config/database.js';
import {
    NotFoundError,
    ConflictError,
    BusinessRuleError,
} from '../../shared/errors.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildSearchFilter,
    buildBooleanFilter,
    cleanObject,
} from '../../shared/filters.js';
import { paiseToRupees, rupeesToPaise } from '../../shared/costSheet.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateCustomerCode = async (organizationId) => {
    const count = await prisma.customer.count({
        where: { organizationId },
    });
    return `CUST-${String(count + 1).padStart(4, '0')}`;
};

// Mask sensitive fields for non-admin roles
const maskSensitiveData = (customer, role) => {
    if (role === 'admin' || role === 'finance') return customer;
    return {
        ...customer,
        panNumber: customer.panNumber
            ? `${customer.panNumber.slice(0, 2)}XXXXX${customer.panNumber.slice(-2)}`
            : null,
        aadhaarNumber: customer.aadhaarNumber
            ? `XXXX-XXXX-${customer.aadhaarNumber.slice(-4)}`
            : null,
    };
};

// ── List Customers ────────────────────────────────────────────────────────────

export const listCustomers = async (
    organizationId,
    query = {},
    user = {}
) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        isActive: buildBooleanFilter(query.isActive) ?? true,
        kycVerified: buildBooleanFilter(query.kycVerified),
    });

    const searchFilter = buildSearchFilter(query.search, [
        'fullName',
        'mobilePrimary',
        'email',
        'customerCode',
    ]);
    if (searchFilter) where.OR = searchFilter;

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                customerCode: true,
                fullName: true,
                mobilePrimary: true,
                email: true,
                panNumber: true,
                kycVerified: true,
                isActive: true,
                createdAt: true,
            },
        }),
        prisma.customer.count({ where }),
    ]);

    const formatted = customers.map((c) =>
        maskSensitiveData(c, user.role)
    );

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Customer ───────────────────────────────────────────────────────

export const getCustomer = async (
    organizationId,
    customerId,
    user = {}
) => {
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    // Get all bookings for this customer
    const bookings = await prisma.booking.findMany({
        where: { customerId, organizationId },
        select: {
            id: true,
            bookingCode: true,
            unitId: true,
            projectId: true,
            status: true,
            finalValue: true,
            bookingDate: true,
        },
        orderBy: { bookingDate: 'desc' },
    });

    return buildSingleResponse({
        ...maskSensitiveData(customer, user.role),
        annualIncome: customer.annualIncome
            ? paiseToRupees(customer.annualIncome)
            : null,
        loanAmount: customer.loanAmount
            ? paiseToRupees(customer.loanAmount)
            : null,
        bookings: bookings.map((b) => ({
            ...b,
            finalValue: paiseToRupees(b.finalValue),
        })),
    });
};

// ── Create Customer ───────────────────────────────────────────────────────────

export const createCustomer = async (
    organizationId,
    userId,
    body
) => {
    // Check PAN uniqueness within org
    if (body.panNumber) {
        const existingPan = await prisma.customer.findFirst({
            where: {
                organizationId,
                panNumber: body.panNumber,
                isActive: true,
            },
        });
        if (existingPan) {
            throw new ConflictError(
                `A customer with PAN ${body.panNumber} already exists ` +
                `(${existingPan.customerCode}).`
            );
        }
    }

    // Check mobile uniqueness within org
    const existingMobile = await prisma.customer.findFirst({
        where: {
            organizationId,
            mobilePrimary: body.mobilePrimary,
            isActive: true,
        },
    });
    if (existingMobile) {
        throw new ConflictError(
            `A customer with mobile ${body.mobilePrimary} already ` +
            `exists (${existingMobile.customerCode}).`
        );
    }

    const customerCode = await generateCustomerCode(organizationId);

    const customer = await prisma.customer.create({
        data: {
            ...body,
            organizationId,
            customerCode,
            annualIncome: body.annualIncome
                ? rupeesToPaise(body.annualIncome)
                : null,
            loanAmount: body.loanAmount
                ? rupeesToPaise(body.loanAmount)
                : null,
            dateOfBirth: body.dateOfBirth
                ? new Date(body.dateOfBirth)
                : null,
            kycDocuments: [],
            kycVerified: false,
            isActive: true,
            createdBy: userId,
        },
    });

    return buildActionResponse(
        {
            id: customer.id,
            customerCode: customer.customerCode,
            fullName: customer.fullName,
            mobilePrimary: customer.mobilePrimary,
        },
        `Customer ${customerCode} created successfully.`
    );
};

// ── Update Customer ───────────────────────────────────────────────────────────

export const updateCustomer = async (
    organizationId,
    customerId,
    userId,
    body
) => {
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    const updateData = { ...body };

    if (body.annualIncome !== undefined) {
        updateData.annualIncome = body.annualIncome
            ? rupeesToPaise(body.annualIncome)
            : null;
    }
    if (body.loanAmount !== undefined) {
        updateData.loanAmount = body.loanAmount
            ? rupeesToPaise(body.loanAmount)
            : null;
    }
    if (body.dateOfBirth) {
        updateData.dateOfBirth = new Date(body.dateOfBirth);
    }

    const updated = await prisma.customer.update({
        where: { id: customerId },
        data: updateData,
    });

    return buildActionResponse(
        { id: updated.id, customerCode: updated.customerCode },
        'Customer updated successfully.'
    );
};

// ── Verify KYC ────────────────────────────────────────────────────────────────

export const verifyKyc = async (
    organizationId,
    customerId,
    userId,
    body
) => {
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer');

    // Require at least PAN to verify KYC
    if (body.kycVerified && !customer.panNumber) {
        throw new BusinessRuleError(
            'Cannot verify KYC without a PAN number on file.'
        );
    }

    const updated = await prisma.customer.update({
        where: { id: customerId },
        data: { kycVerified: body.kycVerified },
    });

    return buildActionResponse(
        {
            id: updated.id,
            customerCode: updated.customerCode,
            kycVerified: updated.kycVerified,
        },
        `KYC ${body.kycVerified ? 'verified' : 'unverified'} successfully.`
    );
};
