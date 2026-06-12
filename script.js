/**
 * SONGO — Version Locale (2 joueurs / joueur vs machine)
 * Auteur : FOMENA NGASSEU ANGE 24G2934
 * INF222 — Programmation Web — UY1 2025-2026
 *
 * RÈGLE DE DISTRIBUTION CIRCULAIRE (chaîne unique, un seul sens) :
 *
 *   Le plateau forme une chaîne circulaire de 14 cases, parcourue dans
 *   UN SEUL ET MÊME SENS pour les deux joueurs :
 *
 *       Nord: C1 → C2 → C3 → C4 → C5 → C6 → C7
 *                                                ↓
 *       Sud:  C1 ← C2 ← C3 ← C4 ← C5 ← C6 ← C7
 *         ↑__________________________________________|
 *
 *   Cycle interne (indices 0..6 = C1..C7) :
 *     Nord[0], Nord[1], ..., Nord[6], Sud[6], Sud[5], ..., Sud[0], Nord[0], ...
 *
 *   Tout joueur distribue depuis sa case de départ (exclue) vers la case
 *   suivante dans ce sens unique, en boucle.
 *   Si seeds > 13, la case de départ est sautée lors du tour complet.
 */

/* ============================================================
   SONS (Web Audio API — aucun fichier externe requis)
============================================================ */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playCapture() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + .25);
    gain.gain.setValueAtTime(.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .28);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + .3);
  } catch(e) {}
}
function playSeed() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 280 + Math.random() * 200;
    gain.gain.setValueAtTime(.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .07);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + .08);
  } catch(e) {}
}

/* ============================================================
   ÉTAT GLOBAL
============================================================ */
let gameMode      = 'human';
let playerNames   = ['Joueur 1', 'Joueur 2'];
let board         = [];   // board[0]=Nord, board[1]=Sud, indices 0..6 = C1..C7
let scores        = [0, 0];
let currentPlayer = 1;    // 0=Nord, 1=Sud — Sud commence
let gameOver      = false;
let moveCount     = 0;
let history       = [];   // max 5 entrées
let undoStack     = [];
let wins          = [0, 0];
let isAnimating   = false;
let historyOpen   = false;

/* ============================================================
   GÉNÉRATEUR DE SÉQUENCE — DISTRIBUTION CIRCULAIRE
   
   Chaîne circulaire unique (14 cases), sens unique pour les 2 joueurs :
   
     Nord[0]→Nord[1]→...→Nord[6]→Sud[6]→Sud[5]→...→Sud[0]→Nord[0]→...
     (C1→C7 chez Nord, puis C7→C1 chez Sud, en boucle)
   
   Schéma :
     Nord: C1 → C2 → C3 → C4 → C5 → C6 → C7
                                              ↓
     Sud:  C1 ← C2 ← C3 ← C4 ← C5 ← C6 ← C7
       ↑_______________________________________↑
   
   La case de départ est sautée si seeds > 13.
============================================================ */

/**
 * Retourne la séquence de cases {camp, idx} où déposer les graines.
 * @param {number} player        - 0=Nord, 1=Sud
 * @param {number} startIdx      - index de la case de départ (0=C1 .. 6=C7)
 * @param {number} seeds         - nombre de graines à distribuer
 * @param {boolean} sauterDepart - sauter la case de départ si seeds > 13
 */
function genererSequence(player, startIdx, seeds, sauterDepart) {
  // Cycle fixe commun aux deux joueurs :
  //   Nord[0], Nord[1], ..., Nord[6], Sud[6], Sud[5], ..., Sud[0]
  const cycle = [];
  for (let i = 0; i <= 6; i++) cycle.push({ camp: 0, idx: i }); // Nord C1→C7
  for (let i = 6; i >= 0; i--) cycle.push({ camp: 1, idx: i }); // Sud  C7→C1

  // Trouver la position de la case de départ dans le cycle
  const startPos = cycle.findIndex(c => c.camp === player && c.idx === startIdx);

  const seq = [];
  let pos = startPos;
  for (let k = 0; k < seeds; k++) {
    pos = (pos + 1) % 14;
    // Sauter la case de départ si seeds > 13
    if (sauterDepart && cycle[pos].camp === player && cycle[pos].idx === startIdx) {
      pos = (pos + 1) % 14;
    }
    seq.push(cycle[pos]);
  }
  return seq;
}

