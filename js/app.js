const state = {
    selectedSchedule: null,
    currentQuote: null
};

function showSection(section) {
    document.querySelectorAll('main section').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('active');
    });
    const target = document.getElementById(`${section}-section`);
    target.classList.remove('hidden');
    target.classList.add('active');
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
                <div><strong>Origin:</strong> ${schedule.originPort}</div>
                <div><strong>Destination:</strong> ${schedule.destinationPort}</div>
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
            <div><strong>Route:</strong> ${schedule.originPort} → ${schedule.destinationPort}</div>
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
    
    try {
        const confirmation = await API.booking.submit(bookingData);
        displayConfirmation(confirmation);
    } catch (error) {
        showError(getUserFriendlyErrorMessage('submit the booking', error));
        console.error('Booking error:', error);
    }
});

function displayConfirmation(confirmation) {
    document.getElementById('confirmation-details').innerHTML = `
        <div class="confirmation">
            <p class="status">✓ Booking ${confirmation.status}</p>
            <div class="ref-number">${confirmation.referenceNumber}</div>
            <p>Thank you for your booking!</p>
            <div style="text-align: left; margin-top: 2rem;">
                <h3>Booking Summary</h3>
                <p><strong>Vessel:</strong> ${state.selectedSchedule.vesselName}</p>
                <p><strong>Route:</strong> ${state.selectedSchedule.originPort} → ${state.selectedSchedule.destinationPort}</p>
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
    showSection('search');
}

showSection('search');
