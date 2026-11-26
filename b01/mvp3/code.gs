// Vul hier de ID in van één Google Sheet die je zelf hebt aangemaakt.
const SPREADSHEET_ID = 'VUL_HIER_DE_SPREADSHEET_ID_IN';
const TABBLAD = 'Voorraad';

function rij_() {
  if (SPREADSHEET_ID === 'VUL_HIER_DE_SPREADSHEET_ID_IN') {
    throw new Error('Vul eerst SPREADSHEET_ID in Code.gs in.');
  }
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TABBLAD);
  if (!sheet) throw new Error('Tabblad Voorraad ontbreekt.');
  if (sheet.getRange('A1').getValue() !== 'code' ||
      sheet.getRange('B1').getValue() !== 'voorraad' ||
      sheet.getRange('A2').getValue() !== 'B01') {
    throw new Error('Gebruik A1=code, B1=voorraad, A2=B01 en B2=1.');
  }
  return sheet;
}

function leesVoorraad_() {
  const n = rij_().getRange('B2').getValue();
  if (n !== 0 && n !== 1) {
    throw new Error('Voorraad van B01 moet het getal 0 of 1 zijn.');
  }
  return n;
}

function metSlot_(taak) {
  // Eén scriptlock voor alle gebruikers van deze Apps Script-deployment.
  const slot = LockService.getScriptLock();
  slot.waitLock(20000);
  try {
    return taak();
  } finally {
    slot.releaseLock();
  }
}

function voorraad() {
  return metSlot_(function () {
    return { code: 'B01', voorraad: leesVoorraad_() };
  });
}

function wijzig(actie) {
  if (actie !== 'uitlenen' && actie !== 'terugbrengen') {
    return { gelukt: false, melding: 'Onbekende actie' };
  }
  return metSlot_(function () {
    const sheet = rij_();
    const huidig = leesVoorraad_();
    if (actie === 'uitlenen' && huidig === 0) {
      return { gelukt: false, voorraad: 0, melding: 'Niet beschikbaar' };
    }
    if (actie === 'terugbrengen' && huidig === 1) {
      return { gelukt: false, voorraad: 1, melding: 'B01 is al beschikbaar' };
    }
    const nieuw = actie === 'uitlenen' ? 0 : 1;
    sheet.getRange('B2').setValue(nieuw);
    SpreadsheetApp.flush(); // Schrijf de wijziging weg voordat het slot opengaat.
    return { gelukt: true, voorraad: nieuw };
  });
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET /exec?api=voorraad geeft JSON. GET /exec opent de pagina.
function doGet(e) {
  if (!e || !e.parameter || e.parameter.api !== 'voorraad') {
    const pagina = HtmlService.createTemplateFromFile('Index');
    pagina.webAppUrl = ScriptApp.getService().getUrl();
    return pagina.evaluate().setTitle('B01 uitlenen | MVP 3');
  }
  try {
    return json_(voorraad());
  } catch (fout) {
    return json_({ gelukt: false, melding: String(fout.message || fout) });
  }
}

// POST /exec met JSON {"code":"B01","actie":"uitlenen"} of "terugbrengen".
function doPost(e) {
  try {
    // Het testformulier verstuurt velden. Een apart programma mag JSON sturen.
    const isFormulier = e.postData.type &&
      e.postData.type.indexOf('application/x-www-form-urlencoded') === 0;
    const verzoek = isFormulier
      ? { code: e.parameter.code, actie: e.parameter.actie }
      : JSON.parse(e.postData.contents);
    if (!verzoek || verzoek.code !== 'B01') {
      return json_({ gelukt: false, melding: 'Gebruik code B01' });
    }
    return json_(wijzig(verzoek.actie));
  } catch (fout) {
    return json_({ gelukt: false, melding: String(fout.message || fout) });
  }
}
