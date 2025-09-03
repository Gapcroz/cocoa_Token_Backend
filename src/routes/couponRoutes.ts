import { Router } from 'express';
import { createCoupon, getCouponsByStore, updateCoupon, deleteCoupon, getUserCoupons } from '../controllers/couponController';
import { isAuthenticated, isStore, isRegularUser } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Store-only routes (create, update, delete, get store coupons)
router.post('/', isStore, createCoupon);
router.get('/store', isStore, getCouponsByStore);
router.put('/:id', isStore, updateCoupon);
router.delete('/:id', isStore, deleteCoupon);

// Regular user routes (get available coupons)
router.get('/user', isRegularUser, getUserCoupons);

export default router; 