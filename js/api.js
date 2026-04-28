const API_BASE_URL = '/api';

const SchedulesAPI = {
    async search(origin, destination, dateFrom, dateTo) {
        const params = new URLSearchParams({
            origin,
            destination,
            dateFrom,
            dateTo
        });
        const response = await fetch(`${API_BASE_URL}/schedules?${params}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch schedules: ${response.statusText}`);
        }
        return response.json();
    }
};

const QuotesAPI = {
    async getQuote(scheduleId, equipmentType, quantity, cargoWeight) {
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
        if (!response.ok) {
            throw new Error(`Failed to get quote: ${response.statusText}`);
        }
        return response.json();
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
