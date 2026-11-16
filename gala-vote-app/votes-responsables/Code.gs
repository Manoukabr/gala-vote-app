const SPREADSHEET_ID = "VOTRE_ID_GOOGLE_SHEET"; // ID de votre Google Sheet (dans son URL)
// Le PIN admin n'est plus dans le code : il est lu dans les propriétés du script
// (Paramètres du projet > Propriétés du script > ADMIN_PIN).
function getAdminPin_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
}

function doGet(e) {
  const prixKey = e.parameter.prix ? e.parameter.prix.toUpperCase() : null;
  const template = HtmlService.createTemplateFromFile('Index');
  template.selectedPrixKey = prixKey;
  return template.evaluate()
    .setTitle('Gala des STARS - Espace Responsables')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// Configuration de la session de vote (ouverture/fermeture et minuteur)
function getTimerConfig() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Config_Resp');
  if (!sheet) {
    sheet = ss.insertSheet('Config_Resp');
    sheet.appendRow(['IsOpen', 'TargetDate']);
    
    const defaultTarget = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    sheet.appendRow([true, defaultTarget]);
  }
  
  const data = sheet.getDataRange().getValues();
  let isOpen = data[1] ? data[1][0] === true : true;
  let targetDate = (data[1] && data[1][1]) ? data[1][1] : '';

  if (!targetDate) {
    targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    sheet.getRange(2, 2).setValue(targetDate);
  }

  // Conversion propre en chaîne ISO si c'est un objet Date
  if (targetDate instanceof Date) {
    targetDate = targetDate.toISOString();
  }

  return {
    isOpen: isOpen,
    targetDate: String(targetDate)
  };
}

function updateTimerConfig(payload) {
  if (!getAdminPin_() || payload.adminPin !== getAdminPin_()) {
    return { success: false, message: "Code PIN Admin incorrect." };
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Config_Resp');
  if (!sheet) {
    sheet = ss.insertSheet('Config_Resp');
    sheet.appendRow(['IsOpen', 'TargetDate']);
  }
  
  // Enregistrement de la nouvelle date cible ou conservation
  let formattedTarget = payload.targetDate ? new Date(payload.targetDate).toISOString() : '';
  
  sheet.getRange(2, 1).setValue(payload.isOpen);
  sheet.getRange(2, 2).setValue(formattedTarget);

  return { 
    success: true, 
    message: payload.isOpen ? "Session mise à jour !" : "Évaluations fermées.",
    targetDate: formattedTarget
  };
}

function getTop3ByPrix() {
  const config = getTimerConfig();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Votes');
  if (!sheet) return { top3: {}, config: config };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { top3: {}, config: config };

  const counts = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const prixFull = String(row[1] || '').trim();
    const candidateName = String(row[2] || row[3] || '').trim();

    if (!prixFull || !candidateName) continue;

    let prixKey = "";
    if (prixFull.includes("Prix N°1") || prixFull.includes("Meilleur Berger")) prixKey = "PRIX1";
    else if (prixFull.includes("Prix N°2") || prixFull.includes("Fidèle Serviteur")) prixKey = "PRIX2";
    else if (prixFull.includes("Prix N°3") || prixFull.includes("Femme Khayil")) prixKey = "PRIX3";
    else if (prixFull.includes("Prix N°4") || prixFull.includes("Jeune Prodige")) prixKey = "PRIX4";
    else if (prixFull.includes("Prix N°5") || prixFull.includes("Homme Kephalé")) prixKey = "PRIX5";
    else if (prixFull.includes("Prix N°6") || prixFull.includes("Impact Junior")) prixKey = "PRIX6";
    else if (prixFull.includes("Prix N°7") || prixFull.includes("Épaphras")) prixKey = "PRIX7";

    if (!prixKey) continue;

    if (!counts[prixKey]) counts[prixKey] = {};
    counts[prixKey][candidateName] = (counts[prixKey][candidateName] || 0) + 1;
  }

  const top3Result = {};
  for (const pKey in counts) {
    const sorted = Object.entries(counts[pKey])
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length <= 3) {
      top3Result[pKey] = sorted.map(item => ({ name: item[0], votes: item[1] }));
    } else {
      // On récupère le nombre de voix du 3ème candidat
      const thresholdVotes = sorted[2][1];
      
      // On conserve tous les candidats ayant au moins autant de voix que le 3ème
      const qualified = sorted.filter(item => item[1] >= thresholdVotes);
      
      top3Result[pKey] = qualified.map(item => ({ name: item[0], votes: item[1] }));
    }
  }

  return { top3: top3Result, config: config };
}

