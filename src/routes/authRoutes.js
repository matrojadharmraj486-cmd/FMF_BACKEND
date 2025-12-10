import express from 'express';
import { register, login } from '../controller/authController.js';
import {getStates, getDistrictsByState} from '../controller/state.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post("/register", register);
router.post("/login", login);


router.get("/state", authenticate, getStates);
router.get("/state/:state", authenticate, getDistrictsByState);

export default router;