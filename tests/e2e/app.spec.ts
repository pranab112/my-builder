import { test, expect } from '@playwright/test';

test.describe('ProShot AI App', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the landing page correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/ProShot AI/);
    await expect(page.getByText('Dream it. Build it.')).toBeVisible();
  });

  test('should navigate to auth page when clicking Launch App', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch App' }).click();
    
    // Should see Sign In / Sign Up
    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should allow simulation of login', async ({ page }) => {
    await page.getByRole('button', { name: 'Launch App' }).click();
    
    // Fill fake auth
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button:has-text("Sign In")');

    // Should arrive at main app (Header visible)
    await expect(page.getByText('Ecom Image Designer')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
  });
});
