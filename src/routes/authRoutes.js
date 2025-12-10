import express from 'express';
import { register, login, getProfile } from '../controller/authController.js';
import {getStates, getDistrictsByState} from '../controller/state.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.get("/profile", authenticate, getProfile);
router.get("/state", authenticate, getStates);
router.get("/state/:state", authenticate, getDistrictsByState);

export default router;