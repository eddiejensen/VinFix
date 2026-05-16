let dotenvLoaded = false;

try {
  require('dotenv').config();
  dotenvLoaded = true;
} catch (error) {
  console.warn('dotenv is not installed, falling back to a simple .env loader.');
}

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scoreDiagnosticSuggestions } = require('./learningEngine');
const { getVehicleImage } = require('./vehicleImages');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-session-token']
}));

app.use(express.json());

const CAR_API_BASE_URL = process.env.CAR_API_BASE_URL || 'https://carapi.app/api';
const CAR_API_TOKEN = process.env.CAR_API_TOKEN || '';
const CAR_API_SECRET = process.env.CAR_API_SECRET || '';
const CARSCAN_BASE_URL = process.env.CARSCAN_BASE_URL || 'https://dev-api.carscan.com/v3.0';
const CARSCAN_PARTNER_TOKEN = process.env.CARSCAN_PARTNER_TOKEN || '';
const CARSCAN_AUTHORIZATION_KEY = process.env.CARSCAN_AUTHORIZATION_KEY || '';
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL || 'https://overpass-api.de/api/interpreter';
const APP_CONTACT_EMAIL = process.env.APP_CONTACT_EMAIL || '';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

if (!dotenvLoaded) {
  const envPath = path.join(__dirname, '.env');

  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');

    envFile.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
        return;
      }

      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();

      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    });
  }
}

const { initDatabase, useLocalDatabase } = require('./db');

let pool;

const CURRENT_YEAR = 2026;
const MIN_YEAR = 1996;
const YEARS = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) =>
  String(CURRENT_YEAR - i)
);

const PASSENGER_VEHICLE_MAKES = [
  'ACURA',
  'ALFA ROMEO',
  'AUDI',
  'BMW',
  'BUICK',
  'CADILLAC',
  'CHEVROLET',
  'CHRYSLER',
  'DODGE',
  'FIAT',
  'FORD',
  'GENESIS',
  'GMC',
  'HONDA',
  'HYUNDAI',
  'INFINITI',
  'JAGUAR',
  'JEEP',
  'KIA',
  'LAND ROVER',
  'LEXUS',
  'LINCOLN',
  'MAZDA',
  'MERCEDES-BENZ',
  'MERCURY',
  'MINI',
  'MITSUBISHI',
  'NISSAN',
  'OLDSMOBILE',
  'PLYMOUTH',
  'PONTIAC',
  'PORSCHE',
  'RAM',
  'SAAB',
  'SATURN',
  'SCION',
  'SMART',
  'SUBARU',
  'SUZUKI',
  'TESLA',
  'TOYOTA',
  'VOLKSWAGEN',
  'VOLVO',
];

const MAKES_BY_YEAR_CACHE = new Map();
const APP_CACHE = new Map();
const CAR_API_AUTH_CACHE = {
  token: '',
  expiresAt: 0,
};

const BASIC_OBD_CODE_DATA = {
  P0300: {
    code: 'P0300',
    description: 'Random or multiple cylinder misfire detected',
    severity: 'high',
    genericMeaning:
      'The powertrain control module detected misfires across multiple cylinders rather than a single cylinder.',
    possibleFixes: [
      'Inspect ignition coils, spark plugs, and plug boots',
      'Check fuel pressure and injector operation',
      'Inspect for vacuum leaks or unmetered air',
      'Check for restricted exhaust, including a clogged catalytic converter',
    ],
    disclaimer: 'These fixes are common starting points, not guaranteed repairs.',
  },
  P0171: {
    code: 'P0171',
    description: 'System too lean, bank 1',
    severity: 'medium',
    genericMeaning:
      'The engine is running lean on bank 1, often because of extra air entering the engine or not enough fuel.',
    possibleFixes: [
      'Check for intake and vacuum leaks',
      'Inspect the mass air flow sensor',
      'Verify fuel delivery and fuel pressure',
      'Inspect upstream oxygen sensor performance',
    ],
    disclaimer: 'These fixes are common starting points, not guaranteed repairs.',
  },
  P0420: {
    code: 'P0420',
    description: 'Catalyst system efficiency below threshold, bank 1',
    severity: 'medium',
    genericMeaning:
      'The catalytic converter system on bank 1 is not performing as expected, or the oxygen sensor readings suggest that it is not.',
    possibleFixes: [
      'Confirm there is no misfire or fuel trim issue before replacing parts',
      'Inspect for exhaust leaks ahead of the catalytic converter',
      'Test upstream and downstream oxygen sensor behavior',
      'Evaluate catalytic converter restriction or efficiency failure',
    ],
    disclaimer: 'These fixes are common starting points, not guaranteed repairs.',
  },
  P0442: {
    code: 'P0442',
    description: 'Evaporative emission system leak detected, small leak',
    severity: 'low',
    genericMeaning:
      'The EVAP system detected a small leak, often from the gas cap, vent plumbing, or purge-related components.',
    possibleFixes: [
      'Check fuel cap seal and proper cap installation',
      'Inspect EVAP hoses and vent lines for leaks',
      'Test purge valve and vent valve operation',
      'Smoke test the EVAP system if the leak is not obvious',
    ],
    disclaimer: 'These fixes are common starting points, not guaranteed repairs.',
  },
  P0455: {
    code: 'P0455',
    description: 'Evaporative emission system leak detected, gross leak',
    severity: 'low',
    genericMeaning:
      'The EVAP system detected a large leak or no purge flow, often related to a missing cap or disconnected hose.',
    possibleFixes: [
      'Check that the fuel cap is present and tightened correctly',
      'Inspect EVAP hoses for disconnections',
      'Inspect the canister, vent valve, and purge system',
      'Perform a smoke test if the issue is not obvious',
    ],
    disclaimer: 'These fixes are common starting points, not guaranteed repairs.',
  },
};

