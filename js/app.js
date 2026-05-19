const PORT_DISPLAY_NAMES = {
    NLRTM: 'Rotterdam',
    USNYC: 'New York',
    CNSHA: 'Shanghai',
    DEHAM: 'Hamburg',
    SGSIN: 'Singapore',
    USLAX: 'Los Angeles',
    HKHKG: 'Hong Kong',
    LON: 'London',
    BRSSZ: 'Santos'
};

function displayPortName(port) {
    return PORT_DISPLAY_NAMES[port] || port;
}

const state = {
    user: null,
    selectedSchedule: null,
    currentQuote: null
};

function populateDatalist(datalistId, storageKey) {
    const datalist = document.getElementById(datalistId);
    const items = JSON.parse(localStorage.getItem(storageKey) || '[]');
    datalist.innerHTML = items.map(v => `<option value="${v.replace(/"/g, '&quot;')}">`).join('');
}

function saveSuggestion(storageKey, value) {
    if (!value) return;
    let list = JSON.parse(localStorage.getItem(storageKey) || '[]');
    list = list.filter(v => v !== value);
    list.unshift(value);
    if (list.length > 5) list = list.slice(0, 5);
    localStorage.setItem(storageKey, JSON.stringify(list));
}

function migrateOldSuggestions() {
    const oldEmail = localStorage.getItem('loginEmail');
    if (oldEmail) {
        saveSuggestion('suggest:login-email', oldEmail);
        localStorage.removeItem('loginEmail');
    }
    const oldBooking = localStorage.getItem('bookingFormData');
    if (oldBooking) {
        try {
            const { contactName, contactEmail, contactPhone } = JSON.parse(oldBooking);
            if (contactName) saveSuggestion('suggest:contact-name', contactName);
            if (contactEmail) saveSuggestion('suggest:contact-email', contactEmail);
            if (contactPhone) saveSuggestion('suggest:contact-phone', contactPhone);
        } catch {}
        localStorage.removeItem('bookingFormData');
    }
}

