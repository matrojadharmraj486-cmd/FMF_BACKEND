import express from 'express';
import { getStates, getDistrictsByState } from '../controller/state.controller.js';

const router = express.Router();

// Get all states
router.get('/states', getStates);

// Get districts by state code
router.get('/districts/:state', getDistrictsByState);

export default router;