/* ============================================================
   NAVIGATION ENTRE ÉCRANS
============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.getElementById('btn-vs-human').onclick = () => {
  gameMode = 'human';
  document.getElementById('field-p2').style.display = '';
  showScreen('screen-names');
};
document.getElementById('btn-vs-ai').onclick = () => {
  gameMode = 'ai';
  document.getElementById('field-p2').style.display = 'none';
  showScreen('screen-names');
};
document.getElementById('btn-rules-welcome').onclick = () => openModal('rules-modal');
document.getElementById('btn-back-names').onclick    = () => showScreen('screen-welcome');
document.getElementById('btn-start').onclick         = startGame;
document.getElementById('btn-home').onclick          = () => showScreen('screen-welcome');
document.getElementById('btn-new').onclick           = initGame;
document.getElementById('btn-undo').onclick          = undoMove;
document.getElementById('btn-rules-game').onclick    = () => openModal('rules-modal');
document.getElementById('btn-history').onclick       = toggleHistory;
document.getElementById('modal-close').onclick       = () => closeModal('rules-modal');
document.getElementById('modal-ok').onclick          = () => closeModal('rules-modal');
document.getElementById('victory-new').onclick  = () => { closeModal('victory-modal'); initGame(); };
document.getElementById('victory-home').onclick = () => { closeModal('victory-modal'); showScreen('screen-welcome'); };

/* ============================================================
   DÉMARRER (depuis écran noms)
============================================================ */
function startGame() {
  const n1 = document.getElementById('input-p1').value.trim() || 'Joueur 1';
  const n2 = gameMode === 'ai'
    ? 'Machine'
    : (document.getElementById('input-p2').value.trim() || 'Joueur 2');
  playerNames = [n1, n2];

  document.getElementById('name-north').textContent  = n1;
  document.getElementById('name-south').textContent  = n2;
  document.getElementById('label-north').textContent = '🔵 ' + n1;
  document.getElementById('label-south').textContent = n2 + ' 🟠';
  document.getElementById('sb-name1').textContent    = n1;
  document.getElementById('sb-name2').textContent    = n2;

  showScreen('screen-game');
  initGame();
  setTimeout(animateStart, 80);
}

function animateStart() {
  document.querySelectorAll('.pit').forEach((pit, i) => {
    pit.style.opacity   = '0';
    pit.style.transform = 'scale(0.4) translateY(-18px)';
    setTimeout(() => {
      pit.style.transition = 'all 0.35s cubic-bezier(.34,1.56,.64,1)';
      pit.style.opacity    = '';
      pit.style.transform  = '';
      setTimeout(() => { pit.style.transition = ''; }, 380);
    }, i * 45);
  });
}

/* ============================================================
   INITIALISATION
============================================================ */
function initGame() {
  board = [
    [5,5,5,5,5,5,5],  // Nord (joueur 0) : indices 0..6 = C1..C7
    [5,5,5,5,5,5,5]   // Sud  (joueur 1) : indices 0..6 = C1..C7
  ];
  scores        = [0, 0];
  currentPlayer = 1;   // Sud commence
  gameOver      = false;
  moveCount     = 0;
  history       = [];
  undoStack     = [];
  isAnimating   = false;

  buildBoard();
  updateScores();
  updateStats();
  updateHistory();
  setMessage(`${playerNames[currentPlayer]} commence la partie !`);
  document.getElementById('btn-undo').disabled = true;
}

