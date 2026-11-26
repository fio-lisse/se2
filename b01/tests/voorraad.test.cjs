// Start in de repository: node se2/b01/tests/voorraad.test.cjs
// Dit script draait de echte MVP 3 Code.gs met een nagebootste Sheet en lock.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bronmap = path.join(__dirname, '../mvp3');
const bronbestand = fs.existsSync(path.join(bronmap, 'Code.gs')) ? 'Code.gs' : 'code.gs';
const bron = fs.readFileSync(path.join(bronmap, bronbestand), 'utf8')
  .replace("'VUL_HIER_DE_SPREADSHEET_ID_IN'", "'TEST_SHEET'");
let aantal = 1;
let slotBezet = false;
let wegschrijvingen = 0;
const sheet = {
  getRange(cel) {
    const waarden = { A1: 'code', B1: 'voorraad', A2: 'B01' };
    return {
      getValue: () => cel === 'B2' ? aantal : waarden[cel],
      setValue: waarde => {
        if (cel !== 'B2') throw Error('Onverwachte cel');
        aantal = waarde;
      }
    };
  }
};
const context = {
  SpreadsheetApp: {
    openById: id => {
      if (id !== 'TEST_SHEET') throw Error('Verkeerde Sheet');
      return { getSheetByName: naam => naam === 'Voorraad' ? sheet : null };
    },
    flush: () => { wegschrijvingen++; }
  },
  LockService: {
    getScriptLock: () => ({
      waitLock: () => {
        if (slotBezet) throw Error('Een tweede aanvraag mag niet tegelijk naar binnen');
        slotBezet = true;
      },
      releaseLock: () => { slotBezet = false; }
    })
  }
};
vm.createContext(context);
vm.runInContext(bron, context);

let geslaagd = 0;
let fouten = 0;
function controle(naam, klopt, bewustFout = false) {
  if (bewustFout && !klopt) {
    console.log('FOUT (bewust): ' + naam);
    console.log('  Zo zie je dat een test een verkeerde aanname ontdekt.');
    return;
  }
  if (klopt && !bewustFout) {
    geslaagd++;
    console.log('GOED: ' + naam);
    return;
  }
  fouten++;
  console.error('ONVERWACHT: ' + naam);
}

const eerste = context.wijzig('uitlenen');
controle('Van 1 naar 0: uitlenen lukt.', eerste.gelukt === true && eerste.voorraad === 0 && aantal === 0);
const tweede = context.wijzig('uitlenen');
controle('Bij 0 blijft de voorraad 0: tweede uitlening mislukt.',
  tweede.gelukt === false && tweede.voorraad === 0 && aantal === 0 && tweede.melding === 'Niet beschikbaar');
controle('Een tweede uitlening lukt toch bij 0 (opzettelijk verkeerde verwachting).',
  tweede.gelukt === true, true);
const terug = context.wijzig('terugbrengen');
controle('Van 0 naar 1: terugbrengen lukt.', terug.gelukt === true && terug.voorraad === 1 && aantal === 1);
controle('Sheet wordt weggeschreven bij beide wijzigingen.', wegschrijvingen === 2);
console.log(geslaagd + ' controles goed, 1 bewust fout, ' + fouten + ' onverwachte fouten.');
if (fouten) process.exitCode = 1;
