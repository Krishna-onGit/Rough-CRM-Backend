import prisma from '../../config/database.js';
import {
    NotFoundError,
    BusinessRuleError,
    ConflictError,
} from '../../shared/errors.js';
import {
    parsePagination,
    buildPaginatedResponse,
    buildSingleResponse,
    buildActionResponse,
} from '../../shared/pagination.js';
import {
    buildEnumFilter,
    cleanObject,
} from '../../shared/filters.js';
import {
    paiseToRupees,
    rupeesToPaise,
} from '../../shared/costSheet.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * calculateEmi — standard EMI formula.
 * EMI = P × r × (1+r)^n / ((1+r)^n - 1)
 * where P = principal, r = monthly rate, n = tenure months
 */
const calculateEmi = (principal, annualRatePct, tenureMonths) => {
    const monthlyRate = annualRatePct / 100 / 12;
    if (monthlyRate === 0) return principal / tenureMonths;
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    return Math.round((principal * monthlyRate * factor) /
        (factor - 1));
};

// ── List Loans ────────────────────────────────────────────────────────────────

export const listLoans = async (organizationId, query = {}) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        bookingId: query.bookingId || undefined,
        customerId: query.customerId || undefined,
        status: buildEnumFilter(query.status),
    });

    const [loans, total] = await Promise.all([
        prisma.loanRecord.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                bookingId: true,
                customerId: true,
                bankName: true,
                loanAmount: true,
                sanctionedAmount: true,
                interestRate: true,
                tenureMonths: true,
                status: true,
                disbursements: true,
                sanctionDate: true,
                createdAt: true,
            },
        }),
        prisma.loanRecord.count({ where }),
    ]);

    const formatted = loans.map((l) => {
        const disbursements = Array.isArray(l.disbursements) ? l.disbursements : [];
        const disbursedPaise = disbursements.reduce(
            (sum, d) => sum + BigInt(d.amount || 0), 0n
        );
        return {
            ...l,
            interestRate: Number(l.interestRate),
            loanAmount: paiseToRupees(l.loanAmount),
            sanctionedAmount: paiseToRupees(l.sanctionedAmount),
            disbursedAmount: paiseToRupees(disbursedPaise),
        };
    });

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Loan ───────────────────────────────────────────────────────────

export const getLoan = async (organizationId, loanId) => {
    const loan = await prisma.loanRecord.findFirst({
        where: { id: loanId, organizationId },
    });
    if (!loan) throw new NotFoundError('Loan record');

    const sanctioned = loan.sanctionedAmount;
    const disbursements = Array.isArray(loan.disbursements) ? loan.disbursements : [];
    const disbursed = disbursements.reduce(
        (sum, d) => sum + BigInt(d.amount || 0), 0n
    );
    const remaining = sanctioned - disbursed;

    return buildSingleResponse({
        ...loan,
        interestRate: Number(loan.interestRate),
        loanAmount: paiseToRupees(loan.loanAmount),
        sanctionedAmount: paiseToRupees(sanctioned),
        disbursedAmount: paiseToRupees(disbursed),
        remainingToDisbursе: paiseToRupees(remaining > 0n ? remaining : 0n),
        disbursementPct: sanctioned > 0n
            ? Math.round((Number(disbursed) / Number(sanctioned)) * 100)
            : 0,
    });
};

// ── Create Loan ───────────────────────────────────────────────────────────────

export const createLoan = async (
    organizationId,
    userId,
    body
) => {
    const {
        bookingId,
        customerId,
        bankName,
        sanctionedAmount,
        interestRate,
        tenureMonths,
        sanctionDate,
        remarks,
        emiAmount,
        // Discard fields not in the LoanRecord schema
        // (unitId, loanAccountNumber, branchName, loanOfficer, loanOfficerMobile
        //  are sent by API clients but don't map to DB columns)
    } = body;

    // Verify booking exists
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            organizationId,
            status: { notIn: ['cancelled'] },
        },
    });
    if (!booking) throw new NotFoundError('Booking');

    // Check no active loan exists for this booking
    const existingLoan = await prisma.loanRecord.findFirst({
        where: {
            bookingId,
            organizationId,
            status: { notIn: ['rejected'] },
        },
    });
    if (existingLoan) {
        throw new ConflictError(
            'An active loan record already exists for this booking.'
        );
    }

    const sanctionedPaise = rupeesToPaise(sanctionedAmount);

    // Auto-calculate EMI if not provided
    const calculatedEmi = emiAmount
        ? rupeesToPaise(emiAmount)
        : rupeesToPaise(
            calculateEmi(sanctionedAmount, interestRate, tenureMonths)
        );

    // Validate sanctioned amount does not exceed booking value
    if (sanctionedPaise > booking.finalValue) {
        throw new BusinessRuleError(
            `Loan sanctioned amount (₹${sanctionedAmount.toLocaleString(
                'en-IN'
            )}) cannot exceed booking final value ` +
            `(₹${paiseToRupees(booking.finalValue).toLocaleString(
                'en-IN'
            )}).`
        );
    }

    const loan = await prisma.loanRecord.create({
        data: {
            organizationId,
            bookingId,
            customerId,
            bankName,
            loanAmount: sanctionedPaise,
            sanctionedAmount: sanctionedPaise,
            interestRate,
            tenureMonths,
            sanctionDate: sanctionDate || null,
            remarks: remarks || null,
            status: 'applied',
            disbursements: [],
        },
    });

    return buildActionResponse(
        {
            id: loan.id,
            bankName: loan.bankName,
            sanctionedAmount: paiseToRupees(loan.sanctionedAmount),
            calculatedEmi: paiseToRupees(calculatedEmi),
            tenureMonths: loan.tenureMonths,
            status: loan.status,
        },
        `Loan record created. Calculated EMI: ` +
        `₹${paiseToRupees(calculatedEmi).toLocaleString('en-IN')}/month.`
    );
};

