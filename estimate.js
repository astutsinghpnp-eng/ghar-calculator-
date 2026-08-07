// =========================================================================
// BACKEND — all calculation logic, rates, and engineering assumptions.
// None of this is sent to or editable from the frontend. Same placeholder-
// coefficient philosophy as before: these are illustrative defaults, not a
// certified structural design. Replace with numbers you trust.
// =========================================================================

const WALL_HEIGHT_FT = 10;
const DOOR_AREA_DEFAULT = { width: 3, height: 7 };
const WINDOW_AREA_DEFAULT = { width: 4, height: 4 };
const MAIN_DOOR_COUNT = 1; // one external entrance door, building-wide

const WASHROOM_SIZE = { length: 5, width: 4 };
const BATHROOM_SIZE = { length: 6, width: 5 };
const PARKING_BAY_SIZE = { length: 10, width: 18 };

const EXT_WALL_THICKNESS_FT = 0.75;   // 9 inch brick wall
const INT_WALL_THICKNESS_FT = 0.375;  // 4.5 inch brick wall
const BRICKS_PER_CFT = 13.5;
const CIRCULATION_ALLOWANCE = 0.12;

const SOIL_TYPE = 'medium';
const SBC = { soft: 10000, medium: 15000, hard: 20000 }; // kg/sqm
const CONCRETE_MIX = 'M20';
const CEMENT_BAGS_PER_CUM = { M15: 6.4, M20: 8.0, M25: 9.2 };
const PCC_CEMENT_BAGS_PER_CUM = 3.5;
const SAND_CUM_PER_CUM = 0.42;
const AGG_CUM_PER_CUM = 0.84;
const STEEL_PERCENT = { footing: 0.6, column: 2.5, beam: 2.0, slab: 1.0 };
const STEEL_DENSITY = 7850;
const SPAN_DEPTH_RATIO = 26;
const BEAM_SPAN_DEPTH_RATIO = 12;
const FOOTING_DEPTH_FT = 1.0;
const PCC_THICKNESS_FT = 0.25;
const EXCAVATION_EXTRA_DEPTH_FT = 0.5;
const LOAD_PER_SQFT_KG = 100;
const COLUMN_SIZE_IN = { lowRise: 9, midRise: 12 };
const COLUMNS_PER_SQFT = 1 / 130; // used only to auto-suggest a column count

const PAINT_COATS = 3;
const ELEC_POINTS_PER_GENERAL_ROOM = 5;
const ELEC_POINTS_WASHROOM = 2;
const ELEC_POINTS_BATHROOM = 3;
const ELEC_POINTS_PARKING = 1;
const PLUMBING_FIXTURES_WASHROOM = 2; // WC + basin
const PLUMBING_FIXTURES_BATHROOM = 3; // WC + basin + shower

const RATES = {
  cement: 380, steel: 68, brick: 6500, sand: 55, aggregate: 60, excavation: 40,
  tile: 65, parkingFlooring: 35, plasterInt: 28, plasterExt: 35, paint: 9,
  door: 6500, window: 4500, electrical: 900, plumbing: 3500
};
const WASTAGE_PERCENT = { cement: 3, steel: 3, brick: 5, sand: 5, aggregate: 5, tile: 10 };
const CONTINGENCY_PERCENT = 5;
const TRANSPORT_PERCENT = 3;
const LABOR_PERCENT = 32;
const INCLUDE_LABOR = true;

const CFT_PER_CUM = 35.3147;
function ft2m(ft) { return ft * 0.3048; }
function sqft2sqm(a) { return a * 0.092903; }
function num(v, fallback) { const n = Number(v); return isFinite(n) && n > 0 ? n : fallback; }

