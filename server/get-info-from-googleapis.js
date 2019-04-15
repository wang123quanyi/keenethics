const { google } = require('googleapis');
const { spreadSheet } = require('./config');
const _ = require('lodash');

const TEAM_SHEET_ID = spreadSheet.id;
const CREDS_FILE = spreadSheet.securityFile;
const googleScopes = ['https://www.googleapis.com/auth/drive.readonly'];
const TEAM_RANGE = spreadSheet.teamRange;
const CAREERS_RANGE = spreadSheet.careersRange;

const ranges = [TEAM_RANGE, CAREERS_RANGE];

const TEN_MINUTES = 10 * 60 * 1000;
const TITLE_COLUMN_INDEX = 0;

const arrayOfArraysToCollection = (arr) => {
  const properties = arr[TITLE_COLUMN_INDEX];
  return arr.slice(TITLE_COLUMN_INDEX + 1)
    .map(v => _.fromPairs(properties.map((property, index) => ([property, v[index]]))));
};

const getSheetValues = (valueRanges, rangeName) =>
  valueRanges.find(v => new RegExp(rangeName).test(v.range)).values;

const getClient = async (keyFile, scopes) => google.auth.getClient({
  keyFile,
  scopes,
});

class CustomMap extends Map {
  get(key) {
    if (!this.has(key)) {
      return;
    }

    const result = super.get(key);

    if ((Date.now() - result._date.now()) >= TEN_MINUTES) {
      super.delete(key);
    }

    return result;
  }
}

_.memoize.Cache = CustomMap;

const getSheets = _.memoize(async (spreadsheetId) => { // TEAM_SHEET_ID
  try {
    const client = await getClient(CREDS_FILE, googleScopes);

    const sheets = google.sheets('v4');

    const table = await sheets.spreadsheets.values.batchGet({
      auth: client,
      spreadsheetId,
      ranges,
    });

    const result = _.get(table, 'data', {});
    result._date = new Date();

    return result;
  } catch (err) {
    return { message: err.message, err };
  }
});

const getData = async (pageName, sheetId) => {
  const start = Date.now();
  console.log('!!! Start !!! ', pageName);
  const sheetData = await getSheets(sheetId);
  console.log('End: ', Date.now() - start);

  console.log('sheetData: ', sheetData);

  if (sheetData.err) {
    console.error('[Google api error]: ', sheetData);

    return Promise.reject(null);
  }

  switch (pageName) {
    case 'team': {
      const team = getSheetValues(sheetData.valueRanges, TEAM_RANGE);

      return arrayOfArraysToCollection(team);
    }
    case 'careers': {
      const careers = getSheetValues(sheetData.valueRanges, CAREERS_RANGE);

      return arrayOfArraysToCollection(careers);
    }
    default: {
      const team = getSheetValues(sheetData.valueRanges, TEAM_RANGE);

      return arrayOfArraysToCollection(team);
    }
  }
};

// Do I need it?
getData('team', TEAM_SHEET_ID);

const getTeam = async () => getData('team', TEAM_SHEET_ID);
const getCareers = async () => getData('careers', TEAM_SHEET_ID);

module.exports = {
  getTeam,
  getCareers,
};