const VEHICLE_OPTIONS_DB = [
  { year: '*', make: 'CHEVROLET', model: 'SUBURBAN', trim: 'LS', series: null, drivetrain: '2WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'SUBURBAN', trim: 'LS', series: null, drivetrain: '4WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'SUBURBAN', trim: 'LT', series: null, drivetrain: '2WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'SUBURBAN', trim: 'LT', series: null, drivetrain: '4WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'SUBURBAN', trim: 'Z71', series: null, drivetrain: '4WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'SUBURBAN', trim: 'PREMIER', series: null, drivetrain: '4WD', engine: '6.2L V8' },
  { year: '*', make: 'CHEVROLET', model: 'TAHOE', trim: 'LS', series: null, drivetrain: '2WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'TAHOE', trim: 'LS', series: null, drivetrain: '4WD', engine: '5.3L V8 Flex Fuel' },
  { year: '*', make: 'CHEVROLET', model: 'TAHOE', trim: 'Z71', series: null, drivetrain: '4WD', engine: '5.3L V8' },
  { year: '*', make: 'CHEVROLET', model: 'EQUINOX', trim: 'LS', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'EQUINOX', trim: 'LS', series: null, drivetrain: 'AWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'EQUINOX', trim: 'RS', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'EQUINOX', trim: 'RS', series: null, drivetrain: 'AWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'MALIBU', trim: 'LS', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'MALIBU', trim: 'LT', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'SILVERADO 1500', trim: 'WT', series: null, drivetrain: '2WD', engine: '2.7L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'SILVERADO 1500', trim: 'WT', series: null, drivetrain: '4WD', engine: '2.7L I4 Turbo' },
  { year: '*', make: 'CHEVROLET', model: 'SILVERADO 1500', trim: 'LT', series: null, drivetrain: '2WD', engine: '5.3L V8' },
  { year: '*', make: 'CHEVROLET', model: 'SILVERADO 1500', trim: 'LT', series: null, drivetrain: '4WD', engine: '5.3L V8' },
  { year: '*', make: 'CHEVROLET', model: 'SILVERADO 1500', trim: 'RST', series: null, drivetrain: '4WD', engine: '6.2L V8' },

  { year: '2012', make: 'BMW', model: '6 SERIES', trim: '640i', series: null, drivetrain: 'RWD', engine: '3.0L Turbo Inline 6, 640i' },
  { year: '2012', make: 'BMW', model: '6 SERIES', trim: '640d', series: null, drivetrain: 'RWD', engine: '3.0L Diesel Inline 6, 640d' },

  { year: '*', make: 'HONDA', model: 'ACCORD', trim: 'LX', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'ACCORD', trim: 'EX', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'ACCORD', trim: 'SPORT', series: null, drivetrain: 'FWD', engine: '2.0L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'ACCORD', trim: 'TOURING', series: null, drivetrain: 'FWD', engine: '2.0L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'ACCORD', trim: 'HYBRID', series: null, drivetrain: 'FWD', engine: '2.0L Hybrid I4' },
  { year: '*', make: 'HONDA', model: 'CIVIC', trim: 'LX', series: 'SEDAN', drivetrain: 'FWD', engine: '2.0L I4' },
  { year: '*', make: 'HONDA', model: 'CIVIC', trim: 'SPORT', series: 'SEDAN', drivetrain: 'FWD', engine: '2.0L I4' },
  { year: '*', make: 'HONDA', model: 'CIVIC', trim: 'EX', series: 'SEDAN', drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'CIVIC', trim: 'TOURING', series: 'SEDAN', drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'CR-V', trim: 'LX', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'CR-V', trim: 'LX', series: null, drivetrain: 'AWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'CR-V', trim: 'EX', series: null, drivetrain: 'FWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'CR-V', trim: 'EX', series: null, drivetrain: 'AWD', engine: '1.5L I4 Turbo' },
  { year: '*', make: 'HONDA', model: 'CR-V', trim: 'SPORT HYBRID', series: null, drivetrain: 'AWD', engine: '2.0L Hybrid I4' },
  { year: '*', make: 'HONDA', model: 'PILOT', trim: 'SPORT', series: null, drivetrain: 'FWD', engine: '3.5L V6' },
  { year: '*', make: 'HONDA', model: 'PILOT', trim: 'SPORT', series: null, drivetrain: 'AWD', engine: '3.5L V6' },
  { year: '*', make: 'HONDA', model: 'PILOT', trim: 'TRAILSPORT', series: null, drivetrain: 'AWD', engine: '3.5L V6' },
  { year: '*', make: 'HONDA', model: 'ODYSSEY', trim: 'EX-L', series: null, drivetrain: 'FWD', engine: '3.5L V6' },
  { year: '*', make: 'HONDA', model: 'ODYSSEY', trim: 'TOURING', series: null, drivetrain: 'FWD', engine: '3.5L V6' },

  { year: '*', make: 'FORD', model: 'F-150', trim: 'XL', series: null, drivetrain: '2WD', engine: '2.7L V6 Turbo' },
  { year: '*', make: 'FORD', model: 'F-150', trim: 'XL', series: null, drivetrain: '4WD', engine: '2.7L V6 Turbo' },
  { year: '*', make: 'FORD', model: 'F-150', trim: 'XLT', series: null, drivetrain: '2WD', engine: '3.5L V6 Turbo' },
  { year: '*', make: 'FORD', model: 'F-150', trim: 'XLT', series: null, drivetrain: '4WD', engine: '3.5L V6 Turbo' },
  { year: '*', make: 'FORD', model: 'F-150', trim: 'LARIAT', series: null, drivetrain: '4WD', engine: '5.0L V8' },
  { year: '*', make: 'FORD', model: 'ESCAPE', trim: 'S', series: null, drivetrain: 'FWD', engine: '1.5L I3 Turbo' },
  { year: '*', make: 'FORD', model: 'ESCAPE', trim: 'SE', series: null, drivetrain: 'AWD', engine: '2.0L I4 Turbo' },
  { year: '*', make: 'FORD', model: 'ESCAPE', trim: 'HYBRID', series: null, drivetrain: 'AWD', engine: '2.5L Hybrid I4' },
  { year: '*', make: 'FORD', model: 'EXPLORER', trim: 'XLT', series: null, drivetrain: 'RWD', engine: '2.3L I4 Turbo' },
  { year: '*', make: 'FORD', model: 'EXPLORER', trim: 'XLT', series: null, drivetrain: '4WD', engine: '2.3L I4 Turbo' },
  { year: '*', make: 'FORD', model: 'EXPLORER', trim: 'ST', series: null, drivetrain: '4WD', engine: '3.0L V6 Turbo' },
  { year: '*', make: 'FORD', model: 'MUSTANG', trim: 'ECOBOOST', series: null, drivetrain: 'RWD', engine: '2.3L I4 Turbo' },
  { year: '*', make: 'FORD', model: 'MUSTANG', trim: 'GT', series: null, drivetrain: 'RWD', engine: '5.0L V8' },
  { year: '2006', make: 'FORD', model: 'SUPER DUTY', trim: 'F-250', series: null, drivetrain: '4WD', engine: '6.0L Power Stroke Diesel' },
  { year: '2006', make: 'FORD', model: 'F-250 SUPER DUTY', trim: 'F-250', series: null, drivetrain: '4WD', engine: '6.0L Power Stroke Diesel' },

  { year: '*', make: 'TOYOTA', model: 'CAMRY', trim: 'LE', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'TOYOTA', model: 'CAMRY', trim: 'SE', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'TOYOTA', model: 'CAMRY', trim: 'XSE', series: null, drivetrain: 'FWD', engine: '3.5L V6' },
  { year: '*', make: 'TOYOTA', model: 'CAMRY', trim: 'HYBRID LE', series: null, drivetrain: 'FWD', engine: '2.5L Hybrid I4' },
  { year: '*', make: 'TOYOTA', model: 'RAV4', trim: 'LE', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'TOYOTA', model: 'RAV4', trim: 'LE', series: null, drivetrain: 'AWD', engine: '2.5L I4' },
  { year: '*', make: 'TOYOTA', model: 'RAV4', trim: 'XLE', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'TOYOTA', model: 'RAV4', trim: 'XLE', series: null, drivetrain: 'AWD', engine: '2.5L I4' },
  { year: '*', make: 'TOYOTA', model: 'RAV4', trim: 'HYBRID XLE', series: null, drivetrain: 'AWD', engine: '2.5L Hybrid I4' },
  { year: '*', make: 'TOYOTA', model: 'HIGHLANDER', trim: 'LE', series: null, drivetrain: 'FWD', engine: '2.4L I4 Turbo' },
  { year: '*', make: 'TOYOTA', model: 'HIGHLANDER', trim: 'LE', series: null, drivetrain: 'AWD', engine: '2.4L I4 Turbo' },
  { year: '*', make: 'TOYOTA', model: 'HIGHLANDER', trim: 'HYBRID XLE', series: null, drivetrain: 'AWD', engine: '2.5L Hybrid I4' },
  { year: '*', make: 'TOYOTA', model: '4RUNNER', trim: 'SR5', series: null, drivetrain: '2WD', engine: '4.0L V6' },
  { year: '*', make: 'TOYOTA', model: '4RUNNER', trim: 'SR5', series: null, drivetrain: '4WD', engine: '4.0L V6' },
  { year: '*', make: 'TOYOTA', model: '4RUNNER', trim: 'TRD OFF-ROAD', series: null, drivetrain: '4WD', engine: '4.0L V6' },
  { year: '*', make: 'TOYOTA', model: 'TACOMA', trim: 'SR', series: null, drivetrain: '2WD', engine: '2.4L I4 Turbo' },
  { year: '*', make: 'TOYOTA', model: 'TACOMA', trim: 'SR5', series: null, drivetrain: '4WD', engine: '2.4L I4 Turbo' },
  { year: '*', make: 'TOYOTA', model: 'TACOMA', trim: 'TRD OFF-ROAD', series: null, drivetrain: '4WD', engine: '2.4L I4 Turbo' },

  { year: '2021', make: 'TESLA', model: 'MODEL 3', trim: 'Long Range', series: null, drivetrain: 'AWD', engine: 'Dual Motor Electric' },

  { year: '*', make: 'NISSAN', model: 'ALTIMA', trim: 'S', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'NISSAN', model: 'ALTIMA', trim: 'SV', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'NISSAN', model: 'ALTIMA', trim: 'SV', series: null, drivetrain: 'AWD', engine: '2.5L I4' },
  { year: '*', make: 'NISSAN', model: 'ALTIMA', trim: 'SR VC-TURBO', series: null, drivetrain: 'FWD', engine: '2.0L I4 Turbo' },
  { year: '*', make: 'NISSAN', model: 'ROGUE', trim: 'S', series: null, drivetrain: 'FWD', engine: '1.5L I3 Turbo' },
  { year: '*', make: 'NISSAN', model: 'ROGUE', trim: 'SV', series: null, drivetrain: 'FWD', engine: '1.5L I3 Turbo' },
  { year: '*', make: 'NISSAN', model: 'ROGUE', trim: 'SV', series: null, drivetrain: 'AWD', engine: '1.5L I3 Turbo' },
  { year: '*', make: 'NISSAN', model: 'FRONTIER', trim: 'S', series: null, drivetrain: '2WD', engine: '3.8L V6' },
  { year: '*', make: 'NISSAN', model: 'FRONTIER', trim: 'SV', series: null, drivetrain: '4WD', engine: '3.8L V6' },

  { year: '*', make: 'JEEP', model: 'WRANGLER', trim: 'SPORT', series: null, drivetrain: '4WD', engine: '3.6L V6' },
  { year: '*', make: 'JEEP', model: 'WRANGLER', trim: 'WILLYS', series: null, drivetrain: '4WD', engine: '2.0L I4 Turbo' },
  { year: '*', make: 'JEEP', model: 'GRAND CHEROKEE', trim: 'LAREDO', series: null, drivetrain: 'RWD', engine: '3.6L V6' },
  { year: '*', make: 'JEEP', model: 'GRAND CHEROKEE', trim: 'LAREDO', series: null, drivetrain: '4WD', engine: '3.6L V6' },
  { year: '*', make: 'JEEP', model: 'GRAND CHEROKEE', trim: 'OVERLAND', series: null, drivetrain: '4WD', engine: '5.7L V8' },

  { year: '*', make: 'SUBARU', model: 'OUTBACK', trim: 'PREMIUM', series: null, drivetrain: 'AWD', engine: '2.5L H4' },
  { year: '*', make: 'SUBARU', model: 'OUTBACK', trim: 'WILDERNESS', series: null, drivetrain: 'AWD', engine: '2.4L Turbo H4' },
  { year: '*', make: 'SUBARU', model: 'FORESTER', trim: 'PREMIUM', series: null, drivetrain: 'AWD', engine: '2.5L H4' },
  { year: '*', make: 'SUBARU', model: 'CROSSTREK', trim: 'SPORT', series: null, drivetrain: 'AWD', engine: '2.5L H4' },

  { year: '*', make: 'HYUNDAI', model: 'SONATA', trim: 'SE', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'HYUNDAI', model: 'SONATA', trim: 'N LINE', series: null, drivetrain: 'FWD', engine: '2.5L I4 Turbo' },
  { year: '*', make: 'HYUNDAI', model: 'SONATA', trim: 'HYBRID LIMITED', series: null, drivetrain: 'FWD', engine: '2.0L Hybrid I4' },
  { year: '*', make: 'HYUNDAI', model: 'SANTA FE', trim: 'SE', series: null, drivetrain: 'FWD', engine: '2.5L I4' },
  { year: '*', make: 'HYUNDAI', model: 'SANTA FE', trim: 'XRT', series: null, drivetrain: 'AWD', engine: '2.5L I4' },
  { year: '*', make: 'HYUNDAI', model: 'SANTA FE', trim: 'LIMITED', series: null, drivetrain: 'AWD', engine: '2.5L I4 Turbo' },

  { year: '*', make: 'GMC', model: 'YUKON', trim: 'SLE', series: null, drivetrain: '2WD', engine: '5.3L V8' },
  { year: '*', make: 'GMC', model: 'YUKON', trim: 'SLE', series: null, drivetrain: '4WD', engine: '5.3L V8' },
  { year: '*', make: 'GMC', model: 'YUKON', trim: 'DENALI', series: null, drivetrain: '4WD', engine: '6.2L V8' },
];

const MODEL_ALIASES = {
  'CRV': 'CR-V',
  'CR V': 'CR-V',
  'F150': 'F-150',
  'GRANDCHEROKEE': 'GRAND CHEROKEE',
  'HRV': 'HR-V',
  'RAV 4': 'RAV4',
  'SILVERADO': 'SILVERADO 1500',
};

const SCHEMATIC_DISCIPLINES = [
  'Power Distribution',
  'Starting and Charging',
  'Engine Controls',
  'Body Controls',
  'Lighting',
  'HVAC',
  'ABS and Chassis',
  'Audio and Infotainment',
  'Connectors and Grounds',
];

const SOURCE_URLS = {
  recallsSearch: 'https://www.nhtsa.gov/recalls',
  manufacturerCommunications: 'https://www.nhtsa.gov/resources-investigations-recalls',
  manufacturerCommunicationsData: 'https://www.nhtsa.gov/es/nhtsa-datasets-and-apis',
  complaintsApiDocs: 'https://www.nhtsa.gov/es/nhtsa-datasets-and-apis',
  nastfAutomakerInfo:
    'https://support.nastf.org/support/solutions/articles/43000756394-nastf-automaker-info-pages',
  motorWiringDiagrams:
    'https://www.motor.com/products-services/data-products/wiring-diagrams/',
  alldataWiringDiagrams: 'https://www.alldata.com/eu/en/OEM-Wiring-Diagrams',
};

const PARTS_CATALOG = [
  'Body & Lamp Assembly',
  'Brake & Wheel Hub',
  'Belt Drive',
  'Cooling System',
  'Electrical',
  'Engine',
  'Exhaust & Emission',
  'Fuel & Air',
  'Heating & Air Conditioning',
  'Ignition',
  'Interior',
  'Steering',
  'Suspension',
  'Transmission',
  'Wiper & Washer',
];

function sortStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function normalizeText(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeModel(value) {
  const normalized = normalizeText(value)
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');

  return MODEL_ALIASES[normalized] || normalized;
}

function canonicalizeModel(value) {
  return normalizeModel(value).replace(/[^A-Z0-9]/g, '');
}

function getField(item, names) {
  for (const name of names) {
    if (item && item[name] !== undefined && item[name] !== null && item[name] !== '') {
      return item[name];
    }
  }

  return null;
}

function buildVehicleLabel(year, make, model) {
  return `${year} ${make} ${model}`;
}

function getGeoHeaders() {
  const userAgent = APP_CONTACT_EMAIL
    ? `Auto Fix Help/1.0 (${APP_CONTACT_EMAIL})`
    : 'Auto Fix Help/1.0';

  return {
    Accept: 'application/json',
    'User-Agent': userAgent,
  };
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMiles * c;
}

function formatDistanceMiles(distance) {
  return `${distance.toFixed(1)} miles`;
}

function buildRecallSourceUrl(campaignNumber) {
  return `https://www.nhtsa.gov/recalls?nhtsaid=${encodeURIComponent(campaignNumber)}`;
}

function buildComplaintSourceUrl(odiNumber) {
  return `https://api.nhtsa.gov/complaints/odinumber?odinumber=${encodeURIComponent(
    odiNumber
  )}`;
}

function parseInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseBooleanOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true' || value === 'yes') {
    return true;
  }

  if (value === 'false' || value === 'no') {
    return false;
  }

  return null;
}

function generateToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash = '') {
  const [salt, originalHash] = String(storedHash).split(':');

  if (!salt || !originalHash) {
    return false;
  }

  const derivedHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');

  return crypto.timingSafeEqual(
    Buffer.from(originalHash, 'hex'),
    Buffer.from(derivedHash, 'hex')
  );
}

function getCachedValue(key) {
  const cached = APP_CACHE.get(key);

  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    APP_CACHE.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue(key, value, ttlMs = CACHE_TTL_MS) {
  APP_CACHE.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

function buildCarApiCacheKey(endpoint, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  return `${endpoint}?${searchParams.toString()}`;
}

function getCarApiHeaders(jwt = '') {
  return {
    Accept: 'application/json',
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

function getCarScanHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    authorization: CARSCAN_AUTHORIZATION_KEY,
    'partner-token': CARSCAN_PARTNER_TOKEN,
  };
}

function normalizeCarApiCollection(responseData) {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  if (Array.isArray(responseData?.results)) {
    return responseData.results;
  }

  return [];
}

function buildCarApiFilters(filters = []) {
  return JSON.stringify(
    filters.filter((filter) => filter && filter.val !== undefined && filter.val !== null && filter.val !== '')
  );
}

async function getCarApiJwt() {
  if (!CAR_API_TOKEN || !CAR_API_SECRET) {
    return '';
  }

  if (CAR_API_AUTH_CACHE.token && Date.now() < CAR_API_AUTH_CACHE.expiresAt) {
    return CAR_API_AUTH_CACHE.token;
  }

  const response = await axios.post(
    `${CAR_API_BASE_URL}/auth/login`,
    {
      api_token: CAR_API_TOKEN,
      api_secret: CAR_API_SECRET,
    },
    {
      headers: {
        Accept: 'text/plain',
        'Content-Type': 'application/json',
      },
    }
  );

  const token = typeof response.data === 'string' ? response.data.trim() : '';

  if (!token) {
    throw new Error('CarAPI authentication did not return a token');
  }

  CAR_API_AUTH_CACHE.token = token;
  CAR_API_AUTH_CACHE.expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 6;

  return token;
}

async function carApiGet(endpoint, params = {}) {
  const cacheKey = buildCarApiCacheKey(endpoint, params);
  const cached = getCachedValue(cacheKey);

  if (cached) {
    return cached;
  }

  const jwt = await getCarApiJwt();

  const response = await axios.get(`${CAR_API_BASE_URL}${endpoint}`, {
    headers: getCarApiHeaders(jwt),
    params,
  });

  return setCachedValue(cacheKey, response.data);
}

async function carScanGet(endpoint, params = {}, useCache = true) {
  if (!CARSCAN_PARTNER_TOKEN || !CARSCAN_AUTHORIZATION_KEY) {
    throw new Error('CarScan credentials are not configured');
  }

  const cacheKey = `carscan:${buildCarApiCacheKey(endpoint, params)}`;
  const cached = useCache ? getCachedValue(cacheKey) : null;

  if (cached) {
    return cached;
  }

  const response = await axios.get(`${CARSCAN_BASE_URL}${endpoint}`, {
    headers: getCarScanHeaders(),
    params,
  });

  if (response.data?.message?.message === 'failed') {
    throw new Error(response.data?.message?.message || 'CarScan request failed');
  }

  return useCache ? setCachedValue(cacheKey, response.data) : response.data;
}

function buildShopSpecialtyMatch(make = '', issue = '', tags = {}) {
  const normalizedIssue = String(issue || '').toLowerCase();
  const normalizedName = String(tags.name || '').toLowerCase();
  const normalizedText = [
    tags.description,
    tags['service:vehicle:repair'],
    tags['service:vehicle:diagnostics'],
    tags.shop,
    tags.amenity,
    tags['repair'],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    normalizedIssue.includes('electrical') ||
    normalizedIssue.includes('diagnostic') ||
    normalizedName.includes('electric') ||
    normalizedText.includes('diagnostic')
  ) {
    return {
      specialty: 'Diagnostics and electrical',
      matchReason: 'Good fit for diagnostic and electrical work',
      specialtyScore: 3,
    };
  }

  if (
    normalizedIssue.includes('brake') ||
    normalizedName.includes('brake') ||
    normalizedText.includes('brake')
  ) {
    return {
      specialty: 'Brake service',
      matchReason: 'Good fit for brake-related work',
      specialtyScore: 3,
    };
  }

  if (make && normalizedName.includes(String(make).toLowerCase())) {
    return {
      specialty: `${make} service`,
      matchReason: `Matches your ${make} vehicle`,
      specialtyScore: 2,
    };
  }

  return {
    specialty: 'General auto repair',
    matchReason: 'Local repair shop near your ZIP code',
    specialtyScore: 1,
  };
}

async function geocodeZipCode(zip) {
  const cacheKey = `zipcode:${zip}`;
  const cached = getCachedValue(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
    headers: getGeoHeaders(),
    params: {
      postalcode: zip,
      countrycodes: 'us',
      format: 'jsonv2',
      limit: 1,
    },
  });

  const match = Array.isArray(response.data) ? response.data[0] : null;

  if (!match?.lat || !match?.lon) {
    throw new Error('ZIP code lookup did not return coordinates');
  }

  return setCachedValue(cacheKey, {
    lat: Number.parseFloat(match.lat),
    lon: Number.parseFloat(match.lon),
    displayName: match.display_name || zip,
  });
}

async function findShopsNearZip(zip, options = {}) {
  const { make = '', issue = '' } = options;
  const { lat, lon } = await geocodeZipCode(zip);
  const query = `
[out:json][timeout:25];
(
  node(around:25000,${lat},${lon})["shop"="car_repair"];
  way(around:25000,${lat},${lon})["shop"="car_repair"];
  relation(around:25000,${lat},${lon})["shop"="car_repair"];
  node(around:25000,${lat},${lon})["amenity"="car_repair"];
  way(around:25000,${lat},${lon})["amenity"="car_repair"];
  relation(around:25000,${lat},${lon})["amenity"="car_repair"];
);
out center tags;
  `.trim();

  const response = await axios.post(OVERPASS_BASE_URL, query, {
    headers: {
      ...getGeoHeaders(),
      'Content-Type': 'text/plain',
    },
  });

  const elements = Array.isArray(response.data?.elements) ? response.data.elements : [];

  return elements
    .map((element) => {
      const tags = element.tags || {};
      const latitude = element.lat || element.center?.lat;
      const longitude = element.lon || element.center?.lon;

      if (!latitude || !longitude || !tags.name) {
        return null;
      }

      const specialtyMatch = buildShopSpecialtyMatch(make, issue, tags);
      const distanceMiles = calculateDistanceMiles(lat, lon, latitude, longitude);
      const metadataScore = [
        tags.website,
        tags.phone,
        tags['contact:phone'],
        tags.opening_hours,
      ].filter(Boolean).length;

      return {
        id: `${element.type}-${element.id}`,
        name: tags.name,
        rating: null,
        distance: formatDistanceMiles(distanceMiles),
        distanceValue: distanceMiles,
        specialty: specialtyMatch.specialty,
        matchReason: specialtyMatch.matchReason,
        zipCode: zip,
        sourceName: 'OpenStreetMap shop data',
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        specialtyScore: specialtyMatch.specialtyScore,
        metadataScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.specialtyScore !== a.specialtyScore) {
        return b.specialtyScore - a.specialtyScore;
      }

      if (b.metadataScore !== a.metadataScore) {
        return b.metadataScore - a.metadataScore;
      }

      return a.distanceValue - b.distanceValue;
    })
    .slice(0, 8)
    .map(({ distanceValue, specialtyScore, metadataScore, ...shop }) => shop);
}

function buildEngineLabelFromCarApi(engineData = {}) {
  const size = engineData.size ? `${engineData.size}L` : '';
  const cylinders = engineData.cylinders || '';
  const engineType = engineData.engine_type || '';
  const fuelType = engineData.fuel_type || '';

  const pieces = [size, cylinders]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (!pieces) {
    return [engineType, fuelType].filter(Boolean).join(', ').trim();
  }

  if (fuelType && /e85|flex-fuel/i.test(fuelType)) {
    return `${pieces} Flex Fuel`;
  }

  if (engineType && /hybrid/i.test(engineType)) {
    return `${pieces} Hybrid`;
  }

  return pieces;
}

const VALID_FUEL_TYPES = new Set([
  'gasoline',
  'diesel',
  'hybrid',
  'plug_in_hybrid',
  'electric',
  'flex_fuel',
  'unknown',
]);

function normalizeFuelType(value) {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'gas' || normalized === 'petrol') return 'gasoline';
  if (normalized === 'phev' || normalized === 'plug_in' || normalized === 'plug-in_hybrid') return 'plug_in_hybrid';
  if (normalized === 'ev' || normalized === 'bev') return 'electric';
  if (normalized === 'flex' || normalized === 'flexfuel' || normalized === 'e85') return 'flex_fuel';
  return VALID_FUEL_TYPES.has(normalized) ? normalized : 'unknown';
}

function inferFuelTypeFromEngineText(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  if (!text.trim()) return { fuelType: 'unknown', confidence: 'low' };
  if (/dual motor|electric|bev|ev\b|battery electric|tesla/.test(text)) {
    return { fuelType: 'electric', confidence: 'high' };
  }
  if (/plug[-\s]?in|phev/.test(text)) {
    return { fuelType: 'plug_in_hybrid', confidence: 'high' };
  }
  if (/flex fuel|flex-fuel|e85|ffv/.test(text)) {
    return { fuelType: 'flex_fuel', confidence: 'high' };
  }
  if (/diesel|duramax|power stroke|powerstroke|cummins|tdi|ecodiesel|bluetech|640d|\bd\b/.test(text)) {
    return { fuelType: 'diesel', confidence: 'high' };
  }
  if (/hybrid/.test(text)) {
    return { fuelType: 'hybrid', confidence: 'high' };
  }
  if (/turbo|v6|v8|v10|v12|i3|i4|i5|i6|inline|cylinder|gasoline|640i|\bi\b/.test(text)) {
    return { fuelType: 'gasoline', confidence: 'high' };
  }
  return { fuelType: 'unknown', confidence: 'low' };
}

function normalizeEngineOption(engineOption, vehicle = {}) {
  const raw =
    typeof engineOption === 'string'
      ? { label: engineOption, value: engineOption }
      : engineOption || {};
  const label = String(raw.label || raw.value || raw.engine || '').trim();
  const value = String(raw.value || label).trim();
  const inferred = inferFuelTypeFromEngineText(label, raw.engineCode, vehicle.trim, vehicle.model);
  const fuelType = normalizeFuelType(raw.fuelType || raw.fuel_type || inferred.fuelType);

  return {
    label,
    value,
    engineCode: raw.engineCode || raw.engine_code || '',
    fuelType,
    confidence: raw.confidence || (fuelType === inferred.fuelType ? inferred.confidence : 'high'),
    source: raw.source || 'engineOption',
  };
}

function sortEngineOptions(options = []) {
  return options
    .filter((option) => option.label && option.value)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
}

function buildEngineLabelFromVpicValues(values = {}) {
  const litersRaw = values.displacementL || '';
  const litersNumber = Number.parseFloat(litersRaw);
  const liters = Number.isNaN(litersNumber) ? '' : `${litersNumber.toFixed(1)}L`;
  const cylindersRaw = String(values.cylinders || '').trim();
  const configurationRaw = String(values.configuration || '').trim().toLowerCase();
  const fuelTypeRaw = String(values.fuelType || '').trim().toLowerCase();

  let cylinderLabel = '';

  if (cylindersRaw) {
    if (configurationRaw.includes('v')) {
      cylinderLabel = `V${cylindersRaw}`;
    } else if (configurationRaw.includes('in-line') || configurationRaw.includes('inline')) {
      cylinderLabel = `I${cylindersRaw}`;
    } else if (configurationRaw.includes('flat')) {
      cylinderLabel = `H${cylindersRaw}`;
    } else {
      cylinderLabel = `${cylindersRaw} cyl`;
    }
  } else if (configurationRaw === 'v-shaped') {
    cylinderLabel = 'V engine';
  }

  const base = [liters, cylinderLabel].filter(Boolean).join(' ').trim();

  if (!base && values.configuration) {
    return values.configuration;
  }

  if (fuelTypeRaw.includes('flex') || fuelTypeRaw.includes('e85')) {
    return `${base} Flex Fuel`.trim();
  }

  if (fuelTypeRaw.includes('hybrid')) {
    return `${base} Hybrid`.trim();
  }

  if (fuelTypeRaw.includes('diesel')) {
    return `${base} Diesel`.trim();
  }

  return base || null;
}

function buildTransmissionLabelFromVpic(value) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return null;
  }

  if (/automatic/i.test(normalized)) {
    return normalized.replace(/\btransmission\b/i, '').trim();
  }

  if (/manual/i.test(normalized) || /cvt/i.test(normalized)) {
    return normalized.replace(/\btransmission\b/i, '').trim();
  }

  return normalized;
}