/* ============================================================
   CONSTRUCTION DU PLATEAU
   Nord affiché : [C1][C2][C3][C4][C5][C6][C7]  indices 0→6
   Sud  affiché : [C1][C2][C3][C4][C5][C6][C7]  indices 0→6

   Visuellement :
     Nord: C1 → C2 → C3 → C4 → C5 → C6 → C7
             ↑                               ↓
     Sud:  C1 ← C2 ← C3 ← C4 ← C5 ← C6 ← C7
============================================================ */
function buildBoard() {
  buildRow('north-row', 0, [0,1,2,3,4,5,6]);  // Nord affiché C1→C7 (gauche→droite)
  buildRow('south-row', 1, [0,1,2,3,4,5,6]);  // Sud  affiché C1→C7 (gauche→droite)
}

function buildRow(rowId, player, indices) {
  const row = document.getElementById(rowId);
  row.innerHTML = '';
  indices.forEach(idx => {
    const container   = document.createElement('div');
    container.className = 'pit-container';

    const numEl = document.createElement('div');
    numEl.className   = 'pit-number';
    numEl.textContent = 'C' + (idx + 1);

    const pit = document.createElement('div');
    pit.className   = 'pit ' + (player === 0 ? 'north' : 'south');
    pit.id          = `pit-${player}-${idx}`;
    pit.textContent = board[player][idx];
    if (board[player][idx] === 0) pit.classList.add('empty');
    pit.addEventListener('click', () => onPitClick(player, idx));

    if (player === 0) {
      container.appendChild(numEl);
      container.appendChild(pit);
    } else {
      container.appendChild(pit);
      container.appendChild(numEl);
    }
    row.appendChild(container);
  });
}

/* ============================================================
   MISE À JOUR AFFICHAGE
============================================================ */
function refreshBoard() {
  for (let p = 0; p < 2; p++) {
    for (let idx = 0; idx < 7; idx++) {
      const pit = document.getElementById(`pit-${p}-${idx}`);
      if (!pit) continue;
      pit.textContent = board[p][idx];
      pit.classList.remove('playable','last-move','captured','distributing');
      pit.classList.toggle('empty', board[p][idx] === 0);
    }
  }
  highlightPlayable();
}

function highlightPlayable() {
  if (gameOver) return;
  for (let idx = 0; idx < 7; idx++) {
    const pit = document.getElementById(`pit-${currentPlayer}-${idx}`);
    if (pit && board[currentPlayer][idx] > 0) pit.classList.add('playable');
  }
}

function updateScores() {
  document.getElementById('score-north').textContent = scores[0];
  document.getElementById('score-south').textContent = scores[1];
  document.getElementById('score-north-box').classList.toggle('active', currentPlayer === 0);
  document.getElementById('score-south-box').classList.toggle('active', currentPlayer === 1);
  document.getElementById('sb-wins1').textContent = wins[0];
  document.getElementById('sb-wins2').textContent = wins[1];
}

function updateStats() {
  const total = board[0].reduce((a,b)=>a+b,0) + board[1].reduce((a,b)=>a+b,0);
  document.getElementById('total-seeds').textContent = total;
  document.getElementById('move-count').textContent  = moveCount;
}

function setMessage(msg, type='') {
  const box = document.getElementById('message-box');
  box.className = 'message-box' + (type ? ' '+type : '');
  document.getElementById('message').textContent = msg;
}

