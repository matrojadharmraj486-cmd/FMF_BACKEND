const express = require('express');
const {
  getStates,
  getDistrictsByState,
} = require('../controllers/state.controller.js');

const router = express.Router();

// Get all states
router.get('/states', getStates);

// Get districts by state code
router.get('/districts/:state', getDistrictsByState);

module.exports = router;