function buildTrimPackageLabel(series, trim) {
  const label = [trim, series].filter(Boolean).join(' ').trim();
  return label || trim || series || null;
}

function formatDriveTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized === 'front wheel drive') {
    return 'FWD';
  }

  if (normalized === 'rear wheel drive') {
    return 'RWD';
  }

  if (normalized === 'all wheel drive') {
    return 'AWD';
  }

  if (normalized === 'four wheel drive') {
    return '4WD';
  }

  return value;
}

function formatTrimRecord(trimRecord = {}) {
  const submodel = trimRecord.submodel || trimRecord.trim || '';
  const trim = trimRecord.trim || submodel || '';
  const label = [submodel, trim !== submodel ? trim : ''].filter(Boolean).join(' ').trim();

  return {
    id: trimRecord.id || trimRecord.submodel_id || trimRecord.trim_id || label,
    trim: trim || label,
    submodel: submodel || null,
    label: label || trim || submodel || 'Base',
    description: trimRecord.description || '',
  };
}

function buildVehicleOptionMatrixFromCarApi(trimRecords = [], engineRecords = []) {
  const trims = sortStrings(
    Array.from(new Set(trimRecords.map((record) => formatTrimRecord(record).label).filter(Boolean)))
  );

  const engineMap = new Map();
  const drivetrains = [];
  const transmissions = [];

  engineRecords.forEach((record) => {
    const engineLabel = buildEngineLabelFromCarApi(record);
    const driveLabel = formatDriveTypeLabel(record.drive_type || record.drivetrain || '');
    const transmissionLabel = record.transmission || '';

    if (engineLabel) {
      const option = normalizeEngineOption(
        {
          label: engineLabel,
          value: engineLabel,
          engineCode: record.engine_code || record.engineCode || '',
          fuelType: record.fuel_type,
          confidence: record.fuel_type ? 'high' : undefined,
          source: 'engineOption',
        },
        record
      );
      engineMap.set(option.value, option);
    }

    if (driveLabel) {
      drivetrains.push(driveLabel);
    }

    if (transmissionLabel) {
      transmissions.push(transmissionLabel);
    }
  });

  return {
    trims,
    engines: sortEngineOptions(Array.from(engineMap.values())),
    drivetrains: sortStrings(Array.from(new Set(drivetrains))),
    transmissions: sortStrings(Array.from(new Set(transmissions))),
  };
}

async function fetchCarApiYears() {
  const data = await carApiGet('/years');
  const years = normalizeCarApiCollection(data)
    .map((value) => String(value))
    .filter(Boolean);

  return years.length > 0 ? sortStrings(Array.from(new Set(years))).reverse() : YEARS;
}

async function fetchCarApiMakesByYear(year) {
  const filters = buildCarApiFilters([{ field: 'year', op: '=', val: Number.parseInt(year, 10) }]);
  const data = await carApiGet('/makes', {
    sort: 'name',
    direction: 'asc',
    json: filters,
    limit: 1000,
  });

  return sortStrings(
    Array.from(
      new Set(
        normalizeCarApiCollection(data)
          .map((item) => item.name || item.make || item)
          .filter(Boolean)
      )
    )
  );
}

async function fetchCarApiModelsByYearMake(year, make) {
  const filters = buildCarApiFilters([
    { field: 'year', op: '=', val: Number.parseInt(year, 10) },
    { field: 'make', op: '=', val: make },
  ]);
  const data = await carApiGet('/models', {
    sort: 'name',
    direction: 'asc',
    json: filters,
    limit: 1000,
  });

  return sortStrings(
    Array.from(
      new Set(
        normalizeCarApiCollection(data)
          .map((item) => item.name || item.model || item)
          .filter(Boolean)
      )
    )
  );
}

async function fetchCarApiTrimRecords(year, make, model) {
  const filters = buildCarApiFilters([
    { field: 'year', op: '=', val: Number.parseInt(year, 10) },
    { field: 'make', op: '=', val: make },
    { field: 'model', op: '=', val: model },
  ]);
  const data = await carApiGet('/trims', {
    sort: 'trim',
    direction: 'asc',
    json: filters,
    limit: 1000,
  });

  return normalizeCarApiCollection(data);
}

async function fetchCarApiEngineRecords(year, make, model, trim = '') {
  const filters = [
    { field: 'year', op: '=', val: Number.parseInt(year, 10) },
    { field: 'make', op: '=', val: make },
    { field: 'model', op: '=', val: model },
  ];

  if (trim) {
    filters.push({ field: 'trim', op: '=', val: trim });
  }

  const data = await carApiGet('/engines', {
    json: buildCarApiFilters(filters),
    limit: 1000,
  });

  return normalizeCarApiCollection(data);
}

function buildVehicleSpecificObdNotes(code, vehicle) {
  if (!vehicle?.make || !vehicle?.model || !vehicle?.year) {
    return '';
  }

  return `Vehicle context, ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? `, ${vehicle.engine}` : ''}${vehicle.drivetrain ? `, ${vehicle.drivetrain}` : ''}. Use this as a starting point, not a guaranteed diagnosis.`;
}

function getDifficultyLabel(value) {
  const difficulty = Number.parseInt(value, 10);

  if (!difficulty) {
    return null;
  }

  if (difficulty <= 2) {
    return 'Easy';
  }

  if (difficulty === 3) {
    return 'Moderate';
  }

  return 'Hard';
}

function normalizeCostValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getLatestMileageFromHistoryEntries(historyEntries = []) {
  const entryWithMileage = historyEntries.find((entry) => entry?.mileage);
  return entryWithMileage?.mileage ? Number.parseInt(entryWithMileage.mileage, 10) : null;
}

