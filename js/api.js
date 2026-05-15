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

const QUOTES_SCHEDULE_STUBS = [
    {
        id: 'df62a7d2-a45e-4d4d-b3cb-b4af65435274',
        originPort: 'NLRTM',
        destinationPort: 'USNYC',
        vesselName: 'MSC Rotterdam',
        voyageNumber: 'RTM-2026-001',
        etd: '2026-08-18T08:00:00Z',
        eta: '2026-08-28T08:00:00Z',
        cutoffDate: '2026-08-16T08:00:00Z'
    },
    {
        id: '7a59721c-a45e-4d4d-b3cb-b4af65435274',
        originPort: 'CNSHA',
        destinationPort: 'DEHAM',
        vesselName: 'Cosco Shanghai',
        voyageNumber: 'SHA-2026-002',
        etd: '2026-06-05T08:00:00Z',
        eta: '2026-06-20T08:00:00Z',
        cutoffDate: '2026-06-03T08:00:00Z'
    }
];

function normalizeSearchTerm(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return PORT_ALIASES[normalized.toUpperCase()] || normalized;
}

function findStubSchedule(origin, destination) {
    const normOrigin = normalizeSearchTerm(origin);
    const normDest = normalizeSearchTerm(destination);

    for (const stub of QUOTES_SCHEDULE_STUBS) {
        const stubOrigin = normalizeSearchTerm(stub.originPort);
        const stubDest = normalizeSearchTerm(stub.destinationPort);
        if (stubOrigin === normOrigin && stubDest === normDest) {
            return stub;
        }
    }

    return null;
}

function buildSyntheticSchedules(origin, destination, dateFrom, dateTo) {
    const stub = findStubSchedule(origin, destination);
    if (stub) {
        return [{
            id: stub.id,
            vesselName: stub.vesselName,
            voyageNumber: stub.voyageNumber,
            originPort: stub.originPort,
            destinationPort: stub.destinationPort,
            etd: stub.etd,
            eta: stub.eta,
            cutoffDate: stub.cutoffDate
        }];
    }

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
    const stub = findStubSchedule(origin, destination);
    if (stub) {
        return [stub];
    }

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
const WEIGHT_SURCHARGE_PER_1000KG_USD = 12;
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
    const weightSurcharge = Math.round((normalizedWeight / 1000) * WEIGHT_SURCHARGE_PER_1000KG_USD * 100) / 100;
    const heavyCargo = (normalizedWeight / normalizedQuantity) > HEAVY_CARGO_THRESHOLD_KG_PER_UNIT
        ? HEAVY_CARGO_SURCHARGE_PER_UNIT_USD * normalizedQuantity
        : 0;
    const peakSeason = isPeakSeason(etd)
        ? PEAK_SEASON_SURCHARGE_PER_UNIT_USD * normalizedQuantity
        : 0;

    const surcharges = baf + portCongestion + weightSurcharge + heavyCargo + peakSeason;
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
            { description: 'Weight Handling Surcharge', amount: weightSurcharge },
            { description: 'Heavy Cargo Surcharge', amount: heavyCargo },
            { description: 'Peak Season Surcharge', amount: peakSeason }
        ].filter((lineItem) => lineItem.amount > 0)
    };
}

function mapQuoteResponse(payload) {
    const totalPrice = payload.totalAmount !== undefined ? payload.totalAmount : payload.totalPrice;
    const freight = Array.isArray(payload.lineItems)
        ? payload.lineItems
            .filter((item) => String(item.description || '').toLowerCase().includes('ocean freight'))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : totalPrice;
    const surcharges = Array.isArray(payload.lineItems)
        ? payload.lineItems
            .filter((item) => !String(item.description || '').toLowerCase().includes('ocean freight'))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : 0;

    return {
        id: payload.quoteReference || payload.id,
        currency: payload.currency || 'USD',
        totalPrice,
        validityPeriod: payload.validUntil,
        breakdown: { freight, surcharges },
        lineItems: payload.lineItems || []
    };
}

