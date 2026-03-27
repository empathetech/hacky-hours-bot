/**
 * Google Sheets read/write helpers.
 * All Sheet access goes through these functions.
 */

var OPEN_HEADERS = ['name', 'submitter_id', 'description', 'features', 'submitted_at'];
var CLOSED_HEADERS = ['name', 'submitter_id', 'description', 'features', 'submitted_at', 'picked_by', 'picked_at'];

/**
 * One-time setup: creates the "Open Ideas" and "Closed Ideas" tabs
 * with header rows if they don't already exist.
 * Run this manually from the Apps Script editor after setting SPREADSHEET_ID.
 */
function setupSheetTabs() {
  var spreadsheet = getSpreadsheet();

  if (!spreadsheet.getSheetByName('Open Ideas')) {
    var openSheet = spreadsheet.insertSheet('Open Ideas');
    openSheet.appendRow(OPEN_HEADERS);
    openSheet.getRange(1, 1, 1, OPEN_HEADERS.length).setFontWeight('bold');
  }

  if (!spreadsheet.getSheetByName('Closed Ideas')) {
    var closedSheet = spreadsheet.insertSheet('Closed Ideas');
    closedSheet.appendRow(CLOSED_HEADERS);
    closedSheet.getRange(1, 1, 1, CLOSED_HEADERS.length).setFontWeight('bold');
  }

  Logger.log('Sheet tabs are ready.');
}

/**
 * Returns the configured spreadsheet.
 */
function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID not set in Script Properties.');
  }
  return SpreadsheetApp.openById(id);
}

/**
 * Returns the "Open Ideas" sheet.
 */
function getOpenIdeasSheet() {
  return getSpreadsheet().getSheetByName('Open Ideas');
}

/**
 * Returns the "Closed Ideas" sheet.
 */
function getClosedIdeasSheet() {
  return getSpreadsheet().getSheetByName('Closed Ideas');
}

/**
 * Returns all rows from the Open Ideas sheet as an array of objects.
 * Each object has: name, submitter_id, description, features, submitted_at
 */
function getAllOpenIdeas() {
  var sheet = getOpenIdeasSheet();
  var data = sheet.getDataRange().getValues();

  // Skip header row
  return data.slice(1).map(function(row) {
    return {
      name: row[0],
      submitter_id: row[1],
      description: row[2],
      features: row[3],
      submitted_at: row[4]
    };
  });
}

/**
 * Finds an idea by name in the Open Ideas sheet.
 * Returns { idea: object, rowIndex: number } or null if not found.
 * rowIndex is 1-based (matches Sheet row numbers, accounting for header).
 */
function findOpenIdeaByName(name) {
  var sheet = getOpenIdeasSheet();
  var data = sheet.getDataRange().getValues();
  var lowerName = name.toLowerCase();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().toLowerCase() === lowerName) {
      return {
        idea: {
          name: data[i][0],
          submitter_id: data[i][1],
          description: data[i][2],
          features: data[i][3],
          submitted_at: data[i][4]
        },
        rowIndex: i + 1
      };
    }
  }
  return null;
}

/**
 * Checks whether an idea name already exists in the Open Ideas sheet.
 */
function ideaNameExists(name) {
  return findOpenIdeaByName(name) !== null;
}

/**
 * Appends a new idea to the Open Ideas sheet.
 */
function appendOpenIdea(name, submitter_id, description, features) {
  var sheet = getOpenIdeasSheet();
  sheet.appendRow([name, submitter_id, description, features, new Date()]);
}

/**
 * Moves an idea from Open Ideas to Closed Ideas.
 * Deletes the row from Open and appends to Closed with picked_by and picked_at.
 */
function moveIdeaToClosed(rowIndex, idea, picked_by) {
  var openSheet = getOpenIdeasSheet();
  var closedSheet = getClosedIdeasSheet();

  closedSheet.appendRow([
    idea.name,
    idea.submitter_id,
    idea.description,
    idea.features,
    idea.submitted_at,
    picked_by,
    new Date()
  ]);

  openSheet.deleteRow(rowIndex);
}