function mapUrgencyToSeverity(urgency, description = '') {
  const numericUrgency = Number.parseInt(urgency, 10);

  if (!Number.isNaN(numericUrgency)) {
    if (numericUrgency >= 3) {
      return 'high';
    }

    if (numericUrgency === 2) {
      return 'medium';
    }

    return 'low';
  }

  return inferObdSeverity('', description);
}

function buildFallbackDiagnosticPayload(code, vehicle = {}, descriptionOverride = '') {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const fallbackCode = BASIC_OBD_CODE_DATA[normalizedCode];
  const definition =
    descriptionOverride ||
    fallbackCode?.description ||
    `Generic OBD-II explanation for ${normalizedCode}`;
  const severity = fallbackCode?.severity || inferObdSeverity(normalizedCode, definition);
  const possibleFixes = buildPossibleFixesForCode(normalizedCode, definition);

  return {
    code: normalizedCode,
    definition,
    description:
      fallbackCode?.genericMeaning ||
      'This is a generic OBD-II trouble code. The exact root cause can vary by vehicle and symptom pattern.',
    severity,
    severity_color: getSeverityColorLabel(severity),
    manufacturer_specific_meaning:
      vehicle.make && vehicle.model
        ? `${vehicle.make} ${vehicle.model} may use this code in a slightly different diagnostic path, so vehicle-specific testing is still important.`
        : null,
    possible_fixes: possibleFixes,
    repair_options: possibleFixes.map((item) => ({
      title: item,
      urgency_desc: null,
      total_cost: null,
      difficulty: null,
      difficulty_label: null,
      tsb_count: 0,
    })),
    difficulty: null,
    difficulty_label: null,
    estimated_cost: null,
    notes: [
      buildVehicleSpecificObdNotes(normalizedCode, vehicle),
      'These are possible causes and not guaranteed fixes.',
    ].filter(Boolean),
    disclaimer: 'These are possible causes and not guaranteed fixes',
    source_name: fallbackCode ? 'Auto Fix Help fallback OBD dataset' : 'Generic OBD-II fallback',
    source_url: 'https://carapi.app/features/obd-code-api',
  };
}

function normalizeCarScanCodeResponse(responseData = {}, normalizedCode = '') {
  const codes = Array.isArray(responseData?.data?.codes) ? responseData.data.codes : [];
  return codes.find((item) => String(item.code || '').toUpperCase() === normalizedCode) || null;
}

function normalizeCarScanDiagResponse(responseData = {}) {
  return responseData?.data && typeof responseData.data === 'object' ? responseData.data : null;
}

function normalizeCarScanRepairResponse(responseData = {}) {
  const data = responseData?.data;

  if (Array.isArray(data)) {
    return data;
  }

  return [];
}

function getSeverityColorLabel(severity) {
  if (severity === 'high') {
    return '#dc2626';
  }

  if (severity === 'medium') {
    return '#f59e0b';
  }

  return '#2563eb';
}

function inferObdSeverity(code, description = '') {
  const normalizedCode = String(code || '').toUpperCase();
  const normalizedDescription = String(description || '').toLowerCase();

  if (
    normalizedCode.startsWith('P03') ||
    normalizedCode === 'P0420' ||
    normalizedDescription.includes('misfire')
  ) {
    return 'high';
  }

  if (
    normalizedCode.startsWith('P01') ||
    normalizedCode.startsWith('P04') ||
    normalizedDescription.includes('catalyst') ||
    normalizedDescription.includes('fuel')
  ) {
    return 'medium';
  }

  return 'low';
}

function buildPossibleFixesForCode(code, description = '') {
  const normalizedCode = String(code || '').toUpperCase();
  const normalizedDescription = String(description || '').toLowerCase();
  const basicRecord = BASIC_OBD_CODE_DATA[normalizedCode];

  if (basicRecord?.possibleFixes?.length) {
    return basicRecord.possibleFixes;
  }

  if (normalizedDescription.includes('misfire')) {
    return [
      'Inspect spark plugs, coils, and ignition wiring',
      'Check for fuel delivery issues',
      'Check compression and mechanical timing if the problem persists',
    ];
  }

  if (normalizedDescription.includes('lean')) {
    return [
      'Check for intake leaks and vacuum leaks',
      'Inspect the mass air flow sensor',
      'Verify fuel pressure and injector delivery',
    ];
  }

  if (normalizedDescription.includes('catalyst')) {
    return [
      'Check for misfires or fuel trim problems before replacing converter parts',
      'Inspect oxygen sensor operation',
      'Inspect for exhaust leaks and converter restriction',
    ];
  }

  return [
    'Confirm the code with a scan tool and freeze frame data',
    'Inspect related wiring, connectors, and obvious component faults',
    'Use vehicle-specific service information before replacing parts',
  ];
}

function buildTrimLabel(entry) {
  return [entry.trim, entry.series].filter(Boolean).join(' ').trim();
}

function resolveVehicleOptionRecords(year, make, model) {
  const normalizedYear = normalizeText(year);
  const normalizedMake = normalizeText(make);
  const normalizedModel = normalizeModel(model);
  const requestedCanonicalModel = canonicalizeModel(normalizedModel);

  return VEHICLE_OPTIONS_DB.filter((entry) => {
    const canonicalEntryModel = canonicalizeModel(entry.model);
    const yearMatches = entry.year === '*' || normalizeText(entry.year) === normalizedYear;
    const makeMatches = normalizeText(entry.make) === normalizedMake;
    const modelMatches =
      requestedCanonicalModel === canonicalEntryModel ||
      requestedCanonicalModel.startsWith(canonicalEntryModel) ||
      canonicalEntryModel.startsWith(requestedCanonicalModel);

    return yearMatches && makeMatches && modelMatches;
  });
}

function resolveFitmentOptions(year, make, model, selectedTrim = '') {
  const matchingRecords = resolveVehicleOptionRecords(year, make, model);

  if (matchingRecords.length === 0) {
    return {
      trims: [],
      drivetrains: [],
      engines: [],
    };
  }

  const normalizedSelectedTrim = normalizeText(selectedTrim);
  const filteredRecords =
    normalizedSelectedTrim
      ? matchingRecords.filter((entry) => normalizeText(buildTrimLabel(entry)) === normalizedSelectedTrim)
      : matchingRecords;

  const workingRecords = filteredRecords.length > 0 ? filteredRecords : matchingRecords;

  return {
    trims: sortStrings(workingRecords.map((entry) => buildTrimLabel(entry)).filter(Boolean)),
    drivetrains: sortStrings(workingRecords.map((entry) => entry.drivetrain).filter(Boolean)),
    engines: sortEngineOptions(
      Array.from(
        new Map(
          workingRecords
            .map((entry) =>
              normalizeEngineOption(entry.engine, {
                year,
                make,
                model,
                trim: buildTrimLabel(entry),
              })
            )
            .filter((option) => option.label && option.value)
            .map((option) => [option.value, option])
        ).values()
      )
    ),
  };
}

async function fetchModelsForMakeYear(make, year) {
  const response = await axios.get(
    `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(
      make
    )}/modelyear/${encodeURIComponent(year)}?format=json`
  );

  return sortStrings(
    Array.from(
      new Set(
        (response.data.Results || [])
          .map((item) => item.Model_Name)
          .filter(Boolean)
      )
    )
  );
}

async function getYearAwareMakes(year) {
  const cacheKey = String(year);

  if (MAKES_BY_YEAR_CACHE.has(cacheKey)) {
    return MAKES_BY_YEAR_CACHE.get(cacheKey);
  }

  const matches = [];
  const batchSize = 6;

  for (let i = 0; i < PASSENGER_VEHICLE_MAKES.length; i += batchSize) {
    const batch = PASSENGER_VEHICLE_MAKES.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (make) => {
        try {
          const models = await fetchModelsForMakeYear(make, cacheKey);
          return models.length > 0 ? make : null;
        } catch (error) {
          console.error(`Make probe failed for ${make} ${cacheKey}:`, error.message);
          return null;
        }
      })
    );

    results.filter(Boolean).forEach((make) => matches.push(make));
  }

  const makes =
    matches.length > 0
      ? sortStrings(Array.from(new Set(matches)))
      : sortStrings(PASSENGER_VEHICLE_MAKES);

  MAKES_BY_YEAR_CACHE.set(cacheKey, makes);
  return makes;
}

function buildTsbResources(year, make, model) {
  const vehicleLabel = buildVehicleLabel(year, make, model);

  return [
    {
      id: 'nhtsa-recalls-search',
      title: 'NHTSA safety issues search',
      summary: `NHTSA says recalls, complaints, investigations, and manufacturer communications for ${vehicleLabel} can be reviewed from its recalls search experience.`,
      sourceName: 'NHTSA Recalls',
      sourceUrl: SOURCE_URLS.recallsSearch,
    },
    {
      id: 'nhtsa-manufacturer-communications',
      title: 'Manufacturer communications and bulletin resources',
      summary:
        'NHTSA states that manufacturer communications, including bulletins and notices, are available through its manufacturer communications resources.',
      sourceName: 'NHTSA Manufacturer Communications',
      sourceUrl: SOURCE_URLS.manufacturerCommunications,
    },
    {
      id: 'nhtsa-manufacturer-communications-data',
      title: 'NHTSA manufacturer communications datasets',
      summary:
        'NHTSA publishes manufacturer communications downloads and TSBS metadata in its datasets and APIs catalog.',
      sourceName: 'NHTSA Datasets and APIs',
      sourceUrl: SOURCE_URLS.manufacturerCommunicationsData,
    },
  ];
}

function buildSchematicResources(year, make, model, discipline) {
  const vehicleLabel = buildVehicleLabel(year, make, model);

  return [
    {
      id: 'nastf-automaker-info',
      title: `${discipline} service information via automaker info pages`,
      summary: `NASTF provides automaker information pages that point repairers to OEM service information sources for ${vehicleLabel}.`,
      sourceName: 'NASTF Automaker Info Pages',
      sourceUrl: SOURCE_URLS.nastfAutomakerInfo,
      access: 'Usually leads to OEM service information and subscription pages',
    },
    {
      id: 'motor-wiring-diagrams',
      title: `${discipline} diagrams from MOTOR`,
      summary:
        'MOTOR advertises OEM-based wiring diagrams covering power distribution, connectors, grounds, lighting, and control modules.',
      sourceName: 'MOTOR Wiring Diagrams',
      sourceUrl: SOURCE_URLS.motorWiringDiagrams,
      access: 'Licensed product',
    },
    {
      id: 'alldata-wiring-diagrams',
      title: `${discipline} diagrams from ALLDATA`,
      summary:
        'ALLDATA says its wiring diagrams come directly from OEM source material and include connector views and technical drawings.',
      sourceName: 'ALLDATA OEM Wiring Diagrams',
      sourceUrl: SOURCE_URLS.alldataWiringDiagrams,
      access: 'Licensed product',
    },
  ];
}

function buildVehiclePartsSearchQuery({
  year,
  make,
  model,
  engine,
  drivetrain,
  partTitle,
  partLabel,
}) {
  return [
    year,
    make,
    model,
    drivetrain || null,
    engine || null,
    partTitle,
    partLabel,
  ]
    .filter(Boolean)
    .join(' ');
}

function slugifyRockAutoSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, ' percent ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '%2B');
}

function buildPartsData(make, model, year, options = {}) {
  const { engine = '', drivetrain = '' } = options;
  const rockAutoVehicleUrl = `https://www.rockauto.com/en/catalog/${slugifyRockAutoSegment(
    make
  )}%2C${encodeURIComponent(year)}%2C${slugifyRockAutoSegment(model)}`;

  return PARTS_CATALOG.map((category) => {
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const categoryHint = buildVehiclePartsSearchQuery({
      year,
      make,
      model,
      engine,
      drivetrain,
      partTitle: category,
    });

    return {
      slug,
      title: category,
      category: 'RockAuto Category',
      fitmentContext: {
        year,
        make,
        model,
        drivetrain: drivetrain || null,
        engine: engine || null,
      },
      rockAutoVehicleUrl,
      searchHint: categoryHint,
      searchUrl: rockAutoVehicleUrl,
      oe: {
        url: rockAutoVehicleUrl,
      },
    };
  });
}

