import prisma from '../../config/database.js';
import { encrypt, safeDecrypt } from '../../shared/encryption.js';
import { hashPan } from '../../shared/cryptoHash.js';
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
    // Decrypt the encrypted values first
    const pan = safeDecrypt(customer.panNumber);
    const aadhaar = safeDecrypt(customer.aadhaarNumber);

    // Admin and finance see full decrypted values
    if (role === 'admin' || role === 'finance') {
        return {
            ...customer,
            panNumber: pan,
            aadhaarNumber: aadhaar,
        };
    }

    // All other roles see masked values
    return {
        ...customer,
        panNumber: pan
            ? `${pan.slice(0, 2)}XXXXX${pan.slice(-2)}`
            : null,
        aadhaarNumber: aadhaar
            ? `XXXX-XXXX-${aadhaar.slice(-4)}`
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
    // ── PAN find-or-create (BKG-006) ────────────────────────────────────
    if (body.panNumber) {
        const panHash = hashPan(body.panNumber);

        const existingByPan = await prisma.customer.findFirst({
            where: { organizationId, panHash, isActive: true },
        });

        if (existingByPan) {
            // Return existing customer — do NOT create duplicate
            return buildActionResponse(
                {
                    id: existingByPan.id,
                    customerCode: existingByPan.customerCode,
                    fullName: existingByPan.fullName,
                    mobilePrimary: existingByPan.mobilePrimary,
                    isExisting: true,
                },
                `Returning customer found (${existingByPan.customerCode}). ` +
                `Use this customer record for the new booking.`
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
            // Encrypt PAN and Aadhaar before storing
            panNumber: body.panNumber ? encrypt(body.panNumber) : null,
            panHash: body.panNumber ? hashPan(body.panNumber) : null,
            aadhaarNumber: body.aadhaarNumber
                ? encrypt(body.aadhaarNumber)
                : null,
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
    if (body.kycVerified && !customer.panHash) {
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