function calculateEstimate(input) {
  const floors = Math.max(1, Math.round(num(input.floors, 1)));
  const plotLength = num(input.plotLength, 30);
  const plotWidth = num(input.plotWidth, 30);
  const rooms = Array.isArray(input.rooms) ? input.rooms.filter(function (r) { return r && r.length && r.width; }) : [];
  const totalDoors = Math.max(0, Math.round(num(input.totalDoors, 0)));
  const totalWindows = Math.max(0, Math.round(num(input.totalWindows, 0)));
  const doorW = num(input.doorWidth, DOOR_AREA_DEFAULT.width);
  const doorH = num(input.doorHeight, DOOR_AREA_DEFAULT.height);
  const windowW = num(input.windowWidth, WINDOW_AREA_DEFAULT.width);
  const windowH = num(input.windowHeight, WINDOW_AREA_DEFAULT.height);
  const doorArea = doorW * doorH;
  const windowArea = windowW * windowH;
  const washrooms = Math.max(0, Math.round(num(input.washrooms, 0)));
  const bathrooms = Math.max(0, Math.round(num(input.bathrooms, 0)));
  const parking = Math.max(0, Math.round(num(input.parking, 0)));

  if (rooms.length === 0 && washrooms === 0 && bathrooms === 0) {
    throw new Error('At least one room, washroom, or bathroom is required.');
  }

  // --- Areas ---------------------------------------------------------------
  const washroomArea = WASHROOM_SIZE.length * WASHROOM_SIZE.width;
  const bathroomArea = BATHROOM_SIZE.length * BATHROOM_SIZE.width;
  const washroomPerim = 2 * (WASHROOM_SIZE.length + WASHROOM_SIZE.width);
  const bathroomPerim = 2 * (BATHROOM_SIZE.length + BATHROOM_SIZE.width);

  const roomAreaSum = rooms.reduce(function (s, r) { return s + r.length * r.width; }, 0)
    + washrooms * washroomArea + bathrooms * bathroomArea;
  const roomPerimSum = rooms.reduce(function (s, r) { return s + 2 * (r.length + r.width); }, 0)
    + washrooms * washroomPerim + bathrooms * bathroomPerim;

  const builtUpAreaPerFloor = roomAreaSum * (1 + CIRCULATION_ALLOWANCE);
  const builtUpAreaTotal = builtUpAreaPerFloor * floors;
  const perimeter = 2 * (plotLength + plotWidth);

  const numColumns = Math.max(4, Math.round(builtUpAreaPerFloor * COLUMNS_PER_SQFT));

  // --- Walls (net of openings; windows assumed external, doors assumed internal) ---
  const externalWallNet = Math.max(0,
    perimeter * WALL_HEIGHT_FT * floors - totalWindows * windowArea * floors - MAIN_DOOR_COUNT * doorArea);
  const internalWallLengthPerFloor = roomPerimSum / 2;
  const internalWallAreaGrossPerFloor = internalWallLengthPerFloor * WALL_HEIGHT_FT;
  const internalWallNet = Math.max(0, internalWallAreaGrossPerFloor * floors - totalDoors * doorArea * floors);

  // --- Structural sizing (thumb-rules) --------------------------------------
  const maxSpanFt = rooms.reduce(function (m, r) { return Math.max(m, r.length, r.width); },
    Math.max(WASHROOM_SIZE.length, BATHROOM_SIZE.length, 8));
  const maxSpanM = ft2m(maxSpanFt);

  const slabThicknessM = Math.max(0.10, Math.round((maxSpanM / SPAN_DEPTH_RATIO) * 100) / 100);
  const slabConcreteVolCum = sqft2sqm(builtUpAreaTotal) * slabThicknessM;
  const slabSteelKg = slabConcreteVolCum * (STEEL_PERCENT.slab / 100) * STEEL_DENSITY;

  const beamDepthM = Math.max(0.225, Math.round((maxSpanM / BEAM_SPAN_DEPTH_RATIO) * 100) / 100);
  const beamWidthM = Math.max(0.23, Math.round((beamDepthM / 2) * 100) / 100);
  const beamDepthFt = beamDepthM / 0.3048;
  const beamWidthFt = beamWidthM / 0.3048;
  const beamLengthFt = (perimeter + internalWallLengthPerFloor) * floors;
  const beamConcreteVolCum = (beamLengthFt * beamWidthFt * beamDepthFt) / CFT_PER_CUM;
  const beamSteelKg = beamConcreteVolCum * (STEEL_PERCENT.beam / 100) * STEEL_DENSITY;

  const columnSizeIn = floors <= 2 ? COLUMN_SIZE_IN.lowRise : COLUMN_SIZE_IN.midRise;
  const columnSizeFt = columnSizeIn / 12;
  const columnHeightTotalFt = WALL_HEIGHT_FT * floors;
  const columnConcreteVolCum = (numColumns * columnSizeFt * columnSizeFt * columnHeightTotalFt) / CFT_PER_CUM;
  const columnSteelKg = columnConcreteVolCum * (STEEL_PERCENT.column / 100) * STEEL_DENSITY;

  const totalLoadKg = builtUpAreaTotal * LOAD_PER_SQFT_KG;
  const loadPerColumnKg = totalLoadKg / numColumns;
  const sbcKgPerSqm = SBC[SOIL_TYPE];
  const footingAreaSqm = loadPerColumnKg / sbcKgPerSqm;
  const footingSideM = Math.sqrt(footingAreaSqm);
  const footingConcreteVolCum = numColumns * footingAreaSqm * ft2m(FOOTING_DEPTH_FT);
  const footingSteelKg = footingConcreteVolCum * (STEEL_PERCENT.footing / 100) * STEEL_DENSITY;

  const pccVolCum = numColumns * footingAreaSqm * ft2m(PCC_THICKNESS_FT);
  const pccCementBags = pccVolCum * PCC_CEMENT_BAGS_PER_CUM;

  const footingAreaSqft = footingAreaSqm * 10.7639;
  const excavationDepthFt = FOOTING_DEPTH_FT + PCC_THICKNESS_FT + EXCAVATION_EXTRA_DEPTH_FT;
  const excavationVolCft = numColumns * footingAreaSqft * excavationDepthFt;

  const totalRccConcreteCum = slabConcreteVolCum + beamConcreteVolCum + columnConcreteVolCum + footingConcreteVolCum;
  const totalStructuralSteelKg = slabSteelKg + beamSteelKg + columnSteelKg + footingSteelKg;
  const structuralCementBags = totalRccConcreteCum * CEMENT_BAGS_PER_CUM[CONCRETE_MIX];
  const structuralSandCum = totalRccConcreteCum * SAND_CUM_PER_CUM;
  const structuralAggCum = totalRccConcreteCum * AGG_CUM_PER_CUM;

  const cementBagsFinal = (structuralCementBags + pccCementBags) * (1 + WASTAGE_PERCENT.cement / 100);
  const steelKgFinal = totalStructuralSteelKg * (1 + WASTAGE_PERCENT.steel / 100);
  const sandCftFinal = structuralSandCum * CFT_PER_CUM * (1 + WASTAGE_PERCENT.sand / 100);
  const aggCftFinal = structuralAggCum * CFT_PER_CUM * (1 + WASTAGE_PERCENT.aggregate / 100);

  // --- Brickwork -------------------------------------------------------------
  const extBrickVolCft = externalWallNet * EXT_WALL_THICKNESS_FT;
  const intBrickVolCft = internalWallNet * INT_WALL_THICKNESS_FT;
  const numBricksFinal = (extBrickVolCft + intBrickVolCft) * BRICKS_PER_CFT * (1 + WASTAGE_PERCENT.brick / 100);

  // --- Plaster & paint ---------------------------------------------------
  const extPlasterArea = externalWallNet;
  const intPlasterArea = externalWallNet + 2 * internalWallNet;
  const paintArea = extPlasterArea + intPlasterArea;

  // --- Flooring (all wet + dry areas tiled; parking separate) ------------
  const floorAreaTotal = roomAreaSum * floors;
  const skirtingArea = roomPerimSum * floors * 0.5;
  const tileAreaFinal = (floorAreaTotal + skirtingArea) * (1 + WASTAGE_PERCENT.tile / 100);
  const parkingArea = parking * PARKING_BAY_SIZE.length * PARKING_BAY_SIZE.width;

  // --- Openings & MEP ------------------------------------------------------
  const doorCount = totalDoors * floors + MAIN_DOOR_COUNT;
  const windowCount = totalWindows * floors;
  const generalRoomCount = rooms.length;
  const electricalPoints = generalRoomCount * ELEC_POINTS_PER_GENERAL_ROOM * floors
    + washrooms * ELEC_POINTS_WASHROOM * floors + bathrooms * ELEC_POINTS_BATHROOM * floors
    + parking * ELEC_POINTS_PARKING;
  const plumbingFixtures = washrooms * PLUMBING_FIXTURES_WASHROOM * floors + bathrooms * PLUMBING_FIXTURES_BATHROOM * floors;

  // --- Costs -----------------------------------------------------------------
  const cementCost = cementBagsFinal * RATES.cement;
  const steelCost = steelKgFinal * RATES.steel;
  const sandCost = sandCftFinal * RATES.sand;
  const aggCost = aggCftFinal * RATES.aggregate;
  const excavationCost = excavationVolCft * RATES.excavation;
  const brickCost = (numBricksFinal / 1000) * RATES.brick;
  const extPlasterCost = extPlasterArea * RATES.plasterExt;
  const intPlasterCost = intPlasterArea * RATES.plasterInt;
  const floorCost = tileAreaFinal * RATES.tile;
  const parkingCost = parkingArea * RATES.parkingFlooring;
  const paintCost = paintArea * PAINT_COATS * RATES.paint;
  const doorCost = doorCount * RATES.door;
  const windowCost = windowCount * RATES.window;
  const electricalCost = electricalPoints * RATES.electrical;
  const plumbingCost = plumbingFixtures * RATES.plumbing;

  const materialSubtotal = cementCost + steelCost + sandCost + aggCost + excavationCost + brickCost +
    extPlasterCost + intPlasterCost + floorCost + parkingCost + paintCost +
    doorCost + windowCost + electricalCost + plumbingCost;

  const contingencyCost = materialSubtotal * CONTINGENCY_PERCENT / 100;
  const transportCost = materialSubtotal * TRANSPORT_PERCENT / 100;
  const laborCost = INCLUDE_LABOR ? materialSubtotal * LABOR_PERCENT / 100 : 0;
  const grandTotal = materialSubtotal + contingencyCost + transportCost + laborCost;

  return {
    summary: {
      builtUpAreaTotal: Math.round(builtUpAreaTotal),
      slabThicknessMm: Math.round(slabThicknessM * 1000),
      beamSizeMm: Math.round(beamWidthM * 1000) + ' x ' + Math.round(beamDepthM * 1000),
      columnSize: columnSizeIn + ' x ' + columnSizeIn + ' in, ' + numColumns + ' nos',
      footingSizeM: footingSideM.toFixed(2) + ' x ' + footingSideM.toFixed(2)
    },
    items: [
      { section: 'Structure', label: 'Excavation', qty: Math.round(excavationVolCft) + ' cft', cost: excavationCost },
      { section: 'Structure', label: 'PCC', qty: pccVolCum.toFixed(2) + ' cum', cost: null },
      { section: 'Structure', label: 'Footing concrete', qty: footingConcreteVolCum.toFixed(2) + ' cum', cost: null },
      { section: 'Structure', label: 'Column concrete', qty: columnConcreteVolCum.toFixed(2) + ' cum', cost: null },
      { section: 'Structure', label: 'Beam concrete', qty: beamConcreteVolCum.toFixed(2) + ' cum', cost: null },
      { section: 'Structure', label: 'Slab concrete', qty: slabConcreteVolCum.toFixed(2) + ' cum', cost: null },
      { section: 'Structure', label: 'Cement (incl. PCC)', qty: Math.round(cementBagsFinal) + ' bags', cost: cementCost },
      { section: 'Structure', label: 'TMT steel', qty: Math.round(steelKgFinal) + ' kg', cost: steelCost },
      { section: 'Structure', label: 'Sand', qty: Math.round(sandCftFinal) + ' cft', cost: sandCost },
      { section: 'Structure', label: 'Aggregate', qty: Math.round(aggCftFinal) + ' cft', cost: aggCost },
      { section: 'Walls & finishes', label: 'Brickwork', qty: Math.round(numBricksFinal) + ' bricks', cost: brickCost },
      { section: 'Walls & finishes', label: 'External plaster', qty: Math.round(extPlasterArea) + ' sqft', cost: extPlasterCost },
      { section: 'Walls & finishes', label: 'Internal plaster', qty: Math.round(intPlasterArea) + ' sqft', cost: intPlasterCost },
      { section: 'Walls & finishes', label: 'Flooring (tile)', qty: Math.round(tileAreaFinal) + ' sqft', cost: floorCost },
      { section: 'Walls & finishes', label: 'Parking flooring', qty: Math.round(parkingArea) + ' sqft', cost: parkingCost },
      { section: 'Walls & finishes', label: 'Painting (' + PAINT_COATS + ' coats)', qty: Math.round(paintArea) + ' sqft', cost: paintCost },
      { section: 'Openings & MEP', label: 'Doors', qty: doorCount + ' nos', cost: doorCost },
      { section: 'Openings & MEP', label: 'Windows', qty: windowCount + ' nos', cost: windowCost },
      { section: 'Openings & MEP', label: 'Electrical points', qty: electricalPoints + ' nos', cost: electricalCost },
      { section: 'Openings & MEP', label: 'Plumbing fixtures', qty: plumbingFixtures + ' nos', cost: plumbingCost }
    ],
    materialSubtotal: materialSubtotal,
    contingencyCost: contingencyCost,
    contingencyPercent: CONTINGENCY_PERCENT,
    transportCost: transportCost,
    transportPercent: TRANSPORT_PERCENT,
    laborCost: laborCost,
    laborPercent: LABOR_PERCENT,
    laborIncluded: INCLUDE_LABOR,
    grandTotal: grandTotal
  };
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with a JSON body.' });
    return;
  }
  try {
    const result = calculateEstimate(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports.calculateEstimate = calculateEstimate; // exported for local testing