function getResponseText(responseData) {
  if (typeof responseData.output_text === 'string' && responseData.output_text.trim()) {
    return responseData.output_text.trim();
  }

  const output = Array.isArray(responseData.output) ? responseData.output : [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const chunk of content) {
      if (typeof chunk.text === 'string' && chunk.text.trim()) {
        return chunk.text.trim();
      }
    }
  }

  return null;
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
    CREATE TABLE IF NOT EXISTS ai_usage (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES auth_users(id) ON DELETE CASCADE,
      guest_session_token TEXT,
      used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      month_year TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id SERIAL PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id INT REFERENCES auth_users(id) ON DELETE CASCADE,
      session_type TEXT NOT NULL DEFAULT 'guest',
      guest_label TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      vin TEXT UNIQUE,
      owner_user_id INT REFERENCES auth_users(id) ON DELETE SET NULL,
      owner_guest_session_token TEXT,
      make TEXT,
      manufacturer TEXT,
      model TEXT,
      year TEXT,
      series TEXT,
      trim TEXT,
      body_class TEXT,
      vehicle_type TEXT,
      plant_city TEXT,
      plant_state TEXT,
      plant_country TEXT,
      drivetrain TEXT,
      transmission TEXT,
      engine TEXT,
      fuel_type TEXT,
      fuel_type_confidence TEXT,
      zip_code TEXT,
      purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      current_kbb_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES auth_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS owner_guest_session_token TEXT,
    ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_kbb_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS transmission TEXT,
    ADD COLUMN IF NOT EXISTS fuel_type TEXT,
    ADD COLUMN IF NOT EXISTS fuel_type_confidence TEXT;
  `);

  await pool.query(`
    ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_key;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS repair_history_entries (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      entry_type TEXT NOT NULL DEFAULT 'repair',
      service_date DATE,
      mileage INT,
      problem_symptom TEXT,
      suspected_cause TEXT,
      repair_performed TEXT,
      parts_used TEXT,
      labor_notes TEXT,
      parts_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      fixed_issue BOOLEAN,
      follow_up_repair TEXT,
      actual_fix_later TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_todo_items (
      id SERIAL PRIMARY KEY,
      vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL DEFAULT 'maintenance',
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date DATE,
      target_mileage INT,
      estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_images (
      id SERIAL PRIMARY KEY,
      year TEXT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      trim TEXT,
      title TEXT,
      image_url TEXT,
      thumbnail_url TEXT,
      source TEXT,
      license TEXT,
      author TEXT,
      attribution_url TEXT,
      confidence TEXT,
      match_type TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS diagnostic_sessions (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES auth_users(id) ON DELETE SET NULL,
      vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
      flow_id TEXT,
      symptom_text TEXT,
      codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      selected_vehicle_year TEXT,
      selected_vehicle_make TEXT,
      selected_vehicle_model TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS diagnostic_answers (
      id SERIAL PRIMARY KEY,
      session_id INT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      step_id TEXT,
      question TEXT,
      answer TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS diagnostic_suggestions (
      id SERIAL PRIMARY KEY,
      session_id INT NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      cause TEXT NOT NULL,
      score INT NOT NULL DEFAULT 0,
      reason TEXT,
      related_issue_id TEXT,
      related_flow_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS confirmed_fixes (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES auth_users(id) ON DELETE SET NULL,
      vehicle_id INT REFERENCES vehicles(id) ON DELETE SET NULL,
      session_id INT REFERENCES diagnostic_sessions(id) ON DELETE SET NULL,
      year TEXT,
      make TEXT,
      model TEXT,
      flow_id TEXT,
      symptom_text TEXT,
      codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      confirmed_fix TEXT,
      part_replaced TEXT,
      did_fix_problem TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getRepairHistoryByVehicle(vehicleId) {
  const result = await pool.query(
    `SELECT * FROM repair_history_entries
     WHERE vehicle_id = $1
     ORDER BY COALESCE(service_date, created_at) DESC, id DESC`,
    [vehicleId]
  );

  return result.rows;
}

async function getTodoItemsByVehicle(vehicleId) {
  const result = await pool.query(
    `SELECT * FROM vehicle_todo_items
     WHERE vehicle_id = $1
     ORDER BY
       CASE status
         WHEN 'open' THEN 0
         WHEN 'in progress' THEN 1
         WHEN 'completed' THEN 2
         ELSE 3
       END,
       CASE priority
         WHEN 'high' THEN 0
         WHEN 'medium' THEN 1
         WHEN 'low' THEN 2
         ELSE 3
       END,
       COALESCE(due_date, CURRENT_DATE + INTERVAL '100 years') ASC,
       id DESC`,
    [vehicleId]
  );

  return result.rows;
}

async function getSessionFromRequest(req) {
  const sessionToken = req.header('x-session-token');

  if (!sessionToken) {
    return null;
  }

  const result = await pool.query(
    `SELECT s.*, u.email, u.full_name
     FROM auth_sessions s
     LEFT JOIN auth_users u ON u.id = s.user_id
     WHERE s.session_token = $1`,
    [sessionToken]
  );

  const session = result.rows[0] || null;

  if (!session) {
    return null;
  }

  await pool.query(
    `UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [session.id]
  );

  return session;
}

function buildOwnerQueryParts(session, startIndex = 2) {
  if (session?.user_id) {
    return {
      clause: `owner_user_id = $${startIndex}`,
      params: [session.user_id],
    };
  }

  if (session?.session_token) {
    return {
      clause: `owner_guest_session_token = $${startIndex}`,
      params: [session.session_token],
    };
  }

  return {
    clause: '1 = 0',
    params: [],
  };
}

async function getVehicleForSession(vehicleId, session) {
  if (!session) {
    return null;
  }

  const ownerParts = buildOwnerQueryParts(session, 2);
  const result = await pool.query(
    `SELECT * FROM vehicles WHERE id = $1 AND ${ownerParts.clause} LIMIT 1`,
    [vehicleId, ...ownerParts.params]
  );

  return result.rows[0] || null;
}

async function getRepairHistoryEntryForSession(entryId, session) {
  if (!session) {
    return null;
  }

  const ownerParts = buildOwnerQueryParts(session, 2);
  const result = await pool.query(
    `SELECT rhe.*, v.id AS vehicle_id
     FROM repair_history_entries rhe
     JOIN vehicles v ON v.id = rhe.vehicle_id
     WHERE rhe.id = $1
       AND ${ownerParts.clause}
     LIMIT 1`,
    [entryId, ...ownerParts.values]
  );

  return result.rows[0] || null;
}

async function getTodoItemForSession(itemId, session) {
  if (!session) {
    return null;
  }

  const ownerParts = buildOwnerQueryParts(session, 2);
  const result = await pool.query(
    `SELECT vti.*, v.id AS vehicle_id
     FROM vehicle_todo_items vti
     JOIN vehicles v ON v.id = vti.vehicle_id
     WHERE vti.id = $1
       AND ${ownerParts.clause}
     LIMIT 1`,
    [itemId, ...ownerParts.values]
  );

  return result.rows[0] || null;
}

async function migrateGuestDataToUser(guestSessionToken, userId) {
  if (!guestSessionToken || !userId) {
    return;
  }

  await pool.query(
    `UPDATE vehicles
     SET owner_user_id = $2,
         owner_guest_session_token = NULL
     WHERE owner_guest_session_token = $1`,
    [guestSessionToken, userId]
  );
}

function buildKbbValueUrl(vehicle = {}) {
  return 'https://www.kbb.com/whats-my-car-worth/';
}

function buildCostSummary(vehicle, historyEntries, todoItems) {
  const repairEntries = historyEntries.filter((entry) => entry.entry_type === 'repair');
  const maintenanceEntries = historyEntries.filter((entry) => entry.entry_type === 'maintenance');

  const partsSpent = historyEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.parts_cost || 0),
    0
  );
  const laborSpent = historyEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.labor_cost || 0),
    0
  );
  const repairSpent = repairEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.total_cost || 0),
    0
  );
  const maintenanceSpent = maintenanceEntries.reduce(
    (sum, entry) => sum + Number.parseFloat(entry.total_cost || 0),
    0
  );
  const recentRepairCosts = repairEntries
    .slice(0, 5)
    .reduce((sum, entry) => sum + Number.parseFloat(entry.total_cost || 0), 0);
  const openTodoEstimatedTotal = todoItems
    .filter((item) => item.status !== 'completed')
    .reduce((sum, item) => sum + Number.parseFloat(item.estimated_cost || 0), 0);
  const purchasePrice = Number.parseFloat(vehicle?.purchase_price || 0) || 0;
  const currentKbbValue = Number.parseFloat(vehicle?.current_kbb_value || 0) || 0;
  const totalInvested = purchasePrice + partsSpent + laborSpent;
  const totalIntoVehicle = purchasePrice + repairSpent + maintenanceSpent;

  return {
    purchasePrice,
    currentKbbValue,
    partsSpent,
    laborSpent,
    repairSpent,
    maintenanceSpent,
    recentRepairCosts,
    openTodoEstimatedTotal,
    totalInvested,
    totalIntoVehicle,
    equityVsKbb: currentKbbValue - totalInvested,
    kbbValueUrl: buildKbbValueUrl(vehicle),
  };
}

function buildDiagnosticContext(historyEntries) {
  const unresolvedRepairs = historyEntries
    .filter((entry) => entry.fixed_issue === false)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      problemSymptom: entry.problem_symptom,
      attemptedRepair: entry.repair_performed,
      actualFixLater: entry.actual_fix_later,
      followUpRepair: entry.follow_up_repair,
      serviceDate: entry.service_date,
    }));

  const repeatedSymptomsMap = historyEntries.reduce((acc, entry) => {
    const key = (entry.problem_symptom || '').trim().toLowerCase();

    if (!key) {
      return acc;
    }

    if (!acc[key]) {
      acc[key] = {
        symptom: entry.problem_symptom,
        count: 0,
        attemptedRepairs: [],
      };
    }

    acc[key].count += 1;

    if (
      entry.repair_performed &&
      !acc[key].attemptedRepairs.includes(entry.repair_performed) &&
      acc[key].attemptedRepairs.length < 3
    ) {
      acc[key].attemptedRepairs.push(entry.repair_performed);
    }

    return acc;
  }, {});

  const repeatedSymptoms = Object.values(repeatedSymptomsMap)
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentParts = historyEntries
    .filter((entry) => entry.parts_used)
    .slice(0, 5)
    .map((entry) => ({
      id: entry.id,
      partsUsed: entry.parts_used,
      repairPerformed: entry.repair_performed,
      serviceDate: entry.service_date,
    }));

  return {
    unresolvedRepairs,
    repeatedSymptoms,
    recentParts,
  };
}

app.get('/', (req, res) => {
  res.send('Auto Fix Help API running');
});

app.get('/years', (req, res) => {
  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_YEAR = 1996;

  const years = Array.from(
    { length: CURRENT_YEAR - MIN_YEAR + 1 },
    (_, i) => String(CURRENT_YEAR - i)
  );

  res.json(years);
});

app.post('/auth/guest', async (req, res) => {
  try {
    const sessionToken = generateToken();

    await pool.query(
      `INSERT INTO auth_sessions (session_token, session_type, guest_label)
       VALUES ($1, 'guest', $2)`,
      [sessionToken, 'Guest']
    );

    res.status(201).json({
      mode: 'guest',
      sessionToken,
      user: null,
    });
  } catch (error) {
    console.error('Guest session creation error:', error.message);
    res.status(500).json({ error: 'Could not start guest mode' });
  }
});

app.post('/auth/signup', async (req, res) => {
  const { email, password, fullName, guestSessionToken } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const existing = await pool.query(
      `SELECT id FROM auth_users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = hashPassword(password);
    const userResult = await pool.query(
      `INSERT INTO auth_users (email, password_hash, full_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name`,
      [email.trim(), passwordHash, fullName || null]
    );

    const user = userResult.rows[0];
    const sessionToken = generateToken();

    await pool.query(
      `INSERT INTO auth_sessions (session_token, user_id, session_type)
       VALUES ($1, $2, 'user')`,
      [sessionToken, user.id]
    );

    await migrateGuestDataToUser(guestSessionToken, user.id);

    res.status(201).json({
      mode: 'authenticated',
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        plan: user.plan || 'free',
      },
    });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password, guestSessionToken } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, full_name, password_hash
       FROM auth_users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionToken = generateToken();

    await pool.query(
      `INSERT INTO auth_sessions (session_token, user_id, session_type)
       VALUES ($1, $2, 'user')`,
      [sessionToken, user.id]
    );

    await migrateGuestDataToUser(guestSessionToken, user.id);

    res.json({
      mode: 'authenticated',
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Could not log in' });
  }
});

app.get('/auth/session', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);

    if (!session) {
      return res.status(401).json({ error: 'No active session' });
    }

    res.json({
      mode: session.user_id ? 'authenticated' : 'guest',
      sessionToken: session.session_token,
      user: session.user_id
        ? {
            id: session.user_id,
            email: session.email,
            fullName: session.full_name,
          }
        : null,
    });
  } catch (error) {
    console.error('Session lookup error:', error.message);
    res.status(500).json({ error: 'Could not load session' });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);

    if (session) {
      await pool.query(`DELETE FROM auth_sessions WHERE id = $1`, [session.id]);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ error: 'Could not log out' });
  }
});

app.get('/years', (req, res) => {
  const source = req.query.source === 'fallback' ? 'fallback' : 'carapi';

  if (source === 'fallback') {
    return res.json(YEARS);
  }

  fetchCarApiYears()
    .then((years) => res.json(years))
    .catch((error) => {
      console.error('CarAPI years lookup error:', error.message);
      res.json(YEARS);
    });
});

app.get('/makes', async (req, res) => {
  const { year } = req.query;

  try {
    if (!year) {
      const carApiYearsMakes = await fetchCarApiMakesByYear(CURRENT_YEAR);
      return res.json(carApiYearsMakes.length > 0 ? carApiYearsMakes : sortStrings(PASSENGER_VEHICLE_MAKES));
    }

    let makes = [];

    try {
      makes = await fetchCarApiMakesByYear(year);
    } catch (carApiError) {
      console.error('CarAPI makes lookup error:', carApiError.message);
    }

    if (makes.length === 0) {
      makes = await getYearAwareMakes(year);
    }

    res.json(makes);
  } catch (error) {
    console.error('Makes lookup error:', error.message);
    res.status(500).json({ error: 'Failed to fetch filtered makes' });
  }
});

app.get('/models', async (req, res) => {
  const { year, make } = req.query;

  if (!year || !make) {
    return res.status(400).json({ error: 'year and make are required' });
  }

  try {
    let models = [];

    try {
      models = await fetchCarApiModelsByYearMake(year, make);
    } catch (carApiError) {
      console.error('CarAPI models lookup error:', carApiError.message);
    }

    if (models.length === 0) {
      models = await fetchModelsForMakeYear(make, year);
    }

    res.json(models);
  } catch (error) {
    console.error('Models lookup error:', error.message);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.get('/trims', async (req, res) => {
  const { year, make, model } = req.query;

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'year, make, and model are required' });
  }

  try {
    const trimRecords = await fetchCarApiTrimRecords(year, make, model);
    const trims = sortStrings(
      Array.from(
        new Set(
          trimRecords.map((record) => formatTrimRecord(record).label).filter(Boolean)
        )
      )
    );

    if (trims.length > 0) {
      return res.json(trims);
    }

    return res.json(resolveFitmentOptions(year, make, model).trims);
  } catch (error) {
    console.error('Trim lookup error:', error.message);
    res.json(resolveFitmentOptions(year, make, model).trims);
  }
});

app.get('/fitment-options', (req, res) => {
  const { year, make, model, trim } = req.query;

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'year, make, and model are required' });
  }

  fetchCarApiTrimRecords(year, make, model)
    .then(async (trimRecords) => {
      const formattedTrims = trimRecords.map((record) => formatTrimRecord(record));
      const selectedTrim = trim
        ? formattedTrims.find((record) => normalizeText(record.label) === normalizeText(trim))
        : null;

      let engineRecords = [];

      try {
        engineRecords = await fetchCarApiEngineRecords(
          year,
          make,
          model,
          selectedTrim?.trim || selectedTrim?.label || trim || ''
        );
      } catch (engineError) {
        console.error('CarAPI engine lookup error:', engineError.message);
      }

      const fitmentFromCarApi = buildVehicleOptionMatrixFromCarApi(formattedTrims, engineRecords);
      const fallbackFitment = resolveFitmentOptions(year, make, model, trim);
      const fitmentOptions = {
        trims: fitmentFromCarApi.trims.length > 0 ? fitmentFromCarApi.trims : fallbackFitment.trims,
        engines: fitmentFromCarApi.engines.length > 0 ? fitmentFromCarApi.engines : fallbackFitment.engines,
        drivetrains:
          fitmentFromCarApi.drivetrains.length > 0
            ? fitmentFromCarApi.drivetrains
            : fallbackFitment.drivetrains,
        transmissions: fitmentFromCarApi.transmissions,
      };

      if (
        fitmentOptions.trims.length > 0 ||
        fitmentOptions.engines.length > 0 ||
        fitmentOptions.drivetrains.length > 0 ||
        fitmentOptions.transmissions.length > 0
      ) {
        return res.json(fitmentOptions);
      }

      return res.json({
        ...fallbackFitment,
        transmissions: [],
      });
    })
    .catch((error) => {
      console.error('Fitment options lookup error:', error.message);
      res.json({
        ...resolveFitmentOptions(year, make, model, trim),
        transmissions: [],
      });
    });
});

