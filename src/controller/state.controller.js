import fs from 'fs';
import path from 'path';
import { successResponse, errorResponse } from "../utils/response.js";

const filePath = path.join(process.cwd(), 'src/data/state-districts.json');
const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Get all states
export const getStates = (req, res) => {
  const states = jsonData.states.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type,
    capital: s.capital
  }));

  return successResponse(
    res,
    200,
    "States fetched successfully",
    states
  );
};

/* Get districts by state code */
export const getDistrictsByState = (req, res) => {
  const { state } = req.params;

  const foundState = jsonData.states.find(
    (s) => s.code.toLowerCase() === state.toLowerCase()
  );

  if (!foundState) {
    return errorResponse(res, 404, "State not found");
  }

  return successResponse(
    res,
    200,
    "Districts fetched successfully",
    {
      state: foundState.name,
      code: foundState.code,
      districts: foundState.districts
    }
  );
};