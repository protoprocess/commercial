/* =============================================================================
   Proto Process — Module commun « Fiche de vie »
   Version 1.0 — 02/08/2026

   POURQUOI CE FICHIER EXISTE
   Deux ecrans montraient la meme fiche par deux chemins differents : l onglet de
   devis-client et l appli fiche-de-vie. Le 02/08, sur trois defauts constates en
   une soiree, DEUX venaient d une meme regle ecrite a deux endroits. Ce module
   supprime la cause : la fiche est rendue ici, une seule fois, pour les deux.

   CE QU IL PORTE  : lecture, filtres, journal par metier, saisie, reponse, photo.
   CE QU IL NE PORTE PAS : ce qui est propre a un hote — les cases a cocher de la
   nomenclature et le rattachement dans devis-client, le choix de la carte dans
   l appli. La verite de la nomenclature appartient a Luminovo, elle n a rien a
   faire ici : on remonte un POINT sur une ligne, jamais la ligne elle-meme.

   CACHE NAVIGATEUR — PIEGE A CONNAITRE
   Un fichier partage est mis en cache. Sans precaution, une correction ne se voit
   pas et on conclut a tort qu elle n a pas ete faite. Deux parades, les deux
   posees : les hotes appellent ce fichier avec ?v=<version>, et la version est
   AFFICHEE en pied de fiche. Si l ecran ne montre pas la version attendue, c est
   le cache — pas le code.

   APPEL
     PPFicheDeVie.monter({
       cible:        'p-fiche',          // id du conteneur
       base:         'https://.../webhook',
       produitId:    () => 278,          // fonction, la carte peut changer
       repondre:     false,              // devis-client POSE des questions,
                                         // il n y repond pas : c est le geste
                                         // de l appli fiche de vie (02/08)
       choixMetier:  false,              // au devis tout part en DEVIS
       etapeDefaut:  'DEVIS',
       source:       'devis-client',
       sansCarte:    '<p>…</p>',         // affiche s il n y a pas de carte
       onCompteur:   n => {}             // pour un badge cote hote
     });
   ========================================================================== */