app.get('/engine-drivetrain-options', async (req, res) => {
  const { year, make, model, trim } = req.query;

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'year, make, and model are required' });
  }

  try {
    const trimRecords = await fetchCarApiTrimRecords(year, make, model);
    const formattedTrims = trimRecords.map((record) => formatTrimRecord(record));
    const selectedTrim = trim
      ? formattedTrims.find((record) => normalizeText(record.label) === normalizeText(trim))
      : null;
    const engineRecords = await fetchCarApiEngineRecords(
      year,
      make,
      model,
      selectedTrim?.trim || selectedTrim?.label || trim || ''
    );

    const fitmentFromCarApi = buildVehicleOptionMatrixFromCarApi(formattedTrims, engineRecords);
    const fallbackFitment = resolveFitmentOptions(year, make, model, trim);

    res.json({
      trims: fitmentFromCarApi.trims.length > 0 ? fitmentFromCarApi.trims : fallbackFitment.trims,
      engines: fitmentFromCarApi.engines.length > 0 ? fitmentFromCarApi.engines : fallbackFitment.engines,
      drivetrains:
        fitmentFromCarApi.drivetrains.length > 0
          ? fitmentFromCarApi.drivetrains
          : fallbackFitment.drivetrains,
      transmissions: fitmentFromCarApi.transmissions,
    });
  } catch (error) {
    console.error('Engine and drivetrain options lookup error:', error.message);
    res.json({
      ...resolveFitmentOptions(year, make, model, trim),
      transmissions: [],
    });
  }
});

app.get('/vin/:vin', async (req, res) => {
  const vin = req.params.vin?.trim().toUpperCase();

  try {
    try {
      const carScanDecode = await carScanGet('/decode', { vin });
      const decoded = carScanDecode?.data || {};
      const carScanTrim = buildTrimPackageLabel(decoded.trim, null);

      if (decoded.make || decoded.model || decoded.engine || decoded.transmission || carScanTrim) {
        return res.json({
          vin,
          make: decoded.make || null,
          manufacturer: decoded.manufacturer || null,
          model: decoded.model || null,
          year: decoded.year ? String(decoded.year) : null,
          series: null,
          trim: carScanTrim,
          bodyClass: null,
          vehicleType: null,
          plantCity: null,
          plantState: null,
          plantCountry: null,
          drivetrain: null,
          transmission: decoded.transmission || null,
          engine: decoded.engine || null,
          zipCode: null,
        });
      }
    } catch (carScanError) {
      console.error('CarScan VIN decode error:', carScanError.message);
    }

    const response = await axios.get(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
    );

    const results = response.data.Results || [];

    const getValue = (name) => {
      const item = results.find((r) => r.Variable === name);
      return item && item.Value ? item.Value : null;
    };

    const series = getValue('Series');
    const trim = getValue('Trim');
    const engine = buildEngineLabelFromVpicValues({
      displacementL: getValue('Displacement (L)'),
      cylinders: getValue('Engine Number of Cylinders'),
      configuration: getValue('Engine Configuration'),
      fuelType: getValue('Fuel Type - Primary'),
    });
    const transmission = buildTransmissionLabelFromVpic(
      getValue('Transmission Style') || getValue('Transmission Speeds')
    );
    const engineOption = normalizeEngineOption(
      {
        label: engine,
        value: engine,
        fuelType: getValue('Fuel Type - Primary'),
      },
      {
        make: getValue('Make'),
        model: getValue('Model'),
        trim: buildTrimPackageLabel(series, trim),
      }
    );

    res.json({
      vin,
      make: getValue('Make'),
      manufacturer: getValue('Manufacturer Name'),
      model: getValue('Model'),
      year: getValue('Model Year'),
      series,
      trim: buildTrimPackageLabel(series, trim),
      bodyClass: getValue('Body Class'),
      vehicleType: getValue('Vehicle Type'),
      plantCity: getValue('Plant City'),
      plantState: getValue('Plant State'),
      plantCountry: getValue('Plant Country'),
      drivetrain: getValue('Drive Type'),
      transmission,
      engine,
      fuelType: engineOption.fuelType,
      fuelTypeConfidence: engineOption.confidence,
      zipCode: null,
    });
  } catch (error) {
    console.error('VIN lookup error:', error.message);
    res.status(500).json({ error: 'VIN lookup failed' });
  }
});

app.get('/vehicle-image', async (req, res) => {
  const { year, make, model, trim } = req.query;

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'year, make, and model are required' });
  }

  try {
    const image = await getVehicleImage(pool, axios, {
      year: String(year).trim(),
      make: String(make).trim(),
      model: String(model).trim(),
      trim: trim ? String(trim).trim() : '',
    });

    if (!image) {
      return res.json({
        success: true,
        image: null,
        fallbackUsed: true,
      });
    }

    res.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error('Vehicle image lookup error:', error.message);
    res.json({
      success: true,
      image: null,
      fallbackUsed: true,
    });
  }
});

app.post('/vehicles', async (req, res) => {
  const v = req.body;

  try {
    const session = await getSessionFromRequest(req);

    if (!session) {
      return res.status(401).json({ error: 'A guest or user session is required' });
    }

    const ownerUserId = session.user_id || null;
    const ownerGuestSessionToken = session.user_id ? null : session.session_token;

    if (v.vin) {
      const ownerParts = buildOwnerQueryParts(session, 2);
      const existing = await pool.query(
        `SELECT * FROM vehicles WHERE vin = $1 AND ${ownerParts.clause} LIMIT 1`,
        [v.vin, ...ownerParts.params]
      );

      if (existing.rows.length > 0) {
        const updated = await pool.query(
          `UPDATE vehicles
           SET make = COALESCE($2, make),
               manufacturer = COALESCE($3, manufacturer),
               model = COALESCE($4, model),
               year = COALESCE($5, year),
               series = COALESCE($6, series),
               trim = COALESCE($7, trim),
               body_class = COALESCE($8, body_class),
               vehicle_type = COALESCE($9, vehicle_type),
               plant_city = COALESCE($10, plant_city),
               plant_state = COALESCE($11, plant_state),
               plant_country = COALESCE($12, plant_country),
               drivetrain = COALESCE($13, drivetrain),
               transmission = COALESCE($14, transmission),
               engine = COALESCE($15, engine),
               fuel_type = COALESCE($16, fuel_type),
               fuel_type_confidence = COALESCE($17, fuel_type_confidence),
               zip_code = COALESCE($18, zip_code),
               purchase_price = COALESCE($19, purchase_price),
               current_kbb_value = COALESCE($20, current_kbb_value)
          WHERE id = $21
           RETURNING *`,
          [
            v.vin,
            v.make || null,
            v.manufacturer || null,
            v.model || null,
            v.year || null,
            v.series || null,
            v.trim || null,
            v.bodyClass || null,
            v.vehicleType || null,
            v.plantCity || null,
            v.plantState || null,
            v.plantCountry || null,
            v.drivetrain || null,
            v.transmission || null,
            v.engine || null,
            v.fuelType || v.fuel_type ? normalizeFuelType(v.fuelType || v.fuel_type) : null,
            v.fuelTypeConfidence || v.fuel_type_confidence || null,
            v.zipCode || null,
            v.purchasePrice ?? null,
            v.currentKbbValue ?? null,
            existing.rows[0].id,
          ]
        );

        return res.json(updated.rows[0]);
      }
    }

    const result = await pool.query(
      `INSERT INTO vehicles
      (vin, owner_user_id, owner_guest_session_token, make, manufacturer, model, year, series, trim, body_class, vehicle_type, plant_city, plant_state, plant_country, drivetrain, transmission, engine, fuel_type, fuel_type_confidence, zip_code, purchase_price, current_kbb_value)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [
        v.vin || null,
        ownerUserId,
        ownerGuestSessionToken,
        v.make || null,
        v.manufacturer || null,
        v.model || null,
        v.year || null,
        v.series || null,
        v.trim || null,
        v.bodyClass || null,
        v.vehicleType || null,
        v.plantCity || null,
        v.plantState || null,
        v.plantCountry || null,
        v.drivetrain || null,
        v.transmission || null,
        v.engine || null,
        v.fuelType || v.fuel_type ? normalizeFuelType(v.fuelType || v.fuel_type) : null,
        v.fuelTypeConfidence || v.fuel_type_confidence || null,
        v.zipCode || null,
        parseMoney(v.purchasePrice),
        parseMoney(v.currentKbbValue),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database insert error:', error.message);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

app.get('/vehicles', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);

    if (!session) {
      return res.json([]);
    }

    const ownerParts = buildOwnerQueryParts(session, 1);
    const result = await pool.query(
      `SELECT * FROM vehicles WHERE ${ownerParts.clause} ORDER BY created_at DESC`,
      ownerParts.params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Database fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.patch('/vehicles/:vehicleId/financials', async (req, res) => {
  const { vehicleId } = req.params;
  const { purchasePrice, currentKbbValue } = req.body || {};

  try {
    const session = await getSessionFromRequest(req);
    const existingVehicle = await getVehicleForSession(vehicleId, session);

    if (!existingVehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const result = await pool.query(
      `UPDATE vehicles
       SET purchase_price = COALESCE($2, purchase_price),
           current_kbb_value = COALESCE($3, current_kbb_value)
       WHERE id = $1
       RETURNING *`,
      [vehicleId, purchasePrice === '' ? null : parseMoney(purchasePrice), currentKbbValue === '' ? null : parseMoney(currentKbbValue)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Vehicle financial update error:', error.message);
    res.status(500).json({ error: 'Failed to update vehicle financials' });
  }
});

app.get('/recalls/:make/:model/:year', async (req, res) => {
  const { make, model, year } = req.params;

  try {
    const response = await axios.get(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(
        make
      )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`
    );

    const recalls = (response.data.results || []).map((item, index) => {
      const campaignNumber = item.NHTSACampaignNumber || `NHTSA-${index}`;

      return {
        id: campaignNumber,
        campaignNumber,
        component: item.Component || 'N/A',
        summary: item.Summary || 'No summary available',
        remedy: item.Remedy || 'N/A',
        sourceName: 'NHTSA Recalls',
        sourceUrl: buildRecallSourceUrl(campaignNumber),
      };
    });

    res.json(recalls);
  } catch (error) {
    console.error('Recall lookup error:', error.message);
    res.status(500).json({ error: 'Recall lookup failed' });
  }
});

app.get('/tsbs/:make/:model/:year', async (req, res) => {
  const { make, model, year } = req.params;
  res.json(buildTsbResources(year, make, model));
});

app.get('/common-issues/:make/:model/:year', async (req, res) => {
  const { make, model, year } = req.params;

  try {
    const response = await axios.get(
      `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(
        make
      )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`
    );

    const complaints = response.data.results || response.data.Results || [];

    if (!Array.isArray(complaints) || complaints.length === 0) {
      return res.json([]);
    }

    const grouped = complaints.reduce((acc, complaint) => {
      const component =
        getField(complaint, ['components', 'Components', 'Component', 'component']) ||
        'General complaints';
      const odiNumber = getField(complaint, [
        'odiNumber',
        'ODINumber',
        'odi_number',
        'ODI_NUMBER',
      ]);
      const summary =
        getField(complaint, ['summary', 'Summary', 'description', 'Description']) ||
        'No complaint summary available.';

      if (!acc[component]) {
        acc[component] = {
          component,
          count: 0,
          summaries: [],
          sourceLinks: [],
        };
      }

      acc[component].count += 1;

      if (acc[component].summaries.length < 2) {
        acc[component].summaries.push(summary);
      }

      if (odiNumber && acc[component].sourceLinks.length < 3) {
        acc[component].sourceLinks.push({
          label: `ODI ${odiNumber}`,
          url: buildComplaintSourceUrl(odiNumber),
        });
      }

      return acc;
    }, {});

    const issues = Object.values(grouped)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((issue, index) => ({
        id: `${issue.component}-${index}`,
        title: issue.component,
        complaintCount: issue.count,
        summary: issue.summaries[0],
        supportingDetail: issue.summaries[1] || null,
        sourceName: 'NHTSA Complaints API',
        sourceUrl: SOURCE_URLS.complaintsApiDocs,
        sourceLinks: issue.sourceLinks,
      }));

    res.json(issues);
  } catch (error) {
    console.error('Complaint lookup error:', error.message);
    res.status(500).json({ error: 'Common issues lookup failed' });
  }
});

