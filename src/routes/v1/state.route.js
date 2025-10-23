const express = require('express');
const { getStates, getDistrictsByState } = require('../../controllers/state.controller');

const router = express.Router();

router.get('/', getStates);
router.get('/:state', getDistrictsByState);

module.exports = router;