(function (global) {
'use strict';

var VERSION = '1.7';
var DATE = '02/08/2026';

/* --- etat interne. Un seul montage a la fois par page : les deux hotes n en
   affichent qu un. Tout passe par cet objet, rien n est lu dans l hote. ------ */
var O = null;           // options du montage
var D = null;           // derniere lecture du webhook
var chargee = false;
var filtre = 'tous';
var ouverts = {};       // metiers deplies
var poles = [];         // poles coches dans le formulaire
var pieces = [];        // pieces jointes deja deposees : { chemin, nom, type }
var enCours = false;    // un envoi est en route
// Contexte de depot : '0' pour la note principale, sinon l id de la question a
// laquelle on repond. Les identifiants du DOM en decoulent — sans cela la zone de
// reponse et le formulaire principal portaient les MEMES id, getElementById
// renvoyait le premier trouve, et l apercu comme les messages d erreur
// s ecrivaient dans une zone repliee donc invisible (bug du 02/08).
var ctxDepot = '0';
var rangement = null;   // { id, etape, poles } de l entree en cours de rangement
var amorces = [];
var CLE_QUI = 'pp_fdv_initiales';   // meme cle que l appli atelier : les
                                    // initiales suivent l operateur, pas l ecran
// Liste fermee. Les postes sont PARTAGES a l atelier : un champ libre pre-rempli
// ferait signer par le precedent operateur sans que personne s en apercoive.
// A passer en base le jour ou l equipe bouge souvent (meme logique que ref_etapes).
var EQUIPE = ['OC','AC','MM','DG','SG','FR','JM','BL','MD','SS','VF','AP'];

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function el(id){ return document.getElementById(id); }
function cible(){ return el(O.cible); }

function qui(){ try { return localStorage.getItem(CLE_QUI) || ''; } catch(e){ return ''; } }
function setQui(v){ try { localStorage.setItem(CLE_QUI, v); } catch(e){} }

function produitId(){
  var v = (typeof O.produitId === 'function') ? O.produitId() : O.produitId;
  v = parseInt(v, 10);
  return (v > 0) ? v : null;
}

/* --- CSS injecte par le module lui-meme. Un fichier .css separe pourrait etre
   oublie par un hote, et le rendu casserait sans le moindre message. Ici c est
   impossible : le style arrive avec le code. Palette et regles conformes a la
   charte v1.1 — liseres plutot que fonds teintes en alpha, texte clair sur fond
   sombre, texte fonce uniquement dans une pastille a fond pastel. ---------- */
function css(){
  if (el('pp-fdv-css')) return;
  var s = document.createElement('style');
  s.id = 'pp-fdv-css';
  s.textContent = [
    '.fdv-t{margin:12px 0 6px;font-size:11px;font-weight:600;letter-spacing:.04em;',
    '  text-transform:uppercase;color:var(--text3)}',
    '.fdv-e{padding:8px 11px;margin-bottom:6px;background:var(--surface2);',
    '  border-left:3px solid var(--border2);font-size:12.5px}',
    '.fdv-e.fdv-att{border-left-color:var(--amber-badge)}',
    '.fdv-e.fdv-cli{border-left-color:var(--green-badge)}',
    '.fdv-props{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px}',
    // Amorces volontairement NEUTRES : ce ne sont que des suggestions de
    // formulation. L ambre est reserve a ce qui est SELECTIONNE — metier, pole,
    // destination — car choisir le bon metier est le geste qui compte.
    '.fdv-p{border:1px solid var(--border);background:var(--surface);color:var(--text2);',
    '  border-radius:20px;padding:4px 11px;font-size:11.5px;cursor:pointer}',
    '.fdv-p:hover{border-color:var(--border2);color:var(--text)}',
    '.fdv-c{border:1px solid var(--border);background:var(--surface);color:var(--text2);',
    '  border-radius:20px;padding:5px 13px;font-size:11.5px;cursor:pointer;user-select:none}',
    '.fdv-c:hover{border-color:var(--border2);color:var(--text)}',
    '.fdv-c.on{background:var(--amber-bg);color:var(--amber-badge);border-color:transparent;',
    '  font-weight:600}',
    '.fdv-l{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px}',
    '.fdv-rep{margin-top:9px;padding-top:9px;border-top:1px solid var(--border)}',
    '.fdv-m{border-bottom:1px solid var(--border)}',
    '.fdv-mh{display:flex;align-items:center;gap:8px;padding:9px 2px;cursor:pointer;',
    '  font-size:12px;font-weight:500;color:var(--text2);user-select:none}',
    '.fdv-mh:hover{color:var(--text)}',
    '.fdv-mn{padding:1px 9px;border-radius:20px;background:var(--blue-bg);',
    '  color:var(--blue);font-size:11px;font-weight:600}',
    '.fdv-dz{margin-top:9px;padding:14px;border:1px dashed var(--border2);border-radius:6px;',
    '  text-align:center;font-size:12px;color:var(--text3);cursor:pointer}',
    '.fdv-dz:hover,.fdv-dz.over{border-color:var(--blue);color:var(--text2)}',
    '.fdv-pv{display:flex;gap:11px;align-items:flex-start;margin-top:9px;padding:9px;',
    '  border-radius:6px;background:var(--surface2)}',
    '.fdv-pv img{width:64px;height:64px;object-fit:cover;border-radius:6px;flex:none}',
    '.fdv-ic{width:38px;height:38px;flex:none;display:flex;align-items:center;',
    '  justify-content:center;border-radius:6px;background:var(--surface);',
    '  color:var(--blue);font-size:18px}',
    '.fdv-b-att{background:var(--amber-bg);color:var(--amber-badge)}',
    '.fdv-b-ok{background:var(--green-bg);color:var(--green-badge)}',
    '.fdv-b-cli{background:var(--green-bg);color:var(--green-badge)}',
    '#pp-fdv-ver{margin-top:10px;font-size:10.5px;color:var(--text3);text-align:right}',
    // .card h2 des hotes a une specificite superieure a .fdv-h : le titre gardait
    // 13 px et sa couleur d origine. Deux niveaux ici, la regle passe partout.
    '.card h2.fdv-h,h2.fdv-h{font-size:17px;font-weight:600;color:var(--blue);',
    '  display:flex;align-items:center;gap:8px;margin-bottom:4px}',
    // Classes autrefois empruntees a l hote. Absentes cote atelier, elles y
    // rendaient le repli sans effet. Le module les porte maintenant lui-meme.
    '.fdv-hide{display:none!important}',
    '.fdv-fb{border:1px solid var(--border);background:var(--surface);color:var(--text2);',
    '  border-radius:20px;padding:5px 12px;font-size:11.5px;cursor:pointer;font-family:inherit}',
    '.fdv-fb.active{background:var(--blue);color:#fff;border-color:transparent}',
    '.fdv-bd{display:inline-block;padding:1px 8px;border-radius:20px;font-size:10.5px;font-weight:600}',
    '.fdv-spin{display:inline-block;width:11px;height:11px;border:2px solid var(--border2);',
    '  border-top-color:var(--blue);border-radius:50%;animation:fdvspin .7s linear infinite;',
    '  vertical-align:-1px;margin-right:5px}',
    '@keyframes fdvspin{to{transform:rotate(360deg)}}',
    '.fdv-h2{font-size:14px;font-weight:600;color:var(--blue);margin:0 0 10px;',
    '  display:flex;align-items:center;gap:7px}',
    '.fdv-saisie{background:var(--surface2);border:1px solid var(--border2)}',
    '.fdv-f2{display:block;font-size:12.5px;font-weight:600;color:var(--blue);margin:12px 0 6px}',
    '.fdv-zone textarea,.fdv-zone input,.fdv-zone select{background:var(--surface);',
    '  border:1px solid var(--border);color:var(--text);border-radius:6px;',
    '  padding:7px 10px;font-size:12.5px;font-family:inherit;width:100%}',
    '.fdv-zone textarea{resize:vertical}',
    '.fdv-zone input,.fdv-zone select{width:auto}',
    '.fdv-r{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:9px}',
    '.fdv-r>div{flex:1;min-width:110px}',
    '.fdv-f{display:block;font-size:11px;color:var(--text3);margin-bottom:3px}',
    '.fdv-zone .fdv-r input{width:100%}',
    '.fdv-ck2{display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12.5px;',
    '  color:var(--text2);margin-top:9px}',
    '.fdv-ck2 input{width:auto;accent-color:var(--blue)}'
  ].join('\n');
  document.head.appendChild(s);
}

/* ---------------------------------------------------------------- lecture -- */
function invalider(){ chargee = false; D = null; }

function charger(){
  var z = cible();
  if (!z) return Promise.resolve();
  var id = produitId();

  // Sans carte, rien n est ecrivable : produit_id est NOT NULL et le workflow
  // refuse l entree. On le dit et on renvoie l hote a son propre chemin, plutot
  // que de garder un brouillon cote navigateur qui se perdrait sans signal.
  if (!id){
    z.innerHTML = O.sansCarte || '<div class="card"><p class="hint" style="margin:0">' +
      'Aucune carte sélectionnée.</p></div>';
    return Promise.resolve();
  }

  z.innerHTML = '<div class="card"><h2><i class="ti ti-notebook"></i> Fiche de vie</h2>' +
    '<p style="margin:0;color:var(--text2)"><span class="fdv-spin"></span> Lecture du journal\u2026</p></div>';

  return fetch(O.base + '/fiche-de-vie?produit=' + encodeURIComponent(id))
    .then(function(r){ return r.json().catch(function(){ return null; })
      .then(function(j){
        if (!r.ok || !j || j.ok !== true) throw new Error((j && j.motif) || ('HTTP ' + r.status));
        D = j; chargee = true; rendre();
      });
    })
    .catch(function(e){
      z.innerHTML = '<div class="card"><h2><i class="ti ti-notebook"></i> Fiche de vie</h2>' +
        '<p style="margin:0 0 9px;color:var(--red)">Journal indisponible : ' + esc(e.message) + '</p>' +
        '<button class="btn-s" onclick="PPFicheDeVie.recharger()">' +
        '<i class="ti ti-refresh"></i> Réessayer</button></div>';
    });
}

/* ----------------------------------------------------------------- filtres -- */
/* Cinq filtres. Separer ce qui attend le CLIENT de ce qui attend PP evite de
   croire que la balle est dans son camp alors qu elle est dans le notre. */
function garde(e, f){
  var flt = (f === undefined) ? filtre : f;
  if (!flt || flt === 'tous') return true;
  if (flt === 'attente_pp')     return e.etat === 'en_attente' && e.visible_client !== true;
  if (flt === 'attente_client') return e.etat === 'en_attente' && e.visible_client === true;
  if (flt === 'resolu')         return e.etat === 'resolu';
  if (flt === 'client')         return e.visible_client === true;
  return true;
}

function barreFiltres(){
  var tous = (D && D.entrees) || [];
  if (!tous.length) return '';
  // NE JAMAIS passer garde directement a filter : filter fournit (element, INDEX,
  // tableau) et le deuxieme argument deviendrait un nombre. Bug du 02/08, qui a
  // rendu les filtres totalement inoperants tout en laissant les compteurs justes.
  var cpt = function(f){ return tous.filter(function(e){ return garde(e, f); }).length; };
  var l = [['tous','Tout'],['attente_pp','À résoudre chez nous'],
           ['attente_client','Attend le client'],['resolu','Résolu'],['client','Visible client']]
    .filter(function(x){ return x[0] === 'tous' || cpt(x[0]) > 0; });
  return '<div style="display:flex;gap:6px;flex-wrap:wrap">' + l.map(function(x){
    return '<button class="fdv-fb' + (filtre === x[0] ? ' active' : '') +
      '" onclick="PPFicheDeVie.filtrer(\'' + x[0] + '\')">' + esc(x[1]) +
      ' <span style="opacity:.7">' + cpt(x[0]) + '</span></button>';
  }).join('') + '</div>';
}

/* ----------------------------------------------------------------- journal -- */
function meta(e){
  var b = [];
  if (e.auteur) b.push(esc(e.auteur));
  if (e.indice) b.push(esc(e.indice));
  if (e.repere) b.push(esc(e.repere));
  if (e.mpn) b.push(esc(e.mpn));
  if (e.cree_le){ try { b.push(new Date(e.cree_le).toLocaleDateString('fr-FR')); } catch(x){} }
  return b.join(' \u00b7 ');
}

/* Une seule fonction rend toutes les entrees : c est l ETAT qui commande ce qui
   s affiche, il n y a pas deux familles de lignes a tenir a jour separement. */
/* Liens vers les pieces jointes. Fonction unique, appelee par l entree ET par la
   reponse : les reponses ont leur propre rendu, et cette liste n y figurait pas —
   un fichier joint a une reponse etait donc invisible (constat d Olivier, 02/08).
   L URL de lecture n est PAS demandee au rendu : une fiche de vingt entrees
   declencherait vingt appels n8n a chaque ouverture, pour des pieces que personne
   n ouvrira. Elle est signee AU CLIC, et vaut une heure. */
function piecesLiens(e){
  if (!e || !e.photos || !e.photos.length) return '';
  return '<p style="margin:6px 0 0">' + e.photos.map(function(c){
    var nom = String(c).split('/').pop().replace(/^[a-z0-9]{8}-/, '');
    var img = /\.(jpe?g|png|webp|heic|heif)$/i.test(nom);
    return '<button class="btn-s" style="margin:0 6px 4px 0" onclick="PPFicheDeVie.ouvrirPiece(\'' +
      esc(c) + '\')"><i class="ti ' + (img ? 'ti-photo' : 'ti-file-text') + '"></i> ' +
      esc(nom) + '</button>';
  }).join('') + '</p>';
}

function ligne(e){
  var attend = e.etat === 'en_attente';
  var cli = e.visible_client === true;
  var cls = attend ? 'fdv-att' : (cli ? 'fdv-cli' : '');
  var tag = '';
  if (attend) tag = '<span class="fdv-bd ' + (cli ? 'fdv-b-cli' : 'fdv-b-att') + '">' +
    (cli ? 'attend le client' : 'à traiter') + '</span>';
  else if (e.etat === 'resolu') tag = '<span class="fdv-bd fdv-b-ok">résolu</span>';
  if (cli && !attend) tag += ' <span class="fdv-bd fdv-b-cli">client</span>';

  var h = '<div class="fdv-e ' + cls + '">' +
    '<p style="margin:0 0 3px">' + esc(e.texte_brut || '') + ' ' + tag + '</p>' +
    '<p class="hint" style="margin:0">' + meta(e) + '</p>';

  if (e.poles && e.poles.length)
    h += '<p class="hint" style="margin:2px 0 0">aussi pour : ' + e.poles.map(esc).join(', ') + '</p>';

  h += piecesLiens(e);

  if (e.lien) h += '<a class="btn-s" style="margin-top:7px;text-decoration:none;display:inline-block"' +
    ' target="_blank" href="' + esc(e.lien) + '"><i class="ti ti-external-link"></i> Luminovo</a>';

  // RANGER. Au devis tout part en DEVIS pour ne pas ralentir le chiffrage, et le
  // tri se fait ensuite : sans ce bouton le second temps n existait pas et tout
  // serait reste en DEVIS indefiniment (constat d Olivier, 02/08).
  // Reserve aux hotes qui rangent : devis-client remonte, il ne trie pas.
  if (O.repondre && !e.repond_a){
    h += ' <button class="btn-s" style="margin-top:7px" onclick="PPFicheDeVie.ouvrirRangement(' +
      e.id + ')"><i class="ti ti-arrows-sort"></i> Ranger</button>';
    if (rangement && rangement.id === e.id) h += panneauRangement(e);
  }

  // Repondre n apparait que si l hote l autorise : devis-client POSE des
  // questions et remonte des infos, il n y repond pas (decision d Olivier, 02/08).
  if (attend && O.repondre){
    h += ' <button class="btn-s" style="margin-top:7px" onclick="PPFicheDeVie.ouvrirReponse(' +
      e.id + ',' + cli + ')"><i class="ti ti-corner-down-right"></i> Répondre</button>' +
      '<div class="fdv-rep fdv-zone fdv-hide" id="fdv-rep-' + e.id + '">' +
      '<textarea rows="2" placeholder="Ce qui règle le point\u2026"></textarea>' +
      // Une reponse porte souvent elle-meme une piece : c est frequemment le
      // fabricant qui repond par un tableur (demande d Olivier, 02/08).
      '<div id="fdv-dz-' + e.id + '" class="fdv-dz"' +
      ' onclick="document.getElementById(\'fdv-file-' + e.id + '\').click()"' +
      ' ondragover="event.preventDefault();this.classList.add(\'over\')"' +
      ' ondragleave="this.classList.remove(\'over\')"' +
      ' ondrop="PPFicheDeVie.depot(event, \'' + e.id + '\')">' +
      '<i class="ti ti-paperclip"></i> Joindre un fichier' +
      '<input type="file" id="fdv-file-' + e.id + '" class="fdv-hide"' +
      ' onchange="PPFicheDeVie.depot(event, \'' + e.id + '\')"></div>' +
      '<div id="fdv-photo-' + e.id + '"></div>' +
      '<div class="fdv-l"><button class="btn-p" onclick="PPFicheDeVie.repondre(' + e.id + ')">' +
      '<i class="ti ti-check"></i> Répondre</button>' +
      '<span class="hint fdv-rep-msg"></span></div></div>';
  }
  // Les reponses s affichent SOUS leur question, jamais comme des entrees isolees :
  // une reponse detachee de ce qu elle regle ne veut rien dire. On les cherche dans
  // TOUTES les entrees, car une reponse peut etre rangee dans un autre metier.
  var reps = ((D && D.entrees) || []).filter(function(r){
    return Number(r.repond_a) === Number(e.id);
  });
  reps.forEach(function(r){
    h += '<div class="fdv-e" style="margin:6px 0 0 14px;border-left-color:var(--green-badge)">' +
      '<p style="margin:0 0 3px">' + esc(r.texte_brut || '') + '</p>' +
      '<p class="hint" style="margin:0">' + meta(r) + '</p>' +
      piecesLiens(r) + '</div>';
  });

  return h + '</div>';
}

/* Panneau de rangement. Le metier est le DESTINATAIRE de l entree ; les poles
   sont ceux qui doivent la voir en plus. Le metier choisi n apparait pas dans les
   poles : ce serait un doublon a l affichage. */
function panneauRangement(e){
  var etapes = (D && D.etapes) || [];
  var cur = rangement.etape || e.etape_code || '';
  var ps = rangement.poles || [];

  var h = '<div class="fdv-rep fdv-zone" style="border-top-color:var(--blue)">' +
    '<label class="fdv-f2" style="margin-top:0">Destinataire principal</label>' +
    '<div class="fdv-props">' + etapes.map(function(x){
      return '<span class="fdv-c' + (x.code === cur ? ' on' : '') +
        '" onclick="PPFicheDeVie.rangerEtape(\'' + esc(x.code) + '\')">' + esc(x.libelle) + '</span>';
    }).join('') + '</div>' +
    '<label class="fdv-f2">Doit aussi être vu par</label>' +
    '<div class="fdv-props">' + etapes.filter(function(x){ return x.code !== cur; }).map(function(x){
      return '<span class="fdv-c' + (ps.indexOf(x.code) >= 0 ? ' on' : '') +
        '" onclick="PPFicheDeVie.rangerPole(\'' + esc(x.code) + '\')">' + esc(x.libelle) + '</span>';
    }).join('') + '</div>' +
    '<div class="fdv-l">' +
    '<button class="btn-p" onclick="PPFicheDeVie.rangerValider()"><i class="ti ti-check"></i> Ranger</button>' +
    '<button class="btn-s" onclick="PPFicheDeVie.ouvrirRangement(null)">Annuler</button>' +
    '<span id="fdv-rng-msg" class="hint"></span></div></div>';
  return h;
}

function journal(){
  var tous = (D && D.entrees) || [];
  if (!tous.length) return '<p class="hint" style="margin:10px 0 0">Aucune entrée pour cette carte.</p>';

  var parM = ((D && D.par_metier) || []).map(function(m){
    var c = {}; for (var k in m) c[k] = m[k];
    // Une entree qui repond a une autre n apparait pas seule : elle est rendue
    // sous sa question par ligne(). Sans ce retrait elle s afficherait deux fois.
    c.entrees = (m.entrees || []).filter(function(e){ return !e.repond_a && garde(e); });
    return c;
  }).filter(function(m){ return m.entrees.length; });

  if (!parM.length) return '<p class="hint" style="margin:10px 0 0">Aucune entrée pour ce filtre.</p>';

  // Replie par defaut, meme s il n y a qu un seul metier : arriver sur un fil
  // deroule repousse la zone de saisie hors de l ecran, alors que l AJOUT est le
  // geste principal (80 % des productions sont des cartes neuves).
  // Seul un filtre actif deplie : sinon filtrer semblerait ne rien faire.
  var deplierTout = (filtre && filtre !== 'tous');
  var h = '<div style="margin-top:10px">';
  parM.forEach(function(m){
    var code = m.code || '';
    var ouvert = deplierTout || ouverts[code];
    h += '<div class="fdv-m"><div class="fdv-mh" onclick="PPFicheDeVie.replier(\'' + esc(code) + '\')">' +
      '<i class="ti ti-chevron-' + (ouvert ? 'down' : 'right') + '"></i>' +
      '<span>' + esc(m.libelle || '') + '</span>' +
      '<span class="fdv-mn">' + m.entrees.length + '</span></div>' +
      '<div class="' + (ouvert ? '' : 'fdv-hide') + '">' + m.entrees.map(ligne).join('') + '</div></div>';
  });
  return h + '</div>';
}

/* ------------------------------------------------------------- formulaire -- */
function formulaire(){
  var etapes = (D && D.etapes) || [];
  var etape = O.etapeDefaut || 'DEVIS';
  var props = (D && D.propositions) || {};
  amorces = props[etape] || [];

  var choix = [['note','Information'],
               ['question_interne','À traiter'],
               ['question_client','Question client']];

  var h = '<div class="card fdv-zone fdv-saisie">' +
    '<p class="fdv-h2"><i class="ti ti-plus"></i> Ajouter une note</p>';

  if (O.choixMetier && etapes.length){
    h += '<p class="fdv-t" style="margin-top:0">Pour quel métier ?</p><div class="fdv-props">' +
      etapes.map(function(e){
        return '<span class="fdv-c' + (e.code === etape ? ' on' : '') +
          '" onclick="PPFicheDeVie.choisirEtape(\'' + esc(e.code) + '\')">' + esc(e.libelle) + '</span>';
      }).join('') + '</div>';
  }

  if (amorces.length){
    h += '<div class="fdv-props">' + amorces.map(function(t, i){
      return '<span class="fdv-p" onclick="PPFicheDeVie.amorce(' + i + ')">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }

  h += '<textarea id="fdv-txt" rows="3" placeholder="Ce qu\'il faut retenir sur cette carte\u2026"></textarea>';

  // Champs avances : l appli atelier les a, devis-client non. Le lien est la
  // reponse au fait que la verite de la nomenclature appartient a Luminovo — on
  // pointe vers elle plutot que de la recopier ici.
  if (O.champsAvances){
    h += '<div class="fdv-r" style="margin-top:9px">' +
      '<div style="max-width:130px"><label class="fdv-f">Repère</label>' +
      '<input id="fdv-repere" placeholder="C12" autocomplete="off"></div>' +
      '<div><label class="fdv-f">MPN</label>' +
      '<input id="fdv-mpn" placeholder="Référence fabricant" autocomplete="off"></div>' +
      '<div><label class="fdv-f">Lien (Luminovo, document\u2026)</label>' +
      '<input id="fdv-lien" placeholder="https://\u2026" autocomplete="off"></div></div>';

    if (etapes.length){
      // Une info peut concerner PLUSIEURS metiers : trouvee au chiffrage, elle vise
      // le TRAD mais les METHODES doivent la voir pour la porter au dossier de fab.
      h += '<label class="fdv-f2">Doit aussi être vu par</label><div class="fdv-props">' +
        etapes.filter(function(e){ return e.code !== etape; }).map(function(e){
          return '<span class="fdv-c' + (poles.indexOf(e.code) >= 0 ? ' on' : '') +
            '" onclick="PPFicheDeVie.basculerPole(\'' + esc(e.code) + '\')">' + esc(e.libelle) + '</span>';
        }).join('') + '</div>';
    }
  }

  // Depot d une piece jointe. Pas seulement des photos : un tableur de questions
  // techniques envoye par le fabricant de PCB arrive regulierement et il serait
  // absurde de le retranscrire ligne a ligne (remarque d Olivier, 02/08).
  h += '<div id="fdv-dz-0" class="fdv-dz" onclick="document.getElementById(\'fdv-file-0\').click()"' +
    ' ondragover="event.preventDefault();this.classList.add(\'over\')"' +
    ' ondragleave="this.classList.remove(\'over\')" ondrop="PPFicheDeVie.depot(event, \'0\')">' +
    '<i class="ti ti-paperclip"></i> Glisser un fichier ici, ou cliquer' +
    '<span class="fdv-f" style="margin-top:3px">photo, PDF, tableur, document \u2014 25 Mo maximum</span>' +
    '<input type="file" id="fdv-file-0" class="fdv-hide"' +
    ' onchange="PPFicheDeVie.depot(event, \'0\')"></div><div id="fdv-photo-0"></div>';

  h += '<div class="fdv-props" style="margin-top:9px">' + choix.map(function(c){
    return '<span class="fdv-c' + (O._type === c[0] ? ' on' : '') +
      '" onclick="PPFicheDeVie.choisirType(\'' + c[0] + '\')">' + esc(c[1]) + '</span>';
  }).join('') + '</div>';

  // La case n apparait QUE pour une note. Sur une question, la visibilite decoule
  // du type depuis le 02/08 — une question au client lui est visible par
  // construction, une question interne ne sort jamais. Laisser la case cochable
  // ferait croire a un choix qui n existe plus, et elle mentirait une fois sur deux.
  if (O.champsAvances && O._type === 'note'){
    h += '<label class="fdv-ck2"><input type="checkbox" id="fdv-cli"' +
      (O._visibleClient ? ' checked' : '') + ' onchange="PPFicheDeVie.basculerVisible(this.checked)">' +
      '<span><i class="ti ti-eye"></i> Visible par le client</span></label>';
  }

  // Postes partages a l atelier : l identite est choisie dans une liste fermee et
  // le bouton reste inactif tant qu elle n est pas renseignee. Un champ libre
  // pre-rempli ferait signer par le precedent operateur, sans le moindre signal.
  var moi = qui();
  var liste = (O.equipe || EQUIPE);
  if (moi && liste.indexOf(moi) < 0) liste = liste.concat([moi]);
  h += '<label class="fdv-f2">Vos initiales</label>' +
    '<div class="fdv-l" style="margin-top:0">' +
    '<select id="fdv-auteur" onchange="PPFicheDeVie.choisirAuteur(this.value)">' +
    '<option value=""' + (moi ? '' : ' selected') + '>\u2014 choisir \u2014</option>' +
    liste.map(function(i){
      return '<option value="' + esc(i) + '"' + (i === moi ? ' selected' : '') + '>' + esc(i) + '</option>';
    }).join('') + '</select>' +
    '<button class="btn-p" id="fdv-ok" onclick="PPFicheDeVie.enregistrer()"' +
      (moi ? '' : ' disabled title="Choisissez d\'abord vos initiales"') + '>' +
    '<i class="ti ti-check"></i> Enregistrer</button>' +
    '<span id="fdv-msg" class="hint"></span></div>';

  return h + '</div>';
}

/* ------------------------------------------------------------------ rendu -- */
function rendre(){
  var z = cible(); if (!z) return;
  var p = (D && D.produit) || {};

  // Une seule liste, filtrable, placee DIRECTEMENT sous les filtres. Une carte
  // « En suspens » separee ferait doublon avec le filtre, et le filtre semblerait
  // sans effet puisqu il piloterait une liste releguee plus bas.
  var h = '<div class="card"><h2 class="fdv-h"><i class="ti ti-notebook"></i> Fiche de vie</h2>' +
    '<p class="hint" style="margin:0 0 10px">' + esc(p.cle_produit || '') +
      (p.libelle_carte ? ' \u2014 ' + esc(p.libelle_carte) : '') +
      (p.nom_client ? ' \u00b7 ' + esc(p.nom_client) : '') + '</p>' +
    barreFiltres() + journal() +
    '<div id="pp-fdv-ver">module v' + VERSION + ' \u2014 ' + DATE + '</div></div>';

  h += formulaire();
  z.innerHTML = h;

  if (typeof O.onCompteur === 'function'){
    O.onCompteur((D && D.nb_en_attente) || 0);
  }
}

/* ------------------------------------------------------------- ecriture --- */
function auteur(){
  var e = el('fdv-auteur');
  var v = e ? (e.value || '').trim() : '';
  if (v) setQui(v);
  return v || null;
}

// Une reponse est signee comme une note : meme exigence, meme liste.
function auteurOuStop(msg){
  var v = auteur();
  if (!v && msg) msg.innerHTML = '<span style="color:var(--amber)">Choisissez d\'abord vos initiales.</span>';
  return v;
}

/* Une seule porte vers le webhook. Deux fonctions paralleles qui postent la meme
   chose finissent toujours par diverger — piege deja paye ici. L appli n envoie
   JAMAIS etat ni visible_client : le workflow les deduit du type. */
function poster(corps){
  return fetch(O.base + '/fiche-de-vie-ajout', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(corps)
  }).then(function(r){
    return r.json().catch(function(){ return null; }).then(function(j){
      // Un HTTP 200 ne prouve rien : le workflow rend ok:false avec un motif
      // quand rien n a ete ecrit. C est cette cle qui fait foi.
      if (!r.ok || !j || j.ok !== true) throw new Error((j && j.motif) || ('HTTP ' + r.status));
      return j;
    });
  });
}

/* ------------------------------------------------------------------ photo -- */
/* La compression est le vrai morceau : sur le plan Supabase free, 1 Go de
   fichiers represente environ 300 photos brutes de telephone contre plusieurs
   milliers a 1600 px. Elle est prete ; il ne manquera que l envoi. */
function compresser(file, maxCote, qualite){
  maxCote = maxCote || 1600; qualite = qualite || 0.8;
  return new Promise(function(res, rej){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      var r = Math.min(1, maxCote / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ b ? res(b) : rej(new Error('Compression impossible.')); },
        'image/jpeg', qualite);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); rej(new Error('Image illisible.')); };
    img.src = url;
  });
}

function estImage(f){ return /^image\//.test(f.type || ''); }

/* Envoi en deux temps : n8n fabrique une URL signee, puis le navigateur pousse le
   fichier DIRECTEMENT vers le stockage. Le fichier ne transite pas par n8n, dont
   le quota d executions est deja bien entame et qui plafonne a 120 s par appel. */
function envoyerPiece(fichier){
  var nom = fichier.name || 'piece';
  return fetch(O.base + '/fiche-de-vie-piece', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ produit_id: produitId(), nom: nom })
  }).then(function(r){
    return r.json().catch(function(){ return null; }).then(function(j){
      if (!r.ok || !j || j.ok !== true) throw new Error((j && j.motif) || ('HTTP ' + r.status));
      // Le type est celui deduit de l EXTENSION par n8n, pas celui declare par le
      // navigateur : un .xls est souvent annonce en application/octet-stream, que
      // le bucket refuserait avec un message incomprehensible.
      return fetch(j.url, {
        method: 'PUT',
        headers: {'Content-Type': j.type},
        body: fichier
      }).then(function(up){
        if (!up.ok) throw new Error('Envoi refusé par le stockage (' + up.status + ').');
        return { chemin: j.chemin, nom: nom, type: j.type };
      });
    });
  });
}