async function handleDiagnosticLookup(req, res) {
  const normalizedCode = String(req.params.code || '').trim().toUpperCase();
  const vehicle = {
    vin: req.query.vin || '',
    year: req.query.year || '',
    make: req.query.make || '',
    model: req.query.model || '',
    trim: req.query.trim || '',
    drivetrain: req.query.drivetrain || '',
    transmission: req.query.transmission || '',
    engine: req.query.engine || '',
  };
  const vehicleId = req.query.vehicleId || req.query.vehicle_id || '';

  if (!normalizedCode) {
    return res.status(400).json({ error: 'A diagnostic code is required' });
  }

  let resolvedMileage = parseInteger(req.query.mileage);

  if (!resolvedMileage && vehicleId) {
    try {
      const historyEntries = await getRepairHistoryByVehicle(vehicleId);
      resolvedMileage = getLatestMileageFromHistoryEntries(historyEntries);
    } catch (historyError) {
      console.error('Mileage lookup from history failed:', historyError.message);
    }
  }

  try {
    let codePayload = null;
    let diagPayload = null;
    let repairPayload = [];

    if (vehicle.vin || vehicle.make) {
      try {
        const codeResponse = await carScanGet(
          '/code',
          vehicle.vin
            ? { vin: vehicle.vin, codes: normalizedCode }
            : { make: vehicle.make, codes: normalizedCode }
        );
        codePayload = normalizeCarScanCodeResponse(codeResponse, normalizedCode);
      } catch (codeError) {
        console.error('CarScan code lookup error:', codeError.message);
      }
    }

    if (vehicle.vin && resolvedMileage) {
      try {
        const [diagResponse, repairResponse] = await Promise.all([
          carScanGet(
            '/diag',
            { vin: vehicle.vin, mileage: resolvedMileage, dtc: normalizedCode.toLowerCase() },
            false
          ),
          carScanGet(
            '/repair',
            { vin: vehicle.vin, mileage: resolvedMileage, dtc: normalizedCode.toLowerCase() },
            false
          ),
        ]);

        diagPayload = normalizeCarScanDiagResponse(diagResponse);
        repairPayload = normalizeCarScanRepairResponse(repairResponse);
      } catch (deepError) {
        console.error('CarScan diag or repair lookup error:', deepError.message);
      }
    }

    const fallback = buildFallbackDiagnosticPayload(
      normalizedCode,
      vehicle,
      codePayload?.definition || diagPayload?.tech_definition || diagPayload?.layman_definition || ''
    );

    const severity =
      diagPayload?.urgency !== undefined
        ? mapUrgencyToSeverity(diagPayload.urgency, fallback.definition)
        : fallback.severity;

    const possibleFixes =
      repairPayload.length > 0
        ? repairPayload.map((item) => item.desc).filter(Boolean)
        : fallback.possible_fixes;

    const primaryRepair = repairPayload[0] || null;
    const estimatedCost = normalizeCostValue(primaryRepair?.repair?.total_cost);
    const difficulty = parseInteger(primaryRepair?.repair?.difficulty);

    return res.json({
      code: normalizedCode,
      definition:
        codePayload?.definition ||
        diagPayload?.tech_definition ||
        diagPayload?.layman_definition ||
        fallback.definition,
      description:
        diagPayload?.layman_definition ||
        diagPayload?.effect_on_vehicle ||
        fallback.description,
      manufacturer_specific_meaning: fallback.manufacturer_specific_meaning,
      severity,
      severity_color: getSeverityColorLabel(severity),
      possible_fixes: Array.from(new Set(possibleFixes)),
      repair_options:
        repairPayload.length > 0
          ? repairPayload.map((item) => ({
              title: item.desc || 'Suggested repair',
              urgency: item.urgency ?? null,
              urgency_desc: item.urgency_desc || null,
              difficulty: parseInteger(item?.repair?.difficulty),
              difficulty_label: getDifficultyLabel(item?.repair?.difficulty),
              estimated_hours: normalizeCostValue(item?.repair?.hours),
              estimated_cost: normalizeCostValue(item?.repair?.total_cost),
              tsb_count: Array.isArray(item.tsb) ? item.tsb.length : 0,
            }))
          : fallback.repair_options,
      difficulty,
      difficulty_label: getDifficultyLabel(difficulty),
      estimated_cost: estimatedCost,
      notes: Array.from(
        new Set(
          [
            diagPayload?.urgency_desc || null,
            diagPayload?.effect_on_vehicle || null,
            diagPayload?.responsible_system || null,
            fallback.notes?.[0] || null,
            'These are possible causes and not guaranteed fixes.',
          ].filter(Boolean)
        )
      ),
      disclaimer: 'These are possible causes and not guaranteed fixes',
      source_name:
        codePayload || diagPayload || repairPayload.length > 0
          ? 'CarScan Diagnostic API'
          : fallback.source_name,
      source_url: 'https://dev-api.carscan.com/member/docs',
      genericMeaning: fallback.description,
      manufacturerSpecificMeaning: fallback.manufacturer_specific_meaning,
      severityColor: getSeverityColorLabel(severity),
      possibleFixes: Array.from(new Set(possibleFixes)),
      repairOptions:
        repairPayload.length > 0
          ? repairPayload.map((item) => ({
              title: item.desc || 'Suggested repair',
              urgencyDesc: item.urgency_desc || null,
              difficulty: parseInteger(item?.repair?.difficulty),
              difficultyLabel: getDifficultyLabel(item?.repair?.difficulty),
              estimatedCost: normalizeCostValue(item?.repair?.total_cost),
            }))
          : fallback.repair_options.map((item) => ({
              title: item.title,
              urgencyDesc: item.urgency_desc,
              difficulty: item.difficulty,
              difficultyLabel: item.difficulty_label,
              estimatedCost: item.total_cost,
            })),
      difficultyLabel: getDifficultyLabel(difficulty),
      estimatedCost,
      vehicleContextNote: buildVehicleSpecificObdNotes(normalizedCode, vehicle),
      sourceName:
        codePayload || diagPayload || repairPayload.length > 0
          ? 'CarScan Diagnostic API'
          : fallback.source_name,
      sourceUrl: 'https://dev-api.carscan.com/member/docs',
    });
  } catch (error) {
    console.error('Diagnostic lookup error:', error.message);
    return res.json(buildFallbackDiagnosticPayload(normalizedCode, vehicle));
  }
}

app.get('/diagnostic/:code', handleDiagnosticLookup);
app.get('/diagnostic-codes/:code', handleDiagnosticLookup);

app.get('/electrical-schematics/:make/:model/:year', (req, res) => {
  const { make, model, year } = req.params;
  const discipline = req.query.discipline || SCHEMATIC_DISCIPLINES[0];

  res.json({
    disciplines: SCHEMATIC_DISCIPLINES,
    selectedDiscipline: discipline,
    resources: buildSchematicResources(year, make, model, discipline),
    note:
      'Full wiring diagrams usually come from OEM or licensed service-information providers rather than a free public API.',
  });
});

app.get('/parts/:make/:model/:year', (req, res) => {
  const { make, model, year } = req.params;
  const { engine, drivetrain } = req.query;

  res.json({
    note:
      'Parts pricing here is a practical quick-compare guide with search links scoped to the selected vehicle. For real-time catalog pricing and exact fitment confirmation, a commercial fitment and pricing API would be needed.',
    parts: buildPartsData(make, model, year, {
      engine: typeof engine === 'string' ? engine : '',
      drivetrain: typeof drivetrain === 'string' ? drivetrain : '',
    }),
  });
});

app.post('/account/upgrade', async (req, res) => {
  const { plan } = req.body;
  if (!['free', 'pro'].includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user_id) return res.status(401).json({ error: 'Must be logged in' });
    await pool.query('UPDATE auth_users SET plan = $1 WHERE id = $2', [plan, session.user_id]);
    res.json({ success: true, plan });
  } catch (e) { res.status(500).json({ error: 'Could not update plan' }); }
});

app.get('/shops', async (req, res) => {
  const { make, issue, zip } = req.query;

  if (!zip) {
    return res.status(400).json({ error: 'zip is required' });
  }

  try {
    const shops = await findShopsNearZip(String(zip).trim(), {
      make: typeof make === 'string' ? make : '',
      issue: typeof issue === 'string' ? issue : '',
    });

    if (shops.length > 0) {
      return res.json(shops);
    }

    return res.json([
      {
        id: `fallback-${zip}-1`,
        name: 'General Auto Repair Near Your ZIP',
        rating: null,
        distance: 'Nearby',
        specialty: 'General auto repair',
        matchReason: 'No specialty match was found, showing nearby general repair options instead',
        zipCode: zip,
        sourceName: 'ZIP fallback result',
        sourceUrl: null,
      },
    ]);
  } catch (error) {
    console.error('Shop lookup error:', error.message);
    res.status(500).json({ error: 'Local shop lookup failed' });
  }
});

app.get('/vehicles/:vehicleId/repair-history', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);
    const vehicle = await getVehicleForSession(req.params.vehicleId, session);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const rows = await getRepairHistoryByVehicle(vehicle.id);
    res.json(rows);
  } catch (error) {
    console.error('Repair history fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch repair history' });
  }
});

app.post('/vehicles/:vehicleId/repair-history', async (req, res) => {
  const { vehicleId } = req.params;
  const entry = req.body;
  const partsCost = parseMoney(entry.partsCost);
  const laborCost = parseMoney(entry.laborCost);
  const totalCost = entry.totalCost !== undefined ? parseMoney(entry.totalCost) : partsCost + laborCost;

  // Sanitize date — store null if invalid
  const parseDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : val;
  };

  try {
    const session = await getSessionFromRequest(req);
    const vehicle = await getVehicleForSession(vehicleId, session);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const result = await pool.query(
      `INSERT INTO repair_history_entries
      (vehicle_id, entry_type, service_date, mileage, problem_symptom, suspected_cause, repair_performed, parts_used, labor_notes, parts_cost, labor_cost, total_cost, fixed_issue, follow_up_repair, actual_fix_later, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        vehicle.id,
        entry.entryType || 'repair',
        parseDate(entry.serviceDate),
        parseInteger(entry.mileage),
        entry.problemSymptom || null,
        entry.suspectedCause || null,
        entry.repairPerformed || null,
        entry.partsUsed || null,
        entry.laborNotes || null,
        partsCost,
        laborCost,
        totalCost,
        parseBooleanOrNull(entry.fixedIssue),
        entry.followUpRepair || null,
        entry.actualFixLater || null,
        entry.notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Repair history insert error:', error.message);
    res.status(500).json({ error: 'Failed to save repair history entry' });
  }
});

app.put('/repair-history/:id', async (req, res) => {
  const { id } = req.params;
  const entry = req.body;
  const partsCost = parseMoney(entry.partsCost);
  const laborCost = parseMoney(entry.laborCost);
  const totalCost = entry.totalCost !== undefined ? parseMoney(entry.totalCost) : partsCost + laborCost;

  try {
    const session = await getSessionFromRequest(req);
    const existingEntry = await getRepairHistoryEntryForSession(id, session);

    if (!existingEntry) {
      return res.status(404).json({ error: 'Repair history entry not found' });
    }

    const result = await pool.query(
      `UPDATE repair_history_entries
       SET entry_type = $2,
           service_date = $3,
           mileage = $4,
           problem_symptom = $5,
           suspected_cause = $6,
           repair_performed = $7,
           parts_used = $8,
           labor_notes = $9,
           parts_cost = $10,
           labor_cost = $11,
           total_cost = $12,
           fixed_issue = $13,
           follow_up_repair = $14,
           actual_fix_later = $15,
           notes = $16,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        entry.entryType || 'repair',
        entry.serviceDate || null,
        parseInteger(entry.mileage),
        entry.problemSymptom || null,
        entry.suspectedCause || null,
        entry.repairPerformed || null,
        entry.partsUsed || null,
        entry.laborNotes || null,
        partsCost,
        laborCost,
        totalCost,
        parseBooleanOrNull(entry.fixedIssue),
        entry.followUpRepair || null,
        entry.actualFixLater || null,
        entry.notes || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repair history entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Repair history update error:', error.message);
    res.status(500).json({ error: 'Failed to update repair history entry' });
  }
});

app.delete('/repair-history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const ownerParts = buildOwnerQueryParts(session, 2);
    const result = await pool.query(
      'DELETE FROM repair_history_entries WHERE id = $1 AND vehicle_id IN (SELECT id FROM vehicles WHERE ' + ownerParts.clause + ') RETURNING id',
      [id, ...ownerParts.params]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete repair error:', error.message);
    res.status(500).json({ error: 'Could not delete entry' });
  }
});

