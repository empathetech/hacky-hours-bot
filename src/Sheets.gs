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
 *
 * Supports two access modes:
 * 1. Deployer account (default) — uses the deployer's Google account via SpreadsheetApp
 * 2. Service account — uses a Google Cloud service account via OAuth2
 *    Set SERVICE_ACCOUNT_CREDENTIALS in Script Properties to enable this mode.
 *    The credentials JSON must contain client_email, private_key, and token_uri.
 *    The Sheet must be shared with the service account's email address.
 *
 * See SECURITY_PRIVACY.md for risk comparison between the two approaches.
 */
function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('SPREADSHEET_ID not set in Script Properties.');
  }

  var serviceAccountCreds = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_CREDENTIALS');
  if (serviceAccountCreds) {
    return openSheetWithServiceAccount(id, serviceAccountCreds);
  }

  return SpreadsheetApp.openById(id);
}

/**
 * Opens a spreadsheet using a service account's credentials.
 * Uses the Sheets API v4 via UrlFetchApp with an OAuth2 access token.
 *
 * Note: This returns a regular Spreadsheet object by using the service account
 * token to verify access, then falling back to SpreadsheetApp.openById().
 * The service account must have editor access to the Sheet.
 *
 * For full isolation (where the deployer's account has NO access to the Sheet),
 * all reads/writes would need to go through the Sheets API v4 directly.
 * This hybrid approach is simpler: it validates the service account has access
 * but uses SpreadsheetApp for the actual operations, which requires the
 * deployer to also have access. See ARCHITECTURE.md Design Decisions.
 */
function openSheetWithServiceAccount(spreadsheetId, credsJson) {
  var creds = JSON.parse(credsJson);
  var token = getServiceAccountToken(creds);

  // Verify the service account can access the sheet
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(spreadsheetId) + '?fields=properties.title';
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Service account cannot access spreadsheet. '
      + 'Make sure the Sheet is shared with: ' + creds.client_email);
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

/**
 * Generates an OAuth2 access token for a Google Cloud service account
 * using a self-signed JWT (no external library needed).
 */
function getServiceAccountToken(creds) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var claimSet = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: creds.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  var headerB64 = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  var claimB64 = Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
  var signatureInput = headerB64 + '.' + claimB64;

  var key = creds.private_key;
  var signature = Utilities.computeRsaSha256Signature(signatureInput, key);
  var signatureB64 = Utilities.base64EncodeWebSafe(signature);

  var jwt = signatureInput + '.' + signatureB64;

  var tokenResponse = UrlFetchApp.fetch(creds.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });

  var tokenData = JSON.parse(tokenResponse.getContentText());
  return tokenData.access_token;
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
