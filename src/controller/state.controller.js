import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src/data/state-districts.json');
const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Get all states
export const getStates = (req, res) => {
  const states = jsonData.states.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    type: s.type,
    capital: s.capital,
  }));
  res.json(states);
};

// Get districts for a given state
export const getDistrictsByState = (req, res) => {
  const { state } = req.params;

  const foundState = jsonData.states.find(
    (s) => s.code.toLowerCase() === state.toLowerCase()
  );

  if (!foundState) {
    return res.status(404).json({ message: 'State not found' });
  }

  res.json({
    state: foundState.name,
    code: foundState.code,
    districts: foundState.districts,
  });
};