app.patch('/repair-history/:id/outcome', async (req, res) => {
  const { id } = req.params;
  const { fixedIssue, actualFixLater, followUpRepair } = req.body;

  try {
    const session = await getSessionFromRequest(req);
    const existingEntry = await getRepairHistoryEntryForSession(id, session);

    if (!existingEntry) {
      return res.status(404).json({ error: 'Repair history entry not found' });
    }

    const result = await pool.query(
      `UPDATE repair_history_entries
       SET fixed_issue = COALESCE($2, fixed_issue),
           actual_fix_later = COALESCE($3, actual_fix_later),
           follow_up_repair = COALESCE($4, follow_up_repair),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        parseBooleanOrNull(fixedIssue),
        actualFixLater || null,
        followUpRepair || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Repair history entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Repair outcome update error:', error.message);
    res.status(500).json({ error: 'Failed to update repair outcome' });
  }
});

app.get('/vehicles/:vehicleId/todos', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);
    const vehicle = await getVehicleForSession(req.params.vehicleId, session);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const rows = await getTodoItemsByVehicle(vehicle.id);
    res.json(rows);
  } catch (error) {
    console.error('To do fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch to do list' });
  }
});

app.post('/vehicles/:vehicleId/todos', async (req, res) => {
  const { vehicleId } = req.params;
  const item = req.body;

  try {
    const session = await getSessionFromRequest(req);
    const vehicle = await getVehicleForSession(vehicleId, session);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const result = await pool.query(
      `INSERT INTO vehicle_todo_items
      (vehicle_id, item_type, title, description, priority, due_date, target_mileage, estimated_cost, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        vehicle.id,
        item.itemType || 'maintenance',
        item.title,
        item.description || null,
        item.priority || 'medium',
        item.dueDate || null,
        parseInteger(item.targetMileage),
        parseMoney(item.estimatedCost),
        item.status || 'open',
        item.notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('To do insert error:', error.message);
    res.status(500).json({ error: 'Failed to save to do item' });
  }
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const item = req.body;

  try {
    const session = await getSessionFromRequest(req);
    const existingItem = await getTodoItemForSession(id, session);

    if (!existingItem) {
      return res.status(404).json({ error: 'To do item not found' });
    }

    const result = await pool.query(
      `UPDATE vehicle_todo_items
       SET item_type = $2,
           title = $3,
           description = $4,
           priority = $5,
           due_date = $6,
           target_mileage = $7,
           estimated_cost = $8,
           status = $9,
           notes = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        item.itemType || 'maintenance',
        item.title,
        item.description || null,
        item.priority || 'medium',
        item.dueDate || null,
        parseInteger(item.targetMileage),
        parseMoney(item.estimatedCost),
        item.status || 'open',
        item.notes || null,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'To do item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('To do update error:', error.message);
    res.status(500).json({ error: 'Failed to update to do item' });
  }
});

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const ownerParts = buildOwnerQueryParts(session, 2);
    const result = await pool.query(
      'DELETE FROM vehicle_todos WHERE id = $1 AND vehicle_id IN (SELECT id FROM vehicles WHERE ' + ownerParts.clause + ') RETURNING id',
      [id, ...ownerParts.params]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete todo error:', error.message);
    res.status(500).json({ error: 'Could not delete item' });
  }
});

app.patch('/todos/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const session = await getSessionFromRequest(req);
    const existingItem = await getTodoItemForSession(id, session);

    if (!existingItem) {
      return res.status(404).json({ error: 'To do item not found' });
    }

    const result = await pool.query(
      `UPDATE vehicle_todo_items
       SET status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, status || 'completed']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'To do item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('To do status update error:', error.message);
    res.status(500).json({ error: 'Failed to update to do status' });
  }
});

app.get('/vehicles/:vehicleId/cost-summary', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);
    const vehicle = await getVehicleForSession(req.params.vehicleId, session);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const historyEntries = await getRepairHistoryByVehicle(vehicle.id);
    const todoItems = await getTodoItemsByVehicle(vehicle.id);
    res.json(buildCostSummary(vehicle, historyEntries, todoItems));
  } catch (error) {
    console.error('Cost summary fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

app.get('/vehicles/:vehicleId/diagnostic-context', async (req, res) => {
  try {
    const session = await getSessionFromRequest(req);
    const vehicle = await getVehicleForSession(req.params.vehicleId, session);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const historyEntries = await getRepairHistoryByVehicle(vehicle.id);
    res.json(buildDiagnosticContext(historyEntries));
  } catch (error) {
    console.error('Diagnostic context fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch diagnostic context' });
  }
});

function toNullableInt(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapDiagnosticSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    vehicleId: row.vehicle_id,
    flowId: row.flow_id,
    symptomText: row.symptom_text,
    codes: row.codes || [],
    selectedVehicleYear: row.selected_vehicle_year,
    selectedVehicleMake: row.selected_vehicle_make,
    selectedVehicleModel: row.selected_vehicle_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDiagnosticSession(sessionId, authSession = null) {
  const result = await pool.query('SELECT * FROM diagnostic_sessions WHERE id = $1', [sessionId]);
  const diagnosticSession = result.rows[0] || null;

  if (!diagnosticSession) {
    return null;
  }

  if (authSession?.user_id && diagnosticSession.user_id && diagnosticSession.user_id !== authSession.user_id) {
    return null;
  }

  return diagnosticSession;
}

async function getConfirmedFixesForLearning(vehicle = {}, flowId = null) {
  const year = vehicle.year || vehicle.selectedVehicleYear || null;
  const make = vehicle.make || vehicle.selectedVehicleMake || null;
  const model = vehicle.model || vehicle.selectedVehicleModel || null;

  const result = await pool.query(
    `SELECT *
     FROM confirmed_fixes
     WHERE ($1::text IS NULL OR LOWER(make) = LOWER($1))
       AND ($2::text IS NULL OR LOWER(model) = LOWER($2))
       AND ($3::text IS NULL OR year = $3)
       AND ($4::text IS NULL OR flow_id = $4)
     ORDER BY created_at DESC
     LIMIT 50`,
    [make, model, year, flowId]
  );

  return result.rows;
}

app.post('/diagnostic-sessions', async (req, res) => {
  try {
    const authSession = await getSessionFromRequest(req);
    const body = req.body || {};
    const vehicle = body.vehicle || {};
    const vehicleId = toNullableInt(body.vehicleId || vehicle.id);

    const result = await pool.query(
      `INSERT INTO diagnostic_sessions
       (user_id, vehicle_id, flow_id, symptom_text, codes, selected_vehicle_year, selected_vehicle_make, selected_vehicle_model)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
       RETURNING *`,
      [
        authSession?.user_id || null,
        vehicleId,
        body.flowId || body.flow?.id || null,
        body.symptomText || body.symptoms || '',
        JSON.stringify(toJsonArray(body.codes)),
        vehicle.year || body.selectedVehicleYear || null,
        vehicle.make || body.selectedVehicleMake || null,
        vehicle.model || body.selectedVehicleModel || null,
      ]
    );

    res.status(201).json(mapDiagnosticSession(result.rows[0]));
  } catch (error) {
    console.error('Diagnostic session create error:', error.message);
    res.status(500).json({ error: 'Failed to create diagnostic session' });
  }
});

app.get('/diagnostic-sessions/:id', async (req, res) => {
  try {
    const authSession = await getSessionFromRequest(req);
    const diagnosticSession = await getDiagnosticSession(req.params.id, authSession);

    if (!diagnosticSession) {
      return res.status(404).json({ error: 'Diagnostic session not found' });
    }

    const [answers, suggestions, confirmedFixes] = await Promise.all([
      pool.query('SELECT * FROM diagnostic_answers WHERE session_id = $1 ORDER BY id ASC', [req.params.id]),
      pool.query('SELECT * FROM diagnostic_suggestions WHERE session_id = $1 ORDER BY score DESC, id ASC', [req.params.id]),
      pool.query('SELECT * FROM confirmed_fixes WHERE session_id = $1 ORDER BY created_at DESC', [req.params.id]),
    ]);

    res.json({
      ...mapDiagnosticSession(diagnosticSession),
      answers: answers.rows,
      suggestions: suggestions.rows,
      confirmedFixes: confirmedFixes.rows,
    });
  } catch (error) {
    console.error('Diagnostic session fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch diagnostic session' });
  }
});

app.post('/diagnostic-sessions/:id/answers', async (req, res) => {
  try {
    const authSession = await getSessionFromRequest(req);
    const diagnosticSession = await getDiagnosticSession(req.params.id, authSession);

    if (!diagnosticSession) {
      return res.status(404).json({ error: 'Diagnostic session not found' });
    }

    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [req.body || {}];
    const inserted = [];

    for (const answer of answers) {
      const result = await pool.query(
        `INSERT INTO diagnostic_answers (session_id, step_id, question, answer)
         VALUES ($1,$2,$3,$4)
         RETURNING *`,
        [req.params.id, answer.stepId || answer.step_id || null, answer.question || '', answer.answer || '']
      );
      inserted.push(result.rows[0]);
    }

    await pool.query('UPDATE diagnostic_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    res.status(201).json(inserted);
  } catch (error) {
    console.error('Diagnostic answer save error:', error.message);
    res.status(500).json({ error: 'Failed to save diagnostic answers' });
  }
});

app.get('/diagnostic-sessions/:id/suggestions', async (req, res) => {
  try {
    const authSession = await getSessionFromRequest(req);
    const diagnosticSession = await getDiagnosticSession(req.params.id, authSession);

    if (!diagnosticSession) {
      return res.status(404).json({ error: 'Diagnostic session not found' });
    }

    const result = await pool.query(
      'SELECT * FROM diagnostic_suggestions WHERE session_id = $1 ORDER BY score DESC, id ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Diagnostic suggestions fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch diagnostic suggestions' });
  }
});

app.post('/diagnostic-sessions/:id/confirmed-fix', async (req, res) => {
  try {
    const authSession = await getSessionFromRequest(req);
    const diagnosticSession = await getDiagnosticSession(req.params.id, authSession);

    if (!diagnosticSession) {
      return res.status(404).json({ error: 'Diagnostic session not found' });
    }

    const body = req.body || {};
    const result = await pool.query(
      `INSERT INTO confirmed_fixes
       (user_id, vehicle_id, session_id, year, make, model, flow_id, symptom_text, codes, confirmed_fix, part_replaced, did_fix_problem, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
       RETURNING *`,
      [
        authSession?.user_id || diagnosticSession.user_id || null,
        diagnosticSession.vehicle_id,
        diagnosticSession.id,
        body.year || diagnosticSession.selected_vehicle_year,
        body.make || diagnosticSession.selected_vehicle_make,
        body.model || diagnosticSession.selected_vehicle_model,
        body.flowId || diagnosticSession.flow_id,
        body.symptomText || diagnosticSession.symptom_text,
        JSON.stringify(toJsonArray(body.codes || diagnosticSession.codes)),
        body.confirmedFix || body.confirmed_fix || '',
        body.partReplaced || body.part_replaced || '',
        body.didFixProblem || body.did_fix_problem || '',
        body.notes || '',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Confirmed fix save error:', error.message);
    res.status(500).json({ error: 'Failed to save confirmed fix' });
  }
});

app.get('/learning/common-fixes/:make/:model/:year', async (req, res) => {
  try {
    const { make, model, year } = req.params;
    const result = await pool.query(
      `SELECT confirmed_fix, part_replaced, did_fix_problem, notes, flow_id, COUNT(*)::int AS fix_count, MAX(created_at) AS last_seen_at
       FROM confirmed_fixes
       WHERE LOWER(make) = LOWER($1)
         AND LOWER(model) = LOWER($2)
         AND year = $3
       GROUP BY confirmed_fix, part_replaced, did_fix_problem, notes, flow_id
       ORDER BY fix_count DESC, last_seen_at DESC
       LIMIT 20`,
      [make, model, year]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Common fixes fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch common fixes' });
  }
});

app.post('/learning/recommend', async (req, res) => {
  try {
    const authSession = await getSessionFromRequest(req);
    const body = req.body || {};
    const vehicle = body.vehicle || {};
    const flow = body.flow || { id: body.flowId };
    const vehicleId = toNullableInt(body.vehicleId || vehicle.id);
    const repairHistory =
      Array.isArray(body.repairHistory) && body.repairHistory.length > 0
        ? body.repairHistory
        : vehicleId
          ? await getRepairHistoryByVehicle(vehicleId)
          : [];
    const confirmedFixes = [
      ...(Array.isArray(body.confirmedFixes) ? body.confirmedFixes : []),
      ...(await getConfirmedFixesForLearning(vehicle, flow.id || body.flowId || null)),
    ];

    let diagnosticSessionId = toNullableInt(body.sessionId);

    if (!diagnosticSessionId) {
      const created = await pool.query(
        `INSERT INTO diagnostic_sessions
         (user_id, vehicle_id, flow_id, symptom_text, codes, selected_vehicle_year, selected_vehicle_make, selected_vehicle_model)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
         RETURNING *`,
        [
          authSession?.user_id || null,
          vehicleId,
          flow.id || body.flowId || null,
          body.symptoms || body.symptomText || '',
          JSON.stringify(toJsonArray(body.codes)),
          vehicle.year || null,
          vehicle.make || null,
          vehicle.model || null,
        ]
      );
      diagnosticSessionId = created.rows[0].id;
    }

    if (diagnosticSessionId && Array.isArray(body.answers)) {
      await pool.query('DELETE FROM diagnostic_answers WHERE session_id = $1', [diagnosticSessionId]);
      for (const answer of body.answers) {
        await pool.query(
          `INSERT INTO diagnostic_answers (session_id, step_id, question, answer)
           VALUES ($1,$2,$3,$4)`,
          [diagnosticSessionId, answer.stepId || answer.step_id || null, answer.question || '', answer.answer || '']
        );
      }
    }

    const suggestions = scoreDiagnosticSuggestions({
      vehicle,
      flow,
      symptoms: body.symptoms || body.symptomText || '',
      codes: toJsonArray(body.codes),
      answers: body.answers || [],
      commonIssues: body.commonIssues || [],
      repairHistory,
      confirmedFixes,
    }).slice(0, 8);

    if (diagnosticSessionId) {
      await pool.query('DELETE FROM diagnostic_suggestions WHERE session_id = $1', [diagnosticSessionId]);
      for (const suggestion of suggestions) {
        await pool.query(
          `INSERT INTO diagnostic_suggestions
           (session_id, cause, score, reason, related_issue_id, related_flow_id)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            diagnosticSessionId,
            suggestion.cause,
            suggestion.score,
            suggestion.reason,
            suggestion.relatedIssueId || null,
            suggestion.suggestedFlowId || null,
          ]
        );
      }
    }

    res.json({
      sessionId: diagnosticSessionId,
      disclaimer:
        'VinFix Smart Diagnosis is a recommendation based on symptoms, vehicle history, and common failures. Confirm with testing before replacing parts.',
      suggestions,
    });
  } catch (error) {
    console.error('Learning recommendation error:', error.message);
    res.status(500).json({ error: 'Failed to build diagnostic recommendations' });
  }
});

async function startServer() {
  try {
    pool = await initDatabase();
    await initializeDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      const mode = useLocalDatabase() ? 'local embedded Postgres' : 'remote Postgres';
      console.log(`Server running on port ${PORT} (${mode})`);
    });
  } catch (error) {
    console.error('Server startup error:', error?.message || error || 'Unknown startup error');
    process.exit(1);
  }
}

startServer();
