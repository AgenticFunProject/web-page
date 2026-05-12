const API_BASE_URL = '/api';

const PORT_ALIASES = {
    SGSIN: 'singapore',
    USLAX: 'los angeles',
    NLRTM: 'rotterdam',
    CNSHA: 'shanghai',
    HKHKG: 'hong kong',
    DEHAM: 'berlin',
    USNYC: 'washington',
    NYC: 'new york',
    LON: 'london'
};

function normalizeSearchTerm(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return PORT_ALIASES[normalized.toUpperCase()] || normalized;
}

function buildSyntheticSchedules(origin, destination, dateFrom, dateTo) {
    const normalizedOrigin = normalizeSearchTerm(origin) || 'Origin';
    const normalizedDestination = normalizeSearchTerm(destination) || 'Destination';
    const fromDate = new Date(dateFrom);
    const startDate = Number.isNaN(fromDate.getTime())
        ? new Date(Date.UTC(2026, 4, 20, 8, 0, 0))
        : new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(), 8, 0, 0));

    return Array.from({ length: 3 }, (_, index) => {
        const etd = new Date(startDate.getTime() + index * 3 * 24 * 60 * 60 * 1000);
        const eta = new Date(etd.getTime() + (9 + index * 2) * 24 * 60 * 60 * 1000);
        const cutoffDate = new Date(etd.getTime() - 2 * 24 * 60 * 60 * 1000);

        return {
            id: `synthetic-${normalizedOrigin}-${normalizedDestination}-${index + 1}`,
            vesselName: `Demo Vessel ${index + 1}`,
            voyageNumber: `DM-${etd.getUTCFullYear()}-${String(index + 1).padStart(3, '0')}`,
            originPort: origin || normalizedOrigin.replace(/\b\w/g, (char) => char.toUpperCase()),
            destinationPort: destination || normalizedDestination.replace(/\b\w/g, (char) => char.toUpperCase()),
            etd: etd.toISOString(),
            eta: eta.toISOString(),
            cutoffDate: cutoffDate.toISOString()
        };
    });
}

async function loadMockSchedules(origin, destination, dateFrom, dateTo) {
    let schedules = [];
    try {
        const response = await fetch('/mock/db.json');
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        schedules = Array.isArray(data?.schedules) ? data.schedules : [];
    } catch (error) {
        return [];
    }

    const normalizedOrigin = normalizeSearchTerm(origin);
    const normalizedDestination = normalizeSearchTerm(destination);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);

    const matches = schedules.filter((schedule) => {
        if (!schedule || typeof schedule !== 'object') {
            return false;
        }
        const scheduleOrigin = String(schedule.originPort || '').toLowerCase();
        const scheduleDestination = String(schedule.destinationPort || '').toLowerCase();
        const etd = new Date(schedule.etd);

        const originMatch = !normalizedOrigin || scheduleOrigin.includes(normalizedOrigin);
        const destinationMatch = !normalizedDestination || scheduleDestination.includes(normalizedDestination);
        const dateMatch = Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())
            ? true
            : etd >= fromDate && etd <= toDate;

        return originMatch && destinationMatch && dateMatch;
    });

    if (matches.length > 0) {
        return matches;
    }

    return buildSyntheticSchedules(origin, destination, dateFrom, dateTo);
}

const SchedulesAPI = {
    async search(origin, destination, dateFrom, dateTo) {
        try {
            const params = new URLSearchParams({
                origin,
                destination,
                dateFrom,
                dateTo
            });
            const response = await fetch(`${API_BASE_URL}/schedules?${params}`);
            if (response.ok) {
                return response.json();
            }
            return await loadMockSchedules(origin, destination, dateFrom, dateTo);
        } catch (error) {
            // Always return mock or empty data in static-demo mode.
            try {
                return await loadMockSchedules(origin, destination, dateFrom, dateTo);
            } catch (fallbackError) {
                return [];
            }
        }
    }
};

const BASE_RATE_USD = {
    '20ft': 950,
    '40ft': 1400,
    '40ft HC': 1600
};

const PORT_CONGESTION_SURCHARGE_USD = {
    USLAX: 150,
    USNYC: 150
};

const BAF_SURCHARGE_PER_UNIT_USD = 80;
const HEAVY_CARGO_SURCHARGE_PER_UNIT_USD = 200;
const HEAVY_CARGO_THRESHOLD_KG_PER_UNIT = 20000;
const PEAK_SEASON_SURCHARGE_PER_UNIT_USD = 120;