function estImageType(t){ return /^image\//.test(t || ''); }

function piecesRendu(erreur){
  var z = el('fdv-photo-' + ctxDepot); if (!z) return;
  var h = '';
  if (enCours) h += '<p class="hint" style="margin:6px 0 0"><span class="fdv-spin"></span> Envoi en cours\u2026</p>';
  if (erreur) h += '<p class="hint" style="color:var(--red);margin:6px 0 0">' + esc(erreur) + '</p>';
  pieces.forEach(function(p, i){
    h += '<div class="fdv-pv">' +
      '<div class="fdv-ic"><i class="ti ' + (estImageType(p.type) ? 'ti-photo' : 'ti-file-text') + '"></i></div>' +
      '<div><p style="margin:0;font-size:12px">' + esc(p.nom) + '</p>' +
      '<p class="hint" style="margin:2px 0 0">déposé, sera joint à la note</p></div>' +
      '<button class="btn-s" onclick="PPFicheDeVie.retirerPiece(' + i + ')">Retirer</button></div>';
  });
  z.innerHTML = h;
}

/* ------------------------------------------------------------------- API --- */
global.PPFicheDeVie = {
  VERSION: VERSION,
  DATE: DATE,

  monter: function(opts){
    O = opts || {};
    if (O._type === undefined) O._type = 'note';
    css();
    filtre = 'tous'; ouverts = {}; poles = []; pieces = []; enCours = false; ctxDepot = '0';
    rangement = null;
    return charger();
  },

  // Rechargement force : a appeler quand la carte change cote hote.
  recharger: function(){ invalider(); return charger(); },
  invalider: invalider,
  chargee: function(){ return chargee; },

  // Lecture seule des donnees deja chargees. Un hote peut avoir besoin des
  // amorces d un metier (la barre BOM de devis-client s en sert pour ses motifs)
  // sans avoir a refaire l appel ni a fouiller dans l etat interne du module.
  propositions: function(code){
    var p = (D && D.propositions) || {};
    return (code ? p[code] : p) || (code ? [] : {});
  },
  donnees: function(){ return D; },
  produitId: produitId,
  poster: poster,           // utilise par la barre BOM de devis-client
  compresser: compresser,

  filtrer: function(f){ filtre = f; rendre(); },
  replier: function(code){ ouverts[code] = !ouverts[code]; rendre(); },
  choisirType: function(v){ O._type = v; rendre(); },
  choisirAuteur: function(v){
    if (v) setQui(v);
    var b = el('fdv-ok');
    if (b){ b.disabled = !v; if (v) b.removeAttribute('title'); }
  },
  basculerVisible: function(b){ O._visibleClient = !!b; },
  basculerPole: function(code){
    var i = poles.indexOf(code);
    if (i >= 0) poles.splice(i, 1); else poles.push(code);
    rendre();
  },
  choisirEtape: function(c){ O.etapeDefaut = c; rendre(); },

  amorce: function(i){
    var t = amorces[i]; if (t == null) return;
    var z = el('fdv-txt'); if (!z) return;
    z.value = z.value ? (z.value.replace(/\s*$/, '') + ' \u2014 ' + t) : (t + ' : ');
    z.focus();
  },

  depot: function(ev, ctx){
    ev.preventDefault();
    ctxDepot = String(ctx || '0');
    var dz = el('fdv-dz-' + ctxDepot); if (dz) dz.classList.remove('over');
    var f = (ev.dataTransfer && ev.dataTransfer.files[0]) ||
            (ev.target && ev.target.files && ev.target.files[0]);
    if (!f) return;
    if (!produitId()){ piecesRendu('Aucune carte sélectionnée.'); return; }

    enCours = true; piecesRendu();
    // La compression ne vaut QUE pour les images : un tableur ou un PDF passe
    // intact, le recompresser le detruirait.
    var prep = estImage(f)
      ? compresser(f).then(function(b){ return new File([b], (f.name||'photo').replace(/\.[^.]+$/, '') + '.jpg', {type:'image/jpeg'}); })
      : Promise.resolve(f);

    prep.then(envoyerPiece).then(function(p){
      pieces.push(p); enCours = false; piecesRendu();
    }).catch(function(e){
      enCours = false; piecesRendu(e.message);
    });
  },
  ouvrirRangement: function(id){
    if (!id){ rangement = null; rendre(); return; }
    var e = ((D && D.entrees) || []).filter(function(x){ return Number(x.id) === Number(id); })[0];
    if (!e) return;
    rangement = { id: Number(id), etape: e.etape_code || '', poles: (e.poles || []).slice() };
    rendre();
  },
  rangerEtape: function(code){
    if (!rangement) return;
    rangement.etape = code;
    // Le nouveau destinataire ne peut pas rester dans les poles : il y ferait
    // doublon, et le serveur l en retirerait de toute facon.
    rangement.poles = rangement.poles.filter(function(p){ return p !== code; });
    rendre();
  },
  rangerPole: function(code){
    if (!rangement) return;
    var i = rangement.poles.indexOf(code);
    if (i >= 0) rangement.poles.splice(i, 1); else rangement.poles.push(code);
    rendre();
  },
  rangerValider: function(){
    if (!rangement) return;
    var msg = el('fdv-rng-msg');
    if (msg) msg.textContent = 'Rangement\u2026';
    fetch(O.base + '/fiche-de-vie-ranger', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id: rangement.id, etape_code: rangement.etape, poles: rangement.poles })
    }).then(function(r){
      return r.json().catch(function(){ return null; }).then(function(j){
        if (!r.ok || !j || j.ok !== true) throw new Error((j && j.motif) || ('HTTP ' + r.status));
        rangement = null;
        invalider(); return charger();
      });
    }).catch(function(e){
      if (msg) msg.innerHTML = '<span style="color:var(--red)">' + esc(e.message) + '</span>';
    });
  },

  ouvrirPiece: function(chemin){
    // L onglet est ouvert AVANT l appel : l ouvrir apres une reponse asynchrone
    // le ferait passer pour une pop-up et le navigateur le bloquerait.
    var w = window.open('', '_blank');
    fetch(O.base + '/fiche-de-vie-piece-lire?chemin=' + encodeURIComponent(chemin))
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j || j.ok !== true || !j.url) throw new Error((j && j.motif) || 'Lien indisponible.');
        if (w) w.location.href = j.url; else window.location.href = j.url;
      })
      .catch(function(e){
        if (w) w.close();
        alert('Pièce jointe indisponible : ' + e.message);
      });
  },
  retirerPiece: function(i){
    // Retire seulement de la note en cours. Le fichier reste dans le stockage :
    // aucune regle d acces n autorise la suppression, c est voulu.
    pieces.splice(i, 1); piecesRendu();
  },

  ouvrirReponse: function(id, estClient){
    var z = el('fdv-rep-' + id); if (!z) return;
    var ouvert = !z.classList.contains('fdv-hide');
    var tous = document.querySelectorAll('.fdv-rep');
    for (var i = 0; i < tous.length; i++) tous[i].classList.add('fdv-hide');
    if (ouvert) return;
    O._repondA = id; O._repondClient = (estClient === true);
    // Les pieces en cours sont abandonnees : un fichier depose pour la note
    // principale ne doit pas partir avec une reponse, ni l inverse.
    pieces = []; enCours = false; ctxDepot = String(id);
    z.classList.remove('fdv-hide');
    var t = z.querySelector('textarea'); if (t) t.focus();
  },

  repondre: function(id){
    var z = el('fdv-rep-' + id); if (!z) return;
    var ta = z.querySelector('textarea');
    var msg = z.querySelector('.fdv-rep-msg');
    var btn = z.querySelector('button');
    var txt = (ta.value || '').trim();
    if (!txt){ msg.textContent = 'Il faut un texte.'; return; }
    var qq = auteurOuStop(msg); if (!qq) return;
    btn.disabled = true; msg.textContent = 'Enregistrement\u2026';
    poster({
      produit_id: produitId(),
      etape_code: O.etapeDefaut || 'DEVIS',
      auteur: qq,
      texte_brut: txt,
      repond_a: id,
      photos: pieces.length ? pieces.map(function(p){ return p.chemin; }) : null,
      type: O._repondClient ? 'reponse_client' : 'reponse_interne',
      source: O.source || 'atelier'
    }).then(function(){
      O._repondA = null; O._repondClient = false; pieces = [];
      invalider(); return charger();
    }).catch(function(e){
      btn.disabled = false;
      msg.innerHTML = '<span style="color:var(--red)">' + esc(e.message) + '</span>';
    });
  },

  enregistrer: function(){
    var msg = el('fdv-msg'), btn = el('fdv-ok');
    var txt = (el('fdv-txt').value || '').trim();
    if (!txt){ msg.textContent = 'Il faut un texte.'; return; }
    if (!auteurOuStop(msg)) return;
    btn.disabled = true; msg.textContent = 'Enregistrement\u2026';
    var val = function(id){
      var e = el(id); var v = e ? (e.value || '').trim() : '';
      return v || null;
    };
    poster({
      produit_id: produitId(),
      etape_code: O.etapeDefaut || 'DEVIS',
      auteur: auteur(),
      texte_brut: txt,
      repere: val('fdv-repere'),
      mpn: val('fdv-mpn'),
      lien: val('fdv-lien'),
      poles: poles.length ? poles : null,
      // On envoie les CHEMINS : une URL signee expire au bout d une heure.
      photos: pieces.length ? pieces.map(function(p){ return p.chemin; }) : null,
      // Envoye pour les notes seulement : sur une question, le workflow ignore
      // cette cle et deduit la visibilite du type.
      visible_client: (O._type === 'note') ? !!O._visibleClient : undefined,
      type: O._type || 'note',
      source: O.source || 'atelier'
    }).then(function(){
      O._type = 'note'; O._visibleClient = false; poles = []; pieces = []; ctxDepot = '0';
      invalider(); return charger();
    }).catch(function(e){
      btn.disabled = false;
      msg.innerHTML = '<span style="color:var(--red)">' + esc(e.message) + '</span>';
    });
  }
};

})(window);
