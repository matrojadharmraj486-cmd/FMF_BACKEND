import express from 'express';
import { register, login } from '../controller/authController.js';
import {getStates, getDistrictsByState} from '../controller/state.controller.js';
import { verifyOtp } from '../controller/otp.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);


router.get("/state", authenticate, getStates);
router.get("/state/:state", authenticate, getDistrictsByState);

export default router;