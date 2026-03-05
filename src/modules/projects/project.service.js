import prisma from '../../config/database.js';
import { redis, CacheKeys, CacheTTL } from '../../config/redis.js';
import { rupeesToPaise } from '../../shared/costSheet.js';
import {
    ConflictError,
    NotFoundError,
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
    buildEnumFilter,
    buildBooleanFilter,
    cleanObject,
} from '../../shared/filters.js';
import { generateUnitsForTower } from '../units/unit.generator.js';

// ── List Projects ────────────────────────────────────────────────────────────

export const listProjects = async (organizationId, query = {}) => {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = cleanObject({
        organizationId,
        status: buildEnumFilter(query.status),
        city: query.city || undefined,
        projectType: buildEnumFilter(query.projectType),
        isActive: buildBooleanFilter(query.isActive) ?? true,
    });

    // Search by name or project code
    const searchFilter = buildSearchFilter(query.search, ['name', 'projectCode', 'city']);
    if (searchFilter) where.OR = searchFilter;

    const [projects, total] = await Promise.all([
        prisma.project.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                projectCode: true,
                name: true,
                city: true,
                location: true,
                projectType: true,
                status: true,
                baseRate: true,
                completionPct: true,
                reraNumber: true,
                isActive: true,
                createdAt: true,
                _count: {
                    select: { towers: true, units: true },
                },
            },
        }),
        prisma.project.count({ where }),
    ]);

    // Convert baseRate from paise to rupees for display
    const formatted = projects.map((p) => ({
        ...p,
        baseRate: Number(p.baseRate) / 100,
        completionPct: Number(p.completionPct),
    }));

    return buildPaginatedResponse(formatted, total, page, pageSize);
};

// ── Get Single Project ───────────────────────────────────────────────────────

export const getProject = async (organizationId, projectId) => {
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isActive: true },
        include: {
            towers: {
                where: { isActive: true },
                orderBy: { name: 'asc' },
            },
            _count: {
                select: { units: true },
            },
        },
    });

    if (!project) throw new NotFoundError('Project');

    // Get unit status breakdown from DB
    const unitStats = await prisma.unit.groupBy({
        by: ['status'],
        where: { projectId, organizationId },
        _count: { status: true },
    });

    const statsMap = {};
    unitStats.forEach((s) => {
        statsMap[s.status] = s._count.status;
    });

    return buildSingleResponse({
        ...project,
        baseRate: Number(project.baseRate) / 100,
        completionPct: Number(project.completionPct),
        unitStats: {
            total: project._count.units,
            available: statsMap.available || 0,
            blocked: statsMap.blocked || 0,
            token_received: statsMap.token_received || 0,
            booked: statsMap.booked || 0,
            agreement_done: statsMap.agreement_done || 0,
            registered: statsMap.registered || 0,
            possession_handed: statsMap.possession_handed || 0,
            cancelled: statsMap.cancelled || 0,
        },
    });
};

// ── Create Project + Towers + Units ─────────────────────────────────────────

export const createProject = async (organizationId, userId, body) => {
    const { towers, baseRate, settings, ...projectData } = body;

    // Check project code uniqueness
    const existing = await prisma.project.findUnique({
        where: {
            organizationId_projectCode: {
                organizationId,
                projectCode: projectData.projectCode,
            },
        },
    });
    if (existing) {
        throw new ConflictError(
            `Project code "${projectData.projectCode}" already exists in this organization.`
        );
    }

    // Convert baseRate from rupees (API) to paise (DB)
    const baseRatePaise = rupeesToPaise(baseRate);

    // Create project + towers + units in one transaction
    const result = await prisma.$transaction(async (tx) => {
        // 1. Create project
        const project = await tx.project.create({
            data: {
                ...projectData,
                organizationId,
                baseRate: baseRatePaise,
                settings: settings || {},
                createdBy: userId,
                updatedBy: userId,
            },
        });

        // 2. Create each tower + generate its units
        const createdTowers = [];
        let totalUnitsCreated = 0;

        for (const towerData of towers) {
            const totalUnits = towerData.floors * towerData.unitsPerFloor;

            const tower = await tx.tower.create({
                data: {
                    organizationId,
                    projectId: project.id,
                    name: towerData.name,
                    floors: towerData.floors,
                    unitsPerFloor: towerData.unitsPerFloor,
                    totalUnits,
                },
            });

            // 3. Auto-generate all units for this tower
            const units = generateUnitsForTower({
                organizationId,
                projectId: project.id,
                towerId: tower.id,
                towerName: tower.name,
                floors: towerData.floors,
                unitsPerFloor: towerData.unitsPerFloor,
                baseRate: baseRatePaise,
                projectSettings: settings || {},
                createdBy: userId,
            });

            // Batch insert all units
            await tx.unit.createMany({ data: units });

            createdTowers.push(tower);
            totalUnitsCreated += units.length;
        }

        return { project, towers: createdTowers, totalUnitsCreated };
    });

    return buildActionResponse(
        {
            project: {
                ...result.project,
                baseRate: Number(result.project.baseRate) / 100,
            },
            towers: result.towers,
            totalUnitsCreated: result.totalUnitsCreated,
        },
        `Project created with ${result.totalUnitsCreated} units auto-generated.`
    );
};