function updateHistory() {
  const ul = document.getElementById('history-list');
  ul.innerHTML = '';
  [...history].reverse().forEach(h => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="hist-coup">${h.player}</span> — C${h.case+1} (${h.seeds} graines)`
      + (h.captures ? ` 🌾 +${h.captures}` : '');
    ul.appendChild(li);
  });
}

function toggleHistory() {
  historyOpen = !historyOpen;
  document.getElementById('history-panel').classList.toggle('open', historyOpen);
}

/* ============================================================
   CLIC SUR UNE CASE
============================================================ */
function onPitClick(player, idx) {
  if (isAnimating) return;
  if (gameOver)    return;
  if (player !== currentPlayer) {
    setMessage(`⚠️ C'est au tour de ${playerNames[currentPlayer]} !`);
    return;
  }
  if (board[player][idx] === 0) {
    setMessage('⚠️ Case vide — choisissez une autre case.');
    return;
  }

  // Règle de solidarité
  const adverse = 1 - player;
  if (campVide(adverse)) {
    if (!atteignAdverse(player, idx, board[player][idx])) {
      setMessage(`⚠️ Solidarité : jouez un coup qui envoie des graines chez ${playerNames[adverse]} !`);
      return;
    }
  }

  // Sauvegarder pour annulation
  undoStack.push({
    board:           board.map(r => [...r]),
    scores:          [...scores],
    currentPlayer,
    moveCount,
    historySnapshot: [...history]
  });
  document.getElementById('btn-undo').disabled = false;

  isAnimating = true;
  distributeAnimated(player, idx);
}

/* ============================================================
   DISTRIBUTION ANIMÉE GRAINE PAR GRAINE
============================================================ */
function distributeAnimated(player, startIdx) {
  const seeds        = board[player][startIdx];
  const sauterDepart = seeds > 13;
  const sequence     = genererSequence(player, startIdx, seeds, sauterDepart);

  // Vider la case de départ
  board[player][startIdx] = 0;
  const startPit = document.getElementById(`pit-${player}-${startIdx}`);
  if (startPit) {
    startPit.textContent = 0;
    startPit.classList.add('empty');
    startPit.classList.remove('playable');
  }

  let step = 0;

  function nextStep() {
    if (step >= sequence.length) {
      // === FIN DE DISTRIBUTION ===
      finDistribution(player, startIdx, seeds, sequence);
      return;
    }

    // Déposer une graine dans la case suivante
    const pos = sequence[step];
    board[pos.camp][pos.idx]++;
    playSeed();

    const pit = document.getElementById(`pit-${pos.camp}-${pos.idx}`);
    if (pit) {
      pit.textContent = board[pos.camp][pos.idx];
      pit.classList.remove('empty');
      pit.classList.add('distributing');
      setTimeout(() => pit.classList.remove('distributing'), 180);
    }

    step++;
    setTimeout(nextStep, 150);
  }

  nextStep();
}

/* ============================================================
   FIN DE DISTRIBUTION — prises, changement de tour
============================================================ */
function finDistribution(player, startIdx, seeds, sequence) {
  const adverse  = 1 - player;
  const derniere = sequence[sequence.length - 1];
  const prises   = calculerPrises(player, adverse, derniere);

  if (prises > 0) {
    playCapture();
    effectuerPrises(player, adverse, derniere);
    scores[player] += prises;
    const capPit = document.getElementById(`pit-${adverse}-${derniere.idx}`);
    if (capPit) capPit.classList.add('captured');
    setMessage(`🌾 ${playerNames[player]} capture ${prises} graine(s) !`, 'capture');
  } else {
    setMessage(`${playerNames[player]} joue C${startIdx+1} (${seeds} graines). Aucune prise.`);
  }

  // Historique
  history.push({ player: playerNames[player], case: startIdx, seeds, captures: prises });
  if (history.length > 5) history.shift();
  moveCount++;
  updateStats();
  updateHistory();

  // === PASSER AU JOUEUR SUIVANT ===
  currentPlayer = adverse;

  refreshBoard();
  updateScores();

  // Vérifier fin de partie
  const fin = checkEndGame();
  if (fin.over) {
    endGame(fin);
    isAnimating = false;
    return;
  }

  isAnimating = false;

  // Tour de la machine ?
  if (gameMode === 'ai' && currentPlayer === 0) {
    setTimeout(aiPlay, 900);
  }
}