// ── Update Loan ───────────────────────────────────────────────────────────────

export const updateLoan = async (
    organizationId,
    loanId,
    userId,
    body
) => {
    const loan = await prisma.loanRecord.findFirst({
        where: { id: loanId, organizationId },
    });
    if (!loan) throw new NotFoundError('Loan record');

    if (loan.status === 'rejected') {
        throw new BusinessRuleError(
            `Loan is already "${loan.status}" and cannot be updated.`
        );
    }

    // Only update fields that exist in the LoanRecord schema
    const { bankName, remarks, sanctionDate } = body;
    const updated = await prisma.loanRecord.update({
        where: { id: loanId },
        data: {
            ...(bankName !== undefined && { bankName }),
            ...(remarks !== undefined && { remarks }),
            ...(sanctionDate !== undefined && { sanctionDate }),
        },
    });

    return buildActionResponse(
        {
            id: updated.id,
            bankName: updated.bankName,
            status: updated.status,
        },
        'Loan record updated successfully.'
    );
};

// ── Record Disbursement ───────────────────────────────────────────────────────

export const recordDisbursement = async (
    organizationId,
    loanId,
    userId,
    body
) => {
    const loan = await prisma.loanRecord.findFirst({
        where: { id: loanId, organizationId },
    });
    if (!loan) throw new NotFoundError('Loan record');

    if (loan.status === 'rejected') {
        throw new BusinessRuleError(
            `Cannot record disbursement for a ${loan.status} loan.`
        );
    }

    const { amount, disbursementDate, transactionRef, remarks } = body;
    const amountPaise = rupeesToPaise(amount);

    // Compute already-disbursed total from JSONB array (no disbursedAmount column in schema)
    const existingDisbursements = Array.isArray(loan.disbursements)
        ? loan.disbursements
        : [];
    const alreadyDisbursed = existingDisbursements.reduce(
        (sum, d) => sum + BigInt(d.amount || 0), 0n
    );

    // Check disbursement does not exceed sanctioned amount
    const newDisbursed = alreadyDisbursed + amountPaise;
    if (newDisbursed > loan.sanctionedAmount) {
        throw new BusinessRuleError(
            `Total disbursed amount would exceed sanctioned amount. ` +
            `Remaining: ₹${paiseToRupees(
                loan.sanctionedAmount - alreadyDisbursed
            ).toLocaleString('en-IN')}.`
        );
    }

    const isFullyDisbursed = newDisbursed >= loan.sanctionedAmount;

    const newDisbursement = {
        amount: Number(amountPaise),
        disbursementDate,
        transactionRef: transactionRef || null,
        remarks: remarks || null,
        recordedBy: userId,
        recordedAt: new Date().toISOString(),
    };

    await prisma.loanRecord.update({
        where: { id: loanId },
        data: {
            disbursements: [...existingDisbursements, newDisbursement],
            status: isFullyDisbursed ? 'fully_disbursed' : 'disbursing',
        },
    });

    return buildActionResponse(
        {
            loanId,
            disbursedAmount: paiseToRupees(amountPaise),
            totalDisbursed: paiseToRupees(newDisbursed),
            remainingToDisbursе: paiseToRupees(loan.sanctionedAmount - newDisbursed),
            loanStatus: isFullyDisbursed ? 'fully_disbursed' : 'disbursing',
            fullyDisbursed: isFullyDisbursed,
        },
        `Disbursement of ₹${amount.toLocaleString('en-IN')} recorded. ` +
        `${isFullyDisbursed
            ? 'Loan fully disbursed.'
            : `₹${paiseToRupees(
                loan.sanctionedAmount - newDisbursed
            ).toLocaleString('en-IN')} remaining.`
        }`
    );
};

// ── Update Loan Status ────────────────────────────────────────────────────────

export const updateLoanStatus = async (
    organizationId,
    loanId,
    userId,
    body
) => {
    const loan = await prisma.loanRecord.findFirst({
        where: { id: loanId, organizationId },
    });
    if (!loan) throw new NotFoundError('Loan record');

    if (loan.status === 'rejected') {
        throw new BusinessRuleError(
            `Loan is already "${loan.status}" and cannot be updated.`
        );
    }

    const { status, remarks } = body;

    const updated = await prisma.loanRecord.update({
        where: { id: loanId },
        data: { status, remarks: remarks || loan.remarks },
    });

    return buildActionResponse(
        {
            id: updated.id,
            previousStatus: loan.status,
            newStatus: updated.status,
        },
        `Loan status updated from "${loan.status}" to "${status}".`
    );
};
