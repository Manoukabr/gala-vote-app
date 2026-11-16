// Le PIN admin n'est plus dans le code : il est lu dans les propriétés du script
// (Paramètres du projet > Propriétés du script > ADMIN_PIN).
function getAdminPin_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
}

// ==========================================
// 1. INITIALISATION ET AFFICHAGE
// ==========================================
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
      .setTitle('Gala des STARS - ICC Nancy')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// 2. GESTION DU COMPTE À REBOURS
// ==========================================
function getCountdownConfig() {
  const props = PropertiesService.getScriptProperties();
  const targetDate = props.getProperty('COUNTDOWN_TARGET');
  const isActive = props.getProperty('COUNTDOWN_ACTIVE') === 'true';
  return { targetDate: targetDate || "", isActive: isActive };
}

function setCountdownConfig(targetDate, isActive) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('COUNTDOWN_TARGET', targetDate || '');
  props.setProperty('COUNTDOWN_ACTIVE', isActive ? 'true' : 'false');
  return { success: true, targetDate: targetDate, isActive: isActive };
}

// ==========================================
// 3. RÉCUPÉRATION DES CANDIDATS
// ==========================================
function getCandidates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Candidats');
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  data.shift(); // Supprime l'en-tête
  
  return data.map(row => ({
    id: String(row[0]),
    name: row[1],
    photoUrl: row[2],
    description: row[3]
  }));
}

// ==========================================
// 4. SOUMISSION DU VOTE (SÉCURISÉ & GESTION CONCURRENCE)
// ==========================================
function submitVote(prixTitre, candidateName, token, reason) {
  if (!candidateName) {
    return { success: false, message: "Le nom du candidat est requis." };
  }

  const config = getCountdownConfig();
  if (!config.isActive) {
    return { success: false, message: "Les votes sont actuellement fermés." };
  }
  if (config.targetDate && Date.now() >= new Date(config.targetDate).getTime()) {
    return { success: false, message: "Le temps imparti pour voter est écoulé !" };
  }

  // Verrou pour éviter les conflits lors d'écritures simultanées (10+ personnes en même temps)
  const lock = LockService.getScriptLock();
  try {
    // Attendre jusqu'à 10 secondes si une autre personne écrit en même temps
    lock.waitLock(10000);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Votes");
    
    if (!sheet) {
      sheet = ss.insertSheet("Votes");
      sheet.appendRow(["Horodatage", "Prix", "Candidat / Choix", "Raison"]);
    }

    sheet.appendRow([
      new Date(),
      prixTitre,
      candidateName,
      reason || ""
    ]);

    return { 
      success: true, 
      message: "Votre vote a été enregistré avec succès !" 
    };

  } catch (error) {
    return { 
      success: false, 
      message: "Serveur occupé, veuillez réessayer votre vote dans un instant." 
    };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 5. RÉSULTATS ADMIN ET VÉRIFICATION SÉCURISÉE DU PIN
// ==========================================
function getResultsData(pinSaisi) {
  if (!getAdminPin_() || pinSaisi !== getAdminPin_()) {
    return { success: false, message: "Code PIN incorrect." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Votes");
  const data = {};

  if (!sheet) return { success: true, data: data };

  const rows = sheet.getDataRange().getValues();
  
  for (let i = 1; i < rows.length; i++) {
    const prix = rows[i][1];
    const candidat = rows[i][2];

    if (!prix || !candidat) continue;

    if (!data[prix]) {
      data[prix] = {
        totalVotants: 0,
        candidates: {}
      };
    }

    if (!data[prix].candidates[candidat]) {
      data[prix].candidates[candidat] = 0;
    }

    data[prix].candidates[candidat]++;
    data[prix].totalVotants++;
  }

  return { success: true, data: data };
}