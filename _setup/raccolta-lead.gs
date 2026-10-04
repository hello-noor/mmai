/**
 * Raccolta delle richieste dal sito (mariomele.com).
 * Scrive ogni richiesta in un foglio Google e ti manda una mail con il riepilogo.
 *
 * Come attivarla (5 minuti):
 * 1. Crea un nuovo Foglio Google (vuoto), per esempio "Richieste dal sito".
 * 2. Dal foglio: Estensioni > Apps Script. Cancella il contenuto e incolla questo file.
 * 3. Salva, poi: Distribuisci > Nuova distribuzione > tipo "App web".
 *      - Esegui come: Me
 *      - Chi ha accesso: Chiunque
 *    Autorizza l'accesso quando richiesto.
 * 4. Copia l'URL dell'app web (finisce con /exec) e incollalo in FORM_ENDPOINT, in index.html.
 */
const EMAIL = 'info@mariomele.com';

function doPost(e) {
  const p = e.parameter || {};
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Data', 'Nome', 'Azienda', 'Email', 'Telefono', 'Chi altro', 'Note', 'Origine', 'Riepilogo']);
  }
  sh.appendRow([new Date(), p.nome || '', p.azienda || '', p.email || '', p.telefono || '',
                p.chi_altro || '', p.note || '', p.origine || '', p.riepilogo || '']);
  MailApp.sendEmail({
    to: EMAIL,
    replyTo: p.email || EMAIL,
    subject: 'Nuova richiesta dal sito: ' + (p.nome || '') + (p.azienda ? ' (' + p.azienda + ')' : ''),
    body: p.riepilogo || ''
  });
  return ContentService.createTextOutput('ok');
}
