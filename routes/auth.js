const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const checkRole = require('../middleware/checkRole');
const { authLimiter } = require('../middleware/security');

router.get('/login', checkRole.isGuest, authController.showLogin);
router.post('/login', authLimiter, authController.login);

router.get('/register', checkRole.isGuest, authController.showRegister);
router.post('/register', authLimiter, authController.register);

router.get('/verify', authController.showVerify);
router.post('/verify', authLimiter, authController.verify);

// FIX #17: authLimiter на resendCode — защита от спама SMS/email
router.post('/resend-code', authLimiter, authController.resendCode);

router.get('/forgot-password', checkRole.isGuest, authController.showForgotPassword);
router.post('/forgot-password', authLimiter, authController.forgotPassword);

router.get('/reset-password-code', authController.showResetPasswordCode);
router.post('/reset-password-verify', authLimiter, authController.verifyResetCode);

router.get('/reset-password', authController.showResetPassword);
router.post('/reset-password', authController.resetPassword);

// FIX #17: authLimiter на resendResetCode
router.post('/resend-reset-code', authLimiter, authController.resendResetCode);

router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
