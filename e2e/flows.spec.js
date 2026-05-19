const { test, expect } = require('playwright');

const LOGIN_EMAIL = 'balazs.szabo@cgi.com';
const LOGIN_PASSWORD = 'test123';

test.describe('Login Flow', () => {

    test('signs in with valid credentials and shows user name', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#user-display-name')).toHaveText(LOGIN_EMAIL);
        await expect(page.locator('#user-info')).not.toBeHidden();
    });

    test('shows error for invalid credentials', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', 'wrong@example.com');
        await page.fill('#login-password', 'badpassword');
        await page.click('button[type="submit"]');
        await expect(page.locator('#error-message')).not.toBeHidden();
    });

    test('restores session from localStorage on page load', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#user-display-name')).toBeVisible();

        await page.reload();
        await expect(page.locator('#user-display-name')).toHaveText(LOGIN_EMAIL);
        await expect(page.locator('#user-info')).not.toBeHidden();
    });

    test('logs out and clears session', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#user-display-name')).toBeVisible();

        await page.click('#logout-btn');
        await expect(page.locator('#user-info')).toBeHidden();
        await expect(page.locator('#login-form')).toBeVisible();
    });

    test('caches login email suggestion in localStorage', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#user-display-name')).toBeVisible();

        await page.click('#logout-btn');

        const suggest = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('suggest:login-email') || '[]')
        );
        expect(suggest).toContain(LOGIN_EMAIL);
    });

});

test.describe('Search Schedules', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#search-section')).toBeVisible();
    });

    test('search section is displayed after login', async ({ page }) => {
        await expect(page.locator('#search-form')).toBeVisible();
        await expect(page.locator('#origin')).toBeVisible();
        await expect(page.locator('#destination')).toBeVisible();
    });

    test('shows schedules when valid ports are selected', async ({ page }) => {
        await page.selectOption('#origin', 'Rotterdam');
        await page.selectOption('#destination', 'New York');
        await page.fill('#date-from', '2026-06-01');
        await page.fill('#date-to', '2026-06-30');
        await page.click('#search-form button[type="submit"]');
        await expect(page.locator('#search-results')).not.toBeHidden({ timeout: 10000 });
        const cards = page.locator('.schedule-card');
        await expect(cards.first()).toBeVisible();
    });

    test('shows no schedules message when no match', async ({ page }) => {
        await page.selectOption('#origin', 'Rotterdam');
        await page.selectOption('#destination', 'UnknownCity');
        await page.fill('#date-from', '2026-06-01');
        await page.fill('#date-to', '2026-06-30');
        await page.click('#search-form button[type="submit"]');
        const text = await page.locator('#schedules-list').innerText();
        expect(text).toMatch(/no schedules|no results/i);
    });

});

test.describe('Quote Generation', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#search-section')).toBeVisible();
        await page.selectOption('#origin', 'Rotterdam');
        await page.selectOption('#destination', 'New York');
        await page.fill('#date-from', '2026-06-01');
        await page.fill('#date-to', '2026-06-30');
        await page.click('#search-form button[type="submit"]');
        await expect(page.locator('#search-results')).not.toBeHidden({ timeout: 10000 });
    });

    test('selecting a schedule shows quote section', async ({ page }) => {
        const card = page.locator('.schedule-card').first();
        await card.click();
        await expect(page.locator('#quote-section')).toBeVisible();
    });

});

test.describe('Booking Form', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#search-section')).toBeVisible();
        await page.selectOption('#origin', 'Rotterdam');
        await page.selectOption('#destination', 'New York');
        await page.fill('#date-from', '2026-06-01');
        await page.fill('#date-to', '2026-06-30');
        await page.click('#search-form button[type="submit"]');
        await expect(page.locator('#search-results')).not.toBeHidden({ timeout: 10000 });
        await page.locator('.schedule-card').first().click();
        await expect(page.locator('#quote-section')).toBeVisible();
    });

    test('proceed to booking navigates to booking section', async ({ page }) => {
        await page.fill('#quantity', '1');
        await page.fill('#cargo-weight', '5000');
        await page.selectOption('#equipment-type', '20FT');
        await page.click('#quote-form button[type="submit"]');
        await expect(page.locator('#quote-result')).not.toBeHidden({ timeout: 10000 });
        await page.click('text=Proceed to Booking');
        await expect(page.locator('#booking-section')).toBeVisible();
    });

    test('booking form is pre-filled with user email', async ({ page }) => {
        await page.fill('#quantity', '1');
        await page.fill('#cargo-weight', '5000');
        await page.selectOption('#equipment-type', '20FT');
        await page.click('#quote-form button[type="submit"]');
        await expect(page.locator('#quote-result')).not.toBeHidden({ timeout: 10000 });
        await page.click('text=Proceed to Booking');
        const email = await page.locator('#contact-email').inputValue();
        expect(email).toBe(LOGIN_EMAIL);
    });

});

test.describe('Logout Behavior', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#user-display-name')).toBeVisible();
    });

    test('user-info is hidden after logout', async ({ page }) => {
        await page.click('#logout-btn');
        await expect(page.locator('#user-info')).toBeHidden();
        await expect(page.locator('#login-email')).toBeVisible();
    });

    test('localStorage session is cleared on logout', async ({ page }) => {
        await page.click('#logout-btn');
        const session = await page.evaluate(() => localStorage.getItem('session'));
        expect(session).toBeNull();
    });

});

test.describe('Datalist Suggestions', () => {

    test('login email datalist is populated after login', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#user-display-name')).toBeVisible();
        await page.click('#logout-btn');

        const options = await page.locator('#suggest-login-email option').all();
        const values = await Promise.all(options.map(o => o.getAttribute('value')));
        expect(values).toContain(LOGIN_EMAIL);
    });

});

test.describe('Login Email Field', () => {

    test('email field has readonly attribute on page load', async ({ page }) => {
        await page.goto('/');
        const readonly = await page.locator('#login-email').getAttribute('readonly');
        expect(readonly).not.toBeNull();
    });

    test('readonly is removed on focus', async ({ page }) => {
        await page.goto('/');
        await page.locator('#login-email').focus();
        const readonly = await page.locator('#login-email').getAttribute('readonly');
        expect(readonly).toBeNull();
    });

});

test.describe('Schedules Display', () => {

    test('schedule cards show real vessel names', async ({ page }) => {
        await page.goto('/');
        await page.fill('#login-email', LOGIN_EMAIL);
        await page.fill('#login-password', LOGIN_PASSWORD);
        await page.click('button[type="submit"]');
        await expect(page.locator('#search-section')).toBeVisible();

        await page.selectOption('#origin', 'Rotterdam');
        await page.selectOption('#destination', 'New York');
        await page.fill('#date-from', '2026-06-01');
        await page.fill('#date-to', '2026-06-30');
        await page.click('#search-form button[type="submit"]');
        await expect(page.locator('#search-results')).not.toBeHidden({ timeout: 10000 });

        const scheduleText = await page.locator('#schedules-list').innerText();
        expect(scheduleText).not.toMatch(/demo vessel/i);
        expect(scheduleText).not.toMatch(/capital carrier/i);
    });

});