/* ============================================================
   PRISES
============================================================ */
function calculerPrises(player, adverse, derniere) {
  // Prise uniquement dans le camp adverse
  if (derniere.camp !== adverse) return 0;

  let total = 0;
  let idx   = derniere.idx;

  // Avec le cycle unique Nord[0..6] → Sud[6..0] :
  //   Joueur Nord (0) arrive chez Sud en idx décroissant (C7→C1, idx 6→0)
  //     → remonte en chaîne vers C7, donc idx croissant (idx++)
  //   Joueur Sud (1) arrive chez Nord en idx croissant (C1→C7, idx 0→6)
  //     → remonte en chaîne vers C1, donc idx décroissant (idx--)

  if (player === 0) {
    // Remontée vers C7 (idx croissant) dans le camp Sud
    while (idx <= 6) {
      const val = board[adverse][idx];
      if (val >= 2 && val <= 4) {
        if (idx === 6 && total === 0) break; // C7 adverse : pas de capture directe
        total += val;
        idx++;
      } else break;
    }
  } else {
    // Remontée vers C1 (idx décroissant) dans le camp Nord
    while (idx >= 0) {
      const val = board[adverse][idx];
      if (val >= 2 && val <= 4) {
        if (idx === 0 && total === 0) break; // C1 adverse : pas de capture directe
        total += val;
        idx--;
      } else break;
    }
  }

  // Interdiction de vider complètement le camp adverse
  const totalAdverse = board[adverse].reduce((a,b) => a+b, 0);
  if (total >= totalAdverse) return 0;

  return total;
}

function effectuerPrises(player, adverse, derniere) {
  let idx = derniere.idx;
  if (player === 0) {
    // Remontée vers C7 (idx croissant) dans le camp Sud
    while (idx <= 6) {
      const val = board[adverse][idx];
      if (val >= 2 && val <= 4) {
        board[adverse][idx] = 0;
        const pit = document.getElementById(`pit-${adverse}-${idx}`);
        if (pit) { pit.textContent = 0; pit.classList.add('empty'); }
        idx++;
      } else break;
    }
  } else {
    // Remontée vers C1 (idx décroissant) dans le camp Nord
    while (idx >= 0) {
      const val = board[adverse][idx];
      if (val >= 2 && val <= 4) {
        board[adverse][idx] = 0;
        const pit = document.getElementById(`pit-${adverse}-${idx}`);
        if (pit) { pit.textContent = 0; pit.classList.add('empty'); }
        idx--;
      } else break;
    }
  }
}

/* ============================================================
   FIN DE PARTIE
============================================================ */
function checkEndGame() {
  if (scores[0] >= 40) return { over:true, winner:0 };
  if (scores[1] >= 40) return { over:true, winner:1 };

  const total = board[0].reduce((a,b)=>a+b,0) + board[1].reduce((a,b)=>a+b,0);
  if (total < 10) {
    scores[0] += board[0].reduce((a,b)=>a+b,0);
    scores[1] += board[1].reduce((a,b)=>a+b,0);
    board = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
    const w = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
    return { over:true, winner:w };
  }

  // Solidarité impossible
  const adverse = 1 - currentPlayer;
  if (campVide(adverse)) {
    let peutNourrir = false;
    for (let i = 0; i < 7; i++) {
      if (board[currentPlayer][i] > 0 && atteignAdverse(currentPlayer, i, board[currentPlayer][i])) {
        peutNourrir = true; break;
      }
    }
    if (!peutNourrir) {
      scores[0] += board[0].reduce((a,b)=>a+b,0);
      scores[1] += board[1].reduce((a,b)=>a+b,0);
      board = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
      const w = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : -1;
      return { over:true, winner:w };
    }
  }

  return { over:false };
}

function endGame(fin) {
  gameOver = true;
  if (fin.winner >= 0) wins[fin.winner]++;

  refreshBoard();
  updateScores();

  document.getElementById('v-score1').textContent = scores[0];
  document.getElementById('v-score2').textContent = scores[1];
  document.getElementById('v-name1').textContent  = playerNames[0];
  document.getElementById('v-name2').textContent  = playerNames[1];
  document.getElementById('sb-wins1').textContent = wins[0];
  document.getElementById('sb-wins2').textContent = wins[1];

  const titre = document.getElementById('victory-title');
  const msg   = document.getElementById('victory-msg');

  if (fin.winner === -1) {
    titre.textContent = '🤝 Égalité !';
    msg.textContent   = 'Aucun vainqueur — partie nulle.';
  } else {
    titre.textContent = `🏆 ${playerNames[fin.winner]} gagne !`;
    msg.textContent   = `Félicitations ! ${scores[fin.winner]} graines capturées.`;
  }

  launchConfetti();
  setTimeout(() => openModal('victory-modal'), 700);
  setMessage('🏁 Fin de partie !', 'game-over');
}