// ── Update Project ───────────────────────────────────────────────────────────

export const updateProject = async (organizationId, projectId, userId, body) => {
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isActive: true },
    });
    if (!project) throw new NotFoundError('Project');

    const updateData = { ...body, updatedBy: userId };

    // Convert baseRate if provided
    if (body.baseRate !== undefined) {
        updateData.baseRate = rupeesToPaise(body.baseRate);
    }

    // Convert completionPct if provided
    if (body.completionPct !== undefined) {
        updateData.completionPct = body.completionPct;
    }

    const updated = await prisma.project.update({
        where: { id: projectId },
        data: updateData,
    });

    // Invalidate cache (non-fatal)
    await redis.del(CacheKeys.projectStats(projectId)).catch(() => {});

    return buildActionResponse(
        { ...updated, baseRate: Number(updated.baseRate) / 100 },
        'Project updated successfully.'
    );
};

// ── Update Project Status ────────────────────────────────────────────────────

export const updateProjectStatus = async (
    organizationId,
    projectId,
    userId,
    status
) => {
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
    });
    if (!project) throw new NotFoundError('Project');

    const updated = await prisma.project.update({
        where: { id: projectId },
        data: { status, updatedBy: userId },
    });

    return buildActionResponse(
        { id: updated.id, status: updated.status },
        `Project status updated to "${status}".`
    );
};

// ── List Towers for Project ───────────────────────────────────────────────────

export const listTowers = async (organizationId, projectId) => {
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isActive: true },
    });
    if (!project) throw new NotFoundError('Project');

    const towers = await prisma.tower.findMany({
        where: { projectId, organizationId, isActive: true },
        orderBy: { name: 'asc' },
        include: {
            _count: { select: { units: true } },
        },
    });

    return buildSingleResponse(towers);
};

// ── Add Towers to Existing Project ───────────────────────────────────────────

export const addTowers = async (organizationId, projectId, userId, towersData) => {
    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isActive: true },
    });
    if (!project) throw new NotFoundError('Project');

    const result = await prisma.$transaction(async (tx) => {
        const createdTowers = [];
        let totalUnitsCreated = 0;

        for (const towerData of towersData) {
            // Check tower name uniqueness within project
            const existingTower = await tx.tower.findFirst({
                where: { organizationId, projectId, name: towerData.name },
            });
            if (existingTower) {
                throw new ConflictError(
                    `Tower "${towerData.name}" already exists in this project.`
                );
            }

            const totalUnits = towerData.floors * towerData.unitsPerFloor;

            const tower = await tx.tower.create({
                data: {
                    organizationId,
                    projectId,
                    name: towerData.name,
                    floors: towerData.floors,
                    unitsPerFloor: towerData.unitsPerFloor,
                    totalUnits,
                },
            });

            const units = generateUnitsForTower({
                organizationId,
                projectId,
                towerId: tower.id,
                towerName: tower.name,
                floors: towerData.floors,
                unitsPerFloor: towerData.unitsPerFloor,
                baseRate: project.baseRate,
                projectSettings: project.settings || {},
                createdBy: userId,
            });

            await tx.unit.createMany({ data: units });

            createdTowers.push(tower);
            totalUnitsCreated += units.length;
        }

        return { towers: createdTowers, totalUnitsCreated };
    });

    // Invalidate project stats cache (non-fatal)
    await redis.del(CacheKeys.projectStats(projectId)).catch(() => {});

    return buildActionResponse(
        result,
        `${result.towers.length} tower(s) added with ${result.totalUnitsCreated} units generated.`
    );
};

// ── Get Project Unit Stats ────────────────────────────────────────────────────

export const getProjectUnitStats = async (organizationId, projectId) => {
    // Try cache first
    const cacheKey = CacheKeys.projectStats(projectId);
    let cached = null;
    try { cached = await redis.get(cacheKey); } catch (_) { /* Redis unavailable */ }
    if (cached) return buildSingleResponse(typeof cached === 'string' ? JSON.parse(cached) : cached);

    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isActive: true },
    });
    if (!project) throw new NotFoundError('Project');

    const unitStats = await prisma.unit.groupBy({
        by: ['status'],
        where: { projectId, organizationId },
        _count: { status: true },
    });

    const statsMap = {};
    let total = 0;
    unitStats.forEach((s) => {
        statsMap[s.status] = s._count.status;
        total += s._count.status;
    });

    const stats = {
        projectId,
        total,
        available: statsMap.available || 0,
        blocked: statsMap.blocked || 0,
        token_received: statsMap.token_received || 0,
        booked: statsMap.booked || 0,
        agreement_done: statsMap.agreement_done || 0,
        registered: statsMap.registered || 0,
        possession_handed: statsMap.possession_handed || 0,
        cancelled: statsMap.cancelled || 0,
    };

    // Cache the result (non-fatal)
    await redis.set(cacheKey, stats, { ex: CacheTTL.projectStats }).catch(() => {});

    return buildSingleResponse(stats);
};