function isPeakSeason(etd) {
    const departure = new Date(etd);
    if (Number.isNaN(departure.getTime())) {
        return false;
    }

    const year = departure.getUTCFullYear();
    const start = new Date(Date.UTC(year, 7, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, 8, 30, 23, 59, 59));
    return departure >= start && departure <= end;
}

async function getScheduleById(scheduleId) {
    const response = await fetch('/mock/db.json');
    if (!response.ok) {
        return null;
    }
    const data = await response.json();
    const schedules = Array.isArray(data?.schedules) ? data.schedules : [];
    return schedules.find((schedule) => schedule.id === scheduleId) || null;
}

async function mockComputeQuote(scheduleId, equipmentType, quantity, cargoWeight) {
    const normalizedQuantity = Number.isFinite(Number(quantity)) ? Math.max(1, Number(quantity)) : 1;
    const normalizedWeight = Number.isFinite(Number(cargoWeight)) ? Math.max(0, Number(cargoWeight)) : 0;
    const baseRate = BASE_RATE_USD[equipmentType] || BASE_RATE_USD['20ft'];

    const schedule = await getScheduleById(scheduleId);
    const destinationPort = schedule?.destinationPort || '';
    const etd = schedule?.etd;

    const freight = baseRate * normalizedQuantity;

    const baf = BAF_SURCHARGE_PER_UNIT_USD * normalizedQuantity;
    const portCongestion = (PORT_CONGESTION_SURCHARGE_USD[destinationPort] || 0) * normalizedQuantity;
    const heavyCargo = (normalizedWeight / normalizedQuantity) > HEAVY_CARGO_THRESHOLD_KG_PER_UNIT
        ? HEAVY_CARGO_SURCHARGE_PER_UNIT_USD * normalizedQuantity
        : 0;
    const peakSeason = isPeakSeason(etd)
        ? PEAK_SEASON_SURCHARGE_PER_UNIT_USD * normalizedQuantity
        : 0;

    const surcharges = baf + portCongestion + heavyCargo + peakSeason;
    const totalPrice = freight + surcharges;

    const validUntil = new Date();
    validUntil.setUTCDate(validUntil.getUTCDate() + 7);

    return {
        id: `QTE-${Date.now()}`,
        currency: 'USD',
        totalPrice,
        validityPeriod: validUntil.toISOString(),
        breakdown: {
            freight,
            surcharges
        },
        lineItems: [
            { description: `Ocean Freight - ${equipmentType} x ${normalizedQuantity}`, amount: freight },
            { description: 'Bunker Adjustment Factor (BAF)', amount: baf },
            { description: `Port Congestion Surcharge - Destination ${destinationPort || 'N/A'}`, amount: portCongestion },
            { description: 'Heavy Cargo Surcharge', amount: heavyCargo },
            { description: 'Peak Season Surcharge', amount: peakSeason }
        ].filter((lineItem) => lineItem.amount > 0)
    };
}

const QuotesAPI = {
    async getQuote(scheduleId, equipmentType, quantity, cargoWeight) {
        try {
            const response = await fetch(`${API_BASE_URL}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduleId,
                    equipmentType,
                    quantity,
                    cargoWeight
                })
            });

            if (response.ok) {
                const payload = await response.json();
                if (payload && payload.totalPrice !== undefined) {
                    return payload;
                }

                if (payload && payload.totalAmount !== undefined) {
                    return {
                        id: payload.id,
                        currency: payload.currency || 'USD',
                        totalPrice: payload.totalAmount,
                        validityPeriod: payload.validUntil,
                        breakdown: {
                            freight: Array.isArray(payload.lineItems)
                                ? payload.lineItems
                                    .filter((item) => String(item.description || '').toLowerCase().includes('ocean freight'))
                                    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
                                : payload.totalAmount,
                            surcharges: Array.isArray(payload.lineItems)
                                ? payload.lineItems
                                    .filter((item) => !String(item.description || '').toLowerCase().includes('ocean freight'))
                                    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
                                : 0
                        }
                    };
                }
            }
        } catch (error) {
            // Backend is optional in local static mode.
        }

        return mockComputeQuote(scheduleId, equipmentType, quantity, cargoWeight);
    }
};

const BookingAPI = {
    async submit(bookingData) {
        const response = await fetch(`${API_BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        if (!response.ok) {
            throw new Error(`Failed to submit booking: ${response.statusText}`);
        }
        return response.json();
    }
};

const API = {
    schedules: SchedulesAPI,
    quotes: QuotesAPI,
    booking: BookingAPI
};