const QuotesAPI = {
    async getQuote(scheduleId, equipmentType, quantity, cargoWeight) {
        const quotesApiType = getQuoteEquipmentType(equipmentType) || '20FT';

        try {
            const response = await fetch(`${API_BASE_URL}/quotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduleId: scheduleId,
                    equipment: [{ type: quotesApiType, quantity: Number(quantity) || 1 }],
                    cargoWeightKg: Number(cargoWeight) || 0
                })
            });

            if (response.ok) {
                const payload = await response.json();
                return mapQuoteResponse(payload);
            }

            if (response.status === 400) {
                const errorBody = await response.json().catch(() => ({}));
                console.warn('Quotes API returned 400, falling back to mock:', errorBody.detail || errorBody);
            }
        } catch (error) {
            console.warn('Quotes API unavailable, falling back to mock:', error.message);
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

const TOKEN_STORE = {
    _token: null,
    _expiresAt: 0,

    async getToken() {
        if (this._token && Date.now() < this._expiresAt) {
            return this._token;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/auth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: 'frontend-user',
                    scopes: ['equipments:read', 'equipments:modify'],
                    expiresInMinutes: 60,
                }),
            });
            if (!res.ok) throw new Error('Token request failed');
            const data = await res.json();
            this._token = data.token;
            this._expiresAt = Date.now() + (data.expiresInMinutes - 1) * 60 * 1000;
            return this._token;
        } catch (e) {
            console.warn('Failed to get auth token:', e.message);
            return null;
        }
    },
};

async function apiFetch(path, options = {}) {
    const headers = { ...options.headers };
    if (path.startsWith('/api/equipment')) {
        const token = await TOKEN_STORE.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
        TOKEN_STORE._token = null;
        TOKEN_STORE._expiresAt = 0;
    }
    return res;
}

function mapEquipmentType(equipmentType) {
    const mapping = { '20FT': '20ft', '40FT': '40ft', '40HC': '40ft HC', '20RF': '20RF', '40RF': '40RF' };
    return mapping[equipmentType] || equipmentType;
}

function getQuoteEquipmentType(equipmentType) {
    const mapping = { '20FT': '20FT', '40FT': '40FT', '40HC': '40FT_HC', '20FT_HC': '40FT_HC', '20RF': '20RF', '40RF': '40RF' };
    return mapping[equipmentType] || equipmentType;
}

const EQUIPMENT_TYPE_DISPLAY = {
    '20FT': '20ft Standard',
    '40FT': '40ft Standard',
    '40HC': '40ft High Cube',
    '20RF': '20ft Reefer',
    '40RF': '40ft Reefer',
};

const EquipmentsAPI = {
    async getEquipmentTypes() {
        try {
            const res = await apiFetch(`${API_BASE_URL}/equipment/equipment-types`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn('Failed to load equipment types:', e.message);
            return null;
        }
    },

    async getAvailability(depotCode) {
        try {
            const params = depotCode ? `?depotCode=${encodeURIComponent(depotCode)}` : '';
            const res = await apiFetch(`${API_BASE_URL}/equipment/availability${params}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn('Failed to load availability:', e.message);
            return null;
        }
    },

    async reserveContainers(bookingReference, originDepot, equipment) {
        try {
            const res = await apiFetch(`${API_BASE_URL}/equipment/reservations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingReference,
                    originDepot,
                    equipment: equipment.map(e => ({ type: e.type, quantity: e.quantity })),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Reservation failed: ${res.status}`);
            }
            return await res.json();
        } catch (e) {
            console.warn('Container reservation failed:', e.message);
            throw e;
        }
    },
};

const API = {
    schedules: SchedulesAPI,
    quotes: QuotesAPI,
    booking: BookingAPI,
    equipment: EquipmentsAPI,
    mapEquipmentType,
    getQuoteEquipmentType,
    EQUIPMENT_TYPE_DISPLAY,
};