function showSection(section) {
    document.querySelectorAll('main section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    const target = document.getElementById(`${section}-section`);
    target.classList.remove('hidden');
    target.classList.add('active');
    if (section === 'booking') {
        populateDatalist('suggest-contact-name', 'suggest:contact-name');
        populateDatalist('suggest-contact-email', 'suggest:contact-email');
        populateDatalist('suggest-contact-phone', 'suggest:contact-phone');
    }
    hideError();
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

function getUserFriendlyErrorMessage(action, error) {
    const rawMessage = String(error?.message || '').trim();
    const normalizedMessage = rawMessage.toLowerCase();

    if (!rawMessage) {
        return `Something went wrong while trying to ${action}. Please try again.`;
    }

    if (normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('networkerror')) {
        return `We could not reach the service to ${action}. Please check your connection and try again.`;
    }

    if (normalizedMessage.includes('schedule not found')) {
        return 'The selected schedule is no longer available. Please search again.';
    }

    if (normalizedMessage.includes('unsupported currency')) {
        return 'The requested currency is not supported for this quote.';
    }

    if (normalizedMessage.includes('no rate available')) {
        return 'No commercial rate is available for this route and equipment yet.';
    }

    if (normalizedMessage.includes('bookings') || normalizedMessage.includes('submit booking')) {
        return 'We could not submit the booking right now. Please review the details and try again.';
    }

    if (normalizedMessage.includes('quotes') || normalizedMessage.includes('get quote')) {
        return 'We could not generate a quote right now. Please try a different shipment setup or try again shortly.';
    }

    if (normalizedMessage.includes('schedules')) {
        return 'We could not load schedules right now. Please adjust your search or try again shortly.';
    }

    return rawMessage;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

const ADDITIONAL_PORTS = ['Rotterdam', 'Shanghai', 'New York', 'Hamburg', 'Los Angeles', 'Hong Kong', 'Singapore', 'Santos'];

async function loadAvailableCities() {
    const response = await fetch('/mock/db.json');
    if (!response.ok) {
        throw new Error('Failed to load city list');
    }

    const data = await response.json();
    const schedules = Array.isArray(data?.schedules) ? data.schedules : [];
    const citySet = new Set();

    schedules.forEach((schedule) => {
        if (schedule?.originPort) {
            citySet.add(String(schedule.originPort).trim());
        }
        if (schedule?.destinationPort) {
            citySet.add(String(schedule.destinationPort).trim());
        }
    });

    ADDITIONAL_PORTS.forEach((port) => citySet.add(port));

    return Array.from(citySet).filter(Boolean).sort((first, second) => first.localeCompare(second));
}

function populateCitySelect(selectElement, cities, defaultLabel) {
    const previousValue = selectElement.value;
    selectElement.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = defaultLabel;
    selectElement.appendChild(defaultOption);

    cities.forEach((city) => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        selectElement.appendChild(option);
    });

    if (previousValue && cities.includes(previousValue)) {
        selectElement.value = previousValue;
    }
}

async function initializeCityDropdowns() {
    const originSelect = document.getElementById('origin');
    const destinationSelect = document.getElementById('destination');

    try {
        const cities = await loadAvailableCities();
        populateCitySelect(originSelect, cities, 'Select origin city');
        populateCitySelect(destinationSelect, cities, 'Select destination city');
    } catch (error) {
        showError('Unable to load city list. You can refresh and try again.');
        console.error('City list error:', error);
    }
}

async function initializeEquipmentTypes() {
    const select = document.getElementById('equipment-type');
    const previousValue = select.value;

    try {
        const types = await API.equipment.getEquipmentTypes();
        if (types && types.length > 0) {
            select.innerHTML = '<option value="">Select equipment type</option>';
            types.forEach((type) => {
                const code = type.code || type;
                const label = API.EQUIPMENT_TYPE_DISPLAY[code] || code;
                const option = document.createElement('option');
                option.value = code;
                option.textContent = label;
                select.appendChild(option);
            });
            if (previousValue && [...select.options].some((o) => o.value === previousValue)) {
                select.value = previousValue;
            }
            return;
        }
    } catch (e) {
        console.warn('Could not load equipment types from API, using hardcoded fallback:', e.message);
    }

    select.innerHTML =
        '<option value="">Select equipment type</option>' +
        '<option value="20FT">20ft Standard</option>' +
        '<option value="40FT">40ft Standard</option>' +
        '<option value="40HC">40ft High Cube</option>';
}

async function handleLogin(email, password) {
    const data = await API.users.login(email, password);
    state.user = data.user;
    TOKEN_STORE._token = data.token;
    TOKEN_STORE._expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('session', JSON.stringify({ token: data.token, user: data.user }));
    saveSuggestion('suggest:login-email', email);
    document.getElementById('user-display-name').textContent = data.user.displayName || data.user.email;
    document.getElementById('user-info').classList.remove('hidden');
    showSection('search');
}

function restoreSession() {
    const saved = localStorage.getItem('session');
    if (!saved) return false;
    try {
        const { token, user } = JSON.parse(saved);
        if (!token || !user) return false;
        state.user = user;
        TOKEN_STORE._token = token;
        TOKEN_STORE._expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
        document.getElementById('user-display-name').textContent = user.displayName || user.email;
        document.getElementById('user-info').classList.remove('hidden');
        showSection('search');
        return true;
    } catch { return false; }
}

function handleLogout() {
    state.user = null;
    TOKEN_STORE._token = null;
    TOKEN_STORE._expiresAt = 0;
    localStorage.removeItem('session');
    document.getElementById('user-info').classList.add('hidden');
    document.getElementById('login-form').reset();
    showSection('login');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
        await handleLogin(email, password);
    } catch (error) {
        showError(error.message);
    }
});

document.getElementById('logout-btn').addEventListener('click', handleLogout);

document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    const formData = new FormData(e.target);
    const origin = formData.get('origin');
    const destination = formData.get('destination');
    const dateFrom = formData.get('dateFrom');
    const dateTo = formData.get('dateTo');
    
    try {
        const schedules = await API.schedules.search(origin, destination, dateFrom, dateTo);
        displaySchedules(schedules);
    } catch (error) {
        showError(getUserFriendlyErrorMessage('load schedules', error));
        console.error('Search error:', error);
    }
});

function displaySchedules(schedules) {
    const container = document.getElementById('schedules-list');
    container.innerHTML = '';
    
    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<p>No schedules found for your search criteria.</p>';
        return;
    }
    
    schedules.forEach(schedule => {
        const card = document.createElement('div');
        card.className = 'schedule-card';
        card.innerHTML = `
            <h4>${schedule.vesselName} (Voyage: ${schedule.voyageNumber})</h4>
            <div class="schedule-details">
                <div><strong>Origin:</strong> ${displayPortName(schedule.originPort)}</div>
                <div><strong>Destination:</strong> ${displayPortName(schedule.destinationPort)}</div>
                <div><strong>ETD:</strong> ${formatDate(schedule.etd)}</div>
                <div><strong>ETA:</strong> ${formatDate(schedule.eta)}</div>
                <div><strong>Cut-off:</strong> ${formatDate(schedule.cutoffDate)}</div>
            </div>
        `;
        card.addEventListener('click', () => selectSchedule(schedule, card));
        container.appendChild(card);
    });
    
    document.getElementById('search-results').classList.remove('hidden');
}

