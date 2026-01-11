/**
 * ========================================
 * קוד ל-Google Apps Script
 * ========================================
 * 
 * הוראות התקנה:
 * 1. צרי Google Sheet חדש
 * 2. לכי ל: Extensions > Apps Script
 * 3. מחקי את כל הקוד הקיים והדביקי את הקוד הזה
 * 4. שמרי (Ctrl+S)
 * 5. לחצי Deploy > New Deployment
 * 6. בחרי "Web app"
 * 7. הגדרי: Execute as "Me", Who has access "Anyone"
 * 8. לחצי Deploy והעתיקי את ה-URL
 * 9. הדביקי את ה-URL באפליקציה
 * 
 * הגיליון צריך להכיל 3 sheets:
 * - users (עמודות: id, email, password, createdAt)
 * - tenants (עמודות: id, userId, name, monthlyRent, monthlyElectricity, monthlyWater, monthlyCommittee, monthlyGas, waterMeter, electricityMeter, gasMeter, createdAt)
 * - payments (עמודות: id, tenantId, userId, hebrewMonth, hebrewYear, rentPaid, electricityPaid, waterPaid, committeePaid, gasPaid, createdAt, updatedAt)
 */

// פונקציה ראשית לטיפול בבקשות GET
function doGet(e) {
  return handleRequest(e);
}

// פונקציה ראשית לטיפול בבקשות POST
function doPost(e) {
  return handleRequest(e);
}

// טיפול בבקשות
function handleRequest(e) {
  const params = e.parameter;
  const action = params.action;
  
  let result;
  
  try {
    switch(action) {
      // Auth actions
      case 'signup':
        result = signUp(params.email, params.password);
        break;
      case 'signin':
        result = signIn(params.email, params.password);
        break;
        
      // Tenant actions
      case 'getTenants':
        result = getTenants(params.userId);
        break;
      case 'addTenant':
        result = addTenant(JSON.parse(e.postData.contents));
        break;
      case 'updateTenant':
        result = updateTenant(JSON.parse(e.postData.contents));
        break;
      case 'deleteTenant':
        result = deleteTenant(params.id);
        break;
        
      // Payment actions
      case 'getPayments':
        result = getPayments(params.userId);
        break;
      case 'createPayment':
        result = createPayment(JSON.parse(e.postData.contents));
        break;
      case 'updatePayment':
        result = updatePayment(JSON.parse(e.postData.contents));
        break;
        
      default:
        result = { error: 'Unknown action' };
    }
  } catch(error) {
    result = { error: error.message };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== AUTH FUNCTIONS ==========

function signUp(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
  const data = sheet.getDataRange().getValues();
  
  // בדוק אם המייל כבר קיים
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email) {
      return { error: 'משתמש עם מייל זה כבר קיים' };
    }
  }
  
  // צור משתמש חדש
  const id = Utilities.getUuid();
  const hashedPassword = hashPassword(password);
  const createdAt = new Date().toISOString();
  
  sheet.appendRow([id, email, hashedPassword, createdAt]);
  
  return { 
    success: true, 
    user: { id, email } 
  };
}

function signIn(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
  const data = sheet.getDataRange().getValues();
  
  const hashedPassword = hashPassword(password);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email && data[i][2] === hashedPassword) {
      return { 
        success: true, 
        user: { id: data[i][0], email: data[i][1] } 
      };
    }
  }
  
  return { error: 'מייל או סיסמה שגויים' };
}

function hashPassword(password) {
  // Hash פשוט - לא מומלץ לפרודקשן אמיתי
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// ========== TENANT FUNCTIONS ==========

function getTenants(userId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('tenants');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const tenants = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === userId) { // userId is column B (index 1)
      const tenant = {};
      headers.forEach((header, index) => {
        tenant[header] = data[i][index];
      });
      tenants.push(tenant);
    }
  }
  
  return { tenants };
}

function addTenant(tenantData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('tenants');
  
  const id = Utilities.getUuid();
  const createdAt = new Date().toISOString();
  
  sheet.appendRow([
    id,
    tenantData.userId,
    tenantData.name,
    tenantData.monthlyRent || 0,
    tenantData.monthlyElectricity || 0,
    tenantData.monthlyWater || 0,
    tenantData.monthlyCommittee || 0,
    tenantData.monthlyGas || 0,
    tenantData.waterMeter || 0,
    tenantData.electricityMeter || 0,
    tenantData.gasMeter || 0,
    createdAt
  ]);
  
  return { success: true, id };
}

function updateTenant(tenantData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('tenants');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === tenantData.id) {
      // Update the row
      if (tenantData.name !== undefined) sheet.getRange(i + 1, 3).setValue(tenantData.name);
      if (tenantData.monthlyRent !== undefined) sheet.getRange(i + 1, 4).setValue(tenantData.monthlyRent);
      if (tenantData.monthlyElectricity !== undefined) sheet.getRange(i + 1, 5).setValue(tenantData.monthlyElectricity);
      if (tenantData.monthlyWater !== undefined) sheet.getRange(i + 1, 6).setValue(tenantData.monthlyWater);
      if (tenantData.monthlyCommittee !== undefined) sheet.getRange(i + 1, 7).setValue(tenantData.monthlyCommittee);
      if (tenantData.monthlyGas !== undefined) sheet.getRange(i + 1, 8).setValue(tenantData.monthlyGas);
      if (tenantData.waterMeter !== undefined) sheet.getRange(i + 1, 9).setValue(tenantData.waterMeter);
      if (tenantData.electricityMeter !== undefined) sheet.getRange(i + 1, 10).setValue(tenantData.electricityMeter);
      if (tenantData.gasMeter !== undefined) sheet.getRange(i + 1, 11).setValue(tenantData.gasMeter);
      
      return { success: true };
    }
  }
  
  return { error: 'Tenant not found' };
}

function deleteTenant(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('tenants');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { error: 'Tenant not found' };
}

// ========== PAYMENT FUNCTIONS ==========

function getPayments(userId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('payments');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const payments = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === userId) { // userId is column C (index 2)
      const payment = {};
      headers.forEach((header, index) => {
        payment[header] = data[i][index];
      });
      payments.push(payment);
    }
  }
  
  return { payments };
}

function createPayment(paymentData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('payments');
  
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  
  sheet.appendRow([
    id,
    paymentData.tenantId,
    paymentData.userId,
    paymentData.hebrewMonth,
    paymentData.hebrewYear,
    paymentData.rentPaid || 0,
    paymentData.electricityPaid || 0,
    paymentData.waterPaid || 0,
    paymentData.committeePaid || 0,
    paymentData.gasPaid || 0,
    now,
    now
  ]);
  
  return { success: true, id };
}

function updatePayment(paymentData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('payments');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === paymentData.id) {
      // Update the payment fields
      if (paymentData.rentPaid !== undefined) sheet.getRange(i + 1, 6).setValue(paymentData.rentPaid);
      if (paymentData.electricityPaid !== undefined) sheet.getRange(i + 1, 7).setValue(paymentData.electricityPaid);
      if (paymentData.waterPaid !== undefined) sheet.getRange(i + 1, 8).setValue(paymentData.waterPaid);
      if (paymentData.committeePaid !== undefined) sheet.getRange(i + 1, 9).setValue(paymentData.committeePaid);
      if (paymentData.gasPaid !== undefined) sheet.getRange(i + 1, 10).setValue(paymentData.gasPaid);
      sheet.getRange(i + 1, 12).setValue(new Date().toISOString()); // updatedAt
      
      return { success: true };
    }
  }
  
  return { error: 'Payment not found' };
}