/* ============================================================
   CONFETTIS
============================================================ */
function launchConfetti() {
  const zone   = document.getElementById('confetti-zone');
  zone.innerHTML = '';
  const colors = ['#f5c842','#ef4444','#22c55e','#3b82f6','#f97316','#a855f7'];
  for (let i = 0; i < 55; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `
      left:${Math.random()*100}%;
      top:-12px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      width:${6+Math.random()*8}px;
      height:${6+Math.random()*8}px;
      border-radius:${Math.random()>.5?'50%':'2px'};
      animation-duration:${.8+Math.random()*1.4}s;
      animation-delay:${Math.random()*.6}s;
    `;
    zone.appendChild(p);
  }
}

/* ============================================================
   ANNULER LE DERNIER COUP
============================================================ */
function undoMove() {
  if (undoStack.length === 0 || isAnimating) return;
  const saved   = undoStack.pop();
  board         = saved.board;
  scores        = saved.scores;
  currentPlayer = saved.currentPlayer;
  moveCount     = saved.moveCount;
  history       = saved.historySnapshot;
  gameOver      = false;
  isAnimating   = false;

  refreshBoard();
  updateScores();
  updateStats();
  updateHistory();
  setMessage(`↩️ Coup annulé — à ${playerNames[currentPlayer]} de rejouer.`);
  document.getElementById('btn-undo').disabled = undoStack.length === 0;
}

/* ============================================================
   IA (Machine = Nord, joueur 0)
============================================================ */
function aiPlay() {
  if (gameOver || currentPlayer !== 0) return;

  // Stratégie : case qui peut capturer, sinon case avec le plus de graines
  let bestIdx = -1, bestVal = -1;
  for (let i = 0; i < 7; i++) {
    if (board[0][i] === 0) continue;
    const seq = genererSequence(0, i, board[0][i], board[0][i] > 13);
    const dern = seq[seq.length - 1];
    const prises = calculerPrises(0, 1, dern);
    if (prises > bestVal) { bestVal = prises; bestIdx = i; }
  }
  // Si aucune prise possible, prendre la case avec le plus de graines
  if (bestVal === 0) {
    for (let i = 0; i < 7; i++) {
      if (board[0][i] > bestVal) { bestVal = board[0][i]; bestIdx = i; }
    }
  }
  if (bestIdx === -1) return;

  setMessage(`🤖 ${playerNames[0]} réfléchit...`);

  undoStack.push({
    board:           board.map(r => [...r]),
    scores:          [...scores],
    currentPlayer,
    moveCount,
    historySnapshot: [...history]
  });
  document.getElementById('btn-undo').disabled = false;

  isAnimating = true;
  setTimeout(() => distributeAnimated(0, bestIdx), 600);
}

/* ============================================================
   UTILITAIRES
============================================================ */
function campVide(player) {
  return board[player].every(v => v === 0);
}

function atteignAdverse(player, idx, seeds) {
  // Avec le cycle unique Nord[0..6] → Sud[6..0] :
  //   Joueur Nord (0) : cases restantes dans son camp = 6 - idx (va de idx vers Nord[6])
  //   Joueur Sud (1)  : cases restantes dans son camp = idx     (va de idx vers Sud[0], idx décroissant)
  if (player === 0) return seeds > (6 - idx);
  else              return seeds > idx;
}

/* ============================================================
   LANCEMENT
============================================================ */
showScreen('screen-welcome');