function selectSchedule(schedule, cardElement) {
    document.querySelectorAll('.schedule-card').forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    state.selectedSchedule = schedule;
    
    document.getElementById('selected-schedule').innerHTML = `
        <h3>Selected Schedule</h3>
        <div class="schedule-details">
            <div><strong>Vessel:</strong> ${schedule.vesselName}</div>
            <div><strong>Voyage:</strong> ${schedule.voyageNumber}</div>
            <div><strong>Route:</strong> ${displayPortName(schedule.originPort)} → ${displayPortName(schedule.destinationPort)}</div>
            <div><strong>ETD:</strong> ${formatDate(schedule.etd)}</div>
            <div><strong>ETA:</strong> ${formatDate(schedule.eta)}</div>
        </div>
    `;
    
    setTimeout(() => showSection('quote'), 300);
}

document.getElementById('quote-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    if (!state.selectedSchedule) {
        showError('Please select a schedule first.');
        return;
    }
    
    const formData = new FormData(e.target);
    const equipmentType = formData.get('equipmentType');
    const quantity = parseInt(formData.get('quantity'));
    const cargoWeight = parseInt(formData.get('cargoWeight'));
    
    try {
        const quote = await API.quotes.getQuote(
            state.selectedSchedule.id,
            equipmentType,
            quantity,
            cargoWeight
        );
        state.currentQuote = quote;
        displayQuote(quote);
    } catch (error) {
        showError(getUserFriendlyErrorMessage('generate a quote', error));
        console.error('Quote error:', error);
    }
});

function displayQuote(quote) {
    const container = document.getElementById('quote-result');
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="quote-result">
            <h3>Quote Details</h3>
            <div class="quote-total">${quote.currency} ${quote.totalPrice.toFixed(2)}</div>
            <p><strong>Valid until:</strong> ${formatDate(quote.validityPeriod)}</p>
            <div class="quote-breakdown">
                <div><span>Freight</span><span>${quote.currency} ${quote.breakdown.freight.toFixed(2)}</span></div>
                <div><span>Surcharges</span><span>${quote.currency} ${quote.breakdown.surcharges.toFixed(2)}</span></div>
                <div><strong>Total</strong><strong>${quote.currency} ${quote.totalPrice.toFixed(2)}</strong></div>
            </div>
            <button type="button" class="btn btn-primary" onclick="showSection('booking')" style="margin-top: 1rem;">
                Proceed to Booking
            </button>
        </div>
    `;
}

document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    if (!state.selectedSchedule || !state.currentQuote) {
        showError('Missing schedule or quote information.');
        return;
    }
    
    const formData = new FormData(e.target);
    const bookingData = {
        scheduleId: state.selectedSchedule.id,
        quoteId: state.currentQuote.id,
        contactName: formData.get('contactName'),
        contactEmail: formData.get('contactEmail'),
        contactPhone: formData.get('contactPhone'),
        cargoDescription: formData.get('cargoDescription'),
        hsCode: formData.get('hsCode'),
        equipmentType: document.getElementById('equipment-type').value,
        quantity: parseInt(document.getElementById('quantity').value),
        cargoWeight: parseInt(document.getElementById('cargo-weight').value)
    };
    saveSuggestion('suggest:contact-name', bookingData.contactName);
    saveSuggestion('suggest:contact-email', bookingData.contactEmail);
    saveSuggestion('suggest:contact-phone', bookingData.contactPhone);

    try {
        const confirmation = await API.booking.submit(bookingData);
        displayConfirmation(confirmation);
    } catch (error) {
        showError(getUserFriendlyErrorMessage('submit the booking', error));
        console.error('Booking error:', error);
    }
});

function displayConfirmation(confirmation) {
    const ref = confirmation.bookingReference || confirmation.referenceNumber || confirmation.id;
    document.getElementById('confirmation-details').innerHTML = `
        <div class="confirmation">
            <p class="status">✓ Booking ${confirmation.status}</p>
            <div class="ref-number">${ref}</div>
            <p>Thank you for your booking!</p>
            <div style="text-align: left; margin-top: 2rem;">
                <h3>Booking Summary</h3>
                <p><strong>Vessel:</strong> ${state.selectedSchedule.vesselName}</p>
                <p><strong>Route:</strong> ${displayPortName(state.selectedSchedule.originPort)} → ${displayPortName(state.selectedSchedule.destinationPort)}</p>
                <p><strong>ETD:</strong> ${formatDate(state.selectedSchedule.etd)}</p>
                <p><strong>Total Price:</strong> ${state.currentQuote.currency} ${state.currentQuote.totalPrice.toFixed(2)}</p>
            </div>
        </div>
    `;
    showSection('confirmation');
}

function resetApp() {
    state.selectedSchedule = null;
    state.currentQuote = null;
    document.getElementById('search-form').reset();
    document.getElementById('quote-form').reset();
    document.getElementById('booking-form').reset();
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('quote-result').classList.add('hidden');
    showSection(state.user ? 'search' : 'login');
}

initializeCityDropdowns();
initializeEquipmentTypes();
migrateOldSuggestions();
populateDatalist('suggest-login-email', 'suggest:login-email');
if (!restoreSession()) showSection('login');