function getGlobalDashboardData(pin) {
  if (!getAdminPin_() || pin !== getAdminPin_()) {
    return { success: false, message: "Code PIN incorrect." };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetResp = ss.getSheetByName('Votes_Responsables');

  const top3DataRes = getTop3ByPrix();
  const top3 = top3DataRes.top3;
  const respData = sheetResp ? sheetResp.getDataRange().getValues() : [];

  const respScores = {};
  for (let i = 1; i < respData.length; i++) {
    const row = respData[i];
    const pKey = String(row[1]).trim();
    const candName = String(row[3]).trim();
    const score = parseFloat(row[4]);

    if (!respScores[pKey]) respScores[pKey] = {};
    if (!respScores[pKey][candName]) respScores[pKey][candName] = [];
    if (!isNaN(score)) respScores[pKey][candName].push(score);
  }

  const finalResults = {};

  for (const pKey in top3) {
    const candidates = top3[pKey];
    const totalVotesAss = candidates.reduce((sum, c) => sum + c.votes, 0);

    finalResults[pKey] = candidates.map(c => {
      const scoreAss = totalVotesAss > 0 ? (c.votes / totalVotesAss) * 60 : 0;
      const notesArray = (respScores[pKey] && respScores[pKey][c.name]) ? respScores[pKey][c.name] : [];
      let avgNote20 = 0;
      if (notesArray.length > 0) {
        avgNote20 = notesArray.reduce((sum, val) => sum + val, 0) / notesArray.length;
      }
      const scoreResp = (avgNote20 / 20) * 40;
      const scoreTotal = scoreAss + scoreResp;

      return {
        name: c.name,
        votesAss: c.votes,
        scoreAss60: scoreAss.toFixed(1),
        avgResp20: avgNote20.toFixed(1),
        scoreResp40: scoreResp.toFixed(1),
        scoreTotal100: scoreTotal.toFixed(1)
      };
    }).sort((a, b) => b.scoreTotal100 - a.scoreTotal100);
  }

  return { success: true, data: finalResults, config: top3DataRes.config };
}
function submitResponsableVotes(payload) {
  const config = getTimerConfig();
  
  if (!config.isOpen) {
    return { success: false, message: "⛔ Les évaluations sont actuellement fermées." };
  }
  
  if (config.targetDate) {
    const targetTime = new Date(config.targetDate).getTime();
    const nowTime = new Date().getTime();
    if (nowTime > targetTime) {
      return { success: false, message: "⛔ Le temps imparti pour voter est dépassé." };
    }
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Votes_Responsables');

    if (!sheet) {
      sheet = ss.insertSheet('Votes_Responsables');
      sheet.appendRow(['Timestamp', 'Prix', 'Responsable', 'Candidat', 'Note', 'Commentaire', 'Détails Critères']);
    }

    const data = sheet.getDataRange().getValues();
    const cleanRespName = payload.responsableName.trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const rowPrix = String(data[i][1]).trim().toUpperCase();
      const rowResp = String(data[i][2]).trim().toLowerCase();

      if (rowPrix === payload.prixKey.toUpperCase() && rowResp === cleanRespName) {
        return { 
          success: false, 
          message: "🚫 Vous avez déjà soumis une évaluation pour ce prix (" + payload.responsableName + ")." 
        };
      }
    }

    const timestamp = new Date();
    payload.ratings.forEach(item => {
      sheet.appendRow([
        timestamp,
        payload.prixKey,
        payload.responsableName.trim(),
        item.candidateName,
        item.score,
        item.comment,
        item.detailsCritique || ""
      ]);
    });

    return { success: true, message: "✅ Évaluations enregistrées avec succès !" };
  } catch (err) {
    return { success: false, message: "Erreur serveur : " + err.message };
  } finally {
    lock.releaseLock();
  }
}
function genererResultatsOfficiels() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const categoriesMap = {
    "PRIX1": { nom: "Meilleur Berger", type: "podium" },
    "PRIX2": { nom: "Fidèle Serviteur", type: "podium" },
    "PRIX3": { nom: "Femme Khayil", type: "single" },
    "PRIX4": { nom: "Jeune Prodigue", type: "single" },
    "PRIX5": { nom: "Kephalé", type: "single" },
    "PRIX6": { nom: "Impact Junior", type: "single" },
    "PRIX7": { nom: "Épaphras", type: "podium" }
  };

  let sheetRes = ss.getSheetByName('Resultats_Officiels');
  if (!sheetRes) {
    sheetRes = ss.insertSheet('Resultats_Officiels');
  } else {
    sheetRes.clear();
  }

  // En-têtes propres
  sheetRes.appendRow(['Code Prix', 'Catégorie / Prix', 'Rang', 'Candidat', 'Score Total (/100)', 'Score Assemblée (/60)', 'Moyenne Responsables (/20)', 'Score Responsables (/40)', 'Commentaires Assemblée (Raison)', 'Commentaires Responsables']);
  sheetRes.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#f39c12').setFontColor('#ffffff');

  const dashboardData = getGlobalDashboardData(getAdminPin_());
  if (!dashboardData.success) {
    Logger.log("Erreur lors de la récupération des scores.");
    return;
  }
  const dataResults = dashboardData.data;

  const sheetVotes = ss.getSheetByName('Votes');
  const votesData = sheetVotes ? sheetVotes.getDataRange().getValues() : [];

  const sheetResp = ss.getSheetByName('Votes_Responsables');
  const respData = sheetResp ? sheetResp.getDataRange().getValues() : [];

  for (const pKey in categoriesMap) {
    const catInfo = categoriesMap[pKey];
    const candidatesList = dataResults[pKey];

    if (!candidatesList || candidatesList.length === 0) continue;

    const limit = catInfo.type === 'single' ? 1 : 3;
    let currentRank = 1;

    candidatesList.forEach((cand, index) => {
      if (index > 0 && parseFloat(cand.scoreTotal100) < parseFloat(candidatesList[index - 1].scoreTotal100)) {
        currentRank++;
      }

      if (currentRank <= limit || (index > 0 && parseFloat(cand.scoreTotal100) === parseFloat(candidatesList[index - 1].scoreTotal100) && currentRank <= limit + 1)) {
        
        // --- EXTRACTION EXACTE DES COMMENTAIRES ASSEMBLÉE (Colonne D = index 3) ---
        let asmComs = [];
        for (let i = 1; i < votesData.length; i++) {
          let prixCell = String(votesData[i][1] || '').trim().toLowerCase(); // Colonne B (IDCandidat / Prix)
          let candCell = String(votesData[i][2] || '').trim().toLowerCase(); // Colonne C (Jeton / Candidat)
          let raisonCell = String(votesData[i][3] || '').trim();             // Colonne D (Raison / Commentaire)

          let matchPrix = prixCell.includes(catInfo.nom.toLowerCase()) || prixCell.includes(pKey.toLowerCase());
          let matchCand = candCell.includes(cand.name.toLowerCase());

          if (matchPrix && matchCand && raisonCell && raisonCell !== "") {
            asmComs.push(raisonCell);
          }
        }

        // --- EXTRACTION DES COMMENTAIRES RESPONSABLES ---
        let respComs = [];
        for (let i = 1; i < respData.length; i++) {
          let prixCell = String(respData[i][1] || '').trim().toUpperCase();
          let candCell = String(respData[i][3] || '').trim().toLowerCase();
          if (prixCell === pKey && candCell === cand.name.toLowerCase()) {
            if (respData[i][5]) {
              respComs.push(respData[i][2] + " (" + respData[i][4] + "/20): " + respData[i][5]);
            }
          }
        }

        sheetRes.appendRow([
          pKey,
          catInfo.nom,
          currentRank === 1 ? "1er" : currentRank + "ème (Ex-aequo)",
          cand.name,
          cand.scoreTotal100,
          cand.scoreAss60,
          cand.avgResp20,
          cand.scoreResp40,
          asmComs.join(" // "),
          respComs.join(" // ")
        ]);
      }
    });
  }

  Logger.log("🎉 Tableau des résultats officiels généré avec succès !");
}