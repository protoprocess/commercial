/* =============================================================================
   Proto Process — Mode operatoire integre aux applis
   Version 1.0 — 02/08/2026

   POURQUOI CE FICHIER
   Une notice qui vit ailleurs que dans l outil n est pas lue. Celle-ci s ouvre
   depuis le bandeau, a cote des reglages, au moment ou la question se pose.

   DEUX PUBLICS DANS LA MEME PAGE (choix d Olivier, 02/08) :
     - le MODE OPERATOIRE pour qui s en sert : gestes concrets, aucun terme
       technique, dans l ordre ou on les fait ;
     - CE QUI COINCE : les situations reellement rencontrees, avec ce qu il faut
       faire. C est la partie qu on relit ;
     - LES REGLES : pourquoi c est fait ainsi. Pour comprendre, pas pour executer.

   Volontairement PAS exhaustif : une notice qui decrit chaque bouton n est ni
   lue ni tenue a jour. On decrit le chemin normal et les pieges.

   APPEL — chaque appli fournit SON contenu, le gabarit est commun :
     PPAide.poser({
       titre: 'Analyse dossier client',
       version: APP_VERSION,      // version de l appli, lue automatiquement
       verifiee: '9.8',           // version pour laquelle CE TEXTE a ete relu
       sections: [
         { type:'etapes', titre:'Le parcours', items:[ {titre, texte}, … ] },
         { type:'pieges', titre:'Ce qui coince', items:[ {quoi, faire}, … ] },
         { type:'regles', titre:'Les règles',  items:[ {titre, texte}, … ] }
       ]
     });
   ========================================================================== */
(function (global) {
'use strict';

var VERSION = '1.1';
var CFG = null;

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* CSS injecte par le module : un fichier separe pourrait etre oublie par une
   appli et la page s afficherait sans mise en forme, sans le moindre message.
   Les classes sont prefixees ppa- et n empruntent RIEN a l hote — lecon du
   02/08, ou le module de fiche de vie s appuyait sur des classes absentes
   ailleurs et cassait en silence. */
function css(){
  if (document.getElementById('pp-aide-css')) return;
  var s = document.createElement('style');
  s.id = 'pp-aide-css';
  s.textContent = [
    '.ppa-fond{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9000;',
    '  display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}',
    '.ppa-boite{background:var(--surface,#1a2030);border:1px solid var(--border,#262e42);',
    '  border-radius:10px;max-width:920px;width:100%;padding:0 0 26px}',
    '.ppa-tete{position:sticky;top:0;background:var(--surface,#1a2030);padding:20px 26px 14px;',
    '  border-bottom:1px solid var(--border,#262e42);border-radius:10px 10px 0 0;',
    '  display:flex;align-items:center;gap:12px;z-index:2}',
    '.ppa-t{font-size:18px;font-weight:600;color:var(--blue,#F07B1F);margin:0;flex:1}',
    '.ppa-v{font-size:11px;color:var(--text3,#64748b);font-family:var(--mono,monospace)}',
    '.ppa-x{background:transparent;border:1px solid var(--border,#262e42);color:var(--text2,#94a3b8);',
    '  border-radius:6px;padding:5px 11px;font-size:12px;cursor:pointer;font-family:inherit}',
    '.ppa-x:hover{color:var(--text,#e2e8f0)}',
    '.ppa-c{padding:0 26px}',
    '.ppa-s{margin-top:26px}',
    '.ppa-st{font-size:14px;font-weight:600;color:var(--blue,#F07B1F);margin:0 0 4px;',
    '  display:flex;align-items:center;gap:8px}',
    '.ppa-sd{font-size:12.5px;color:var(--text3,#64748b);margin:0 0 14px}',
    '.ppa-e{display:flex;gap:14px;margin-bottom:15px}',
    '.ppa-n{flex:none;width:25px;height:25px;border-radius:50%;background:var(--blue-bg,#2a1f10);',
    '  color:var(--blue,#F07B1F);display:flex;align-items:center;justify-content:center;',
    '  font-size:12.5px;font-weight:600;margin-top:1px}',
    '.ppa-eh{margin:0 0 3px;font-size:13.5px;font-weight:500;color:var(--text,#e2e8f0)}',
    '.ppa-et{margin:0;font-size:13px;color:var(--text2,#94a3b8);line-height:1.5}',
    '.ppa-p{border-left:3px solid var(--amber-badge,#854F0B);padding:2px 0 2px 14px;margin-bottom:15px}',
    '.ppa-ph{margin:0 0 3px;font-size:13.5px;font-weight:500;color:var(--text,#e2e8f0)}',
    '.ppa-pt{margin:0;font-size:13px;color:var(--text2,#94a3b8);line-height:1.5}',
    '.ppa-r{border-left:3px solid var(--border2,#333d55);padding:2px 0 2px 14px;margin-bottom:15px}',
    '.ppa-code{font-family:var(--mono,monospace);font-size:12.5px;',
    '  background:var(--surface2,#161b27);padding:1px 6px;border-radius:4px}',
    '.ppa-vieux{margin-top:20px;padding:11px 14px;border-radius:6px;font-size:13px;',
    '  background:var(--amber-bg,#FAEEDA);color:var(--amber-badge,#854F0B);font-weight:500}',
    '@media print{.ppa-fond{position:static;background:none;padding:0}',
    '  .ppa-x{display:none}.ppa-boite{border:0}}'
  ].join('\n');
  document.head.appendChild(s);
}

function rendreEtapes(items){
  return items.map(function(it, i){
    return '<div class="ppa-e"><div class="ppa-n">' + (i + 1) + '</div><div>' +
      '<p class="ppa-eh">' + esc(it.titre) + '</p>' +
      '<p class="ppa-et">' + (it.texte || '') + '</p></div></div>';
  }).join('');
}

function rendrePieges(items){
  return items.map(function(it){
    return '<div class="ppa-p"><p class="ppa-ph">' + esc(it.quoi) + '</p>' +
      '<p class="ppa-pt">' + (it.faire || '') + '</p></div>';
  }).join('');
}

function rendreRegles(items){
  return items.map(function(it){
    return '<div class="ppa-r"><p class="ppa-ph">' + esc(it.titre) + '</p>' +
      '<p class="ppa-pt">' + (it.texte || '') + '</p></div>';
  }).join('');
}

function contenu(){
  return (CFG.sections || []).map(function(s){
    var corps = s.type === 'etapes' ? rendreEtapes(s.items || [])
              : s.type === 'pieges' ? rendrePieges(s.items || [])
              : rendreRegles(s.items || []);
    return '<div class="ppa-s"><p class="ppa-st">' + esc(s.titre) + '</p>' +
      (s.intro ? '<p class="ppa-sd">' + s.intro + '</p>' : '') + corps + '</div>';
  }).join('');
}

global.PPAide = {
  VERSION: VERSION,

  poser: function(cfg){ CFG = cfg || {}; css(); },

  // Bouton a placer dans le bandeau, a cote des reglages.
  bouton: function(){
    return '<button class="btn-s" onclick="PPAide.ouvrir()" title="Mode opératoire">' +
      '<i class="ti ti-help"></i> Aide</button>';
  },

  ouvrir: function(){
    if (!CFG) return;
    if (document.getElementById('ppa-fond')) return;

    /* GARDE-FOU CONTRE LA DERIVE. Une notice vieillit sans rien dire : le 03/08,
       cinq versions de devis-client avaient passe sans que le mode operatoire
       bouge, et c est Olivier qui s en est apercu, pas un controle.
       La notice declare desormais pour quelle version elle a ete RELUE. Si
       l appli a bouge depuis, elle le dit elle-meme, en haut, avant tout le
       reste — celui qui la lit sait qu il lit peut-etre du perime. */
    var alerte = '';
    if (CFG.verifiee && CFG.version && String(CFG.verifiee) !== String(CFG.version)) {
      alerte = '<div class="ppa-vieux">Cette notice a été relue pour la version ' +
        esc(CFG.verifiee) + '. L\'application est en version ' + esc(CFG.version) +
        ' : certains passages peuvent être dépassés.</div>';
    }
    var d = document.createElement('div');
    d.id = 'ppa-fond';
    d.className = 'ppa-fond';
    // Un clic hors de la boite referme : on ouvre une notice en passant, on doit
    // pouvoir la refermer sans chercher la croix.
    d.onclick = function(ev){ if (ev.target === d) PPAide.fermer(); };
    d.innerHTML = '<div class="ppa-boite"><div class="ppa-tete">' +
      '<p class="ppa-t">' + esc(CFG.titre || 'Mode opératoire') + '</p>' +
      '<span class="ppa-v">' + (CFG.version ? 'v' + esc(CFG.version) : '') + '</span>' +
      '<button class="ppa-x" onclick="window.print()">Imprimer</button>' +
      '<button class="ppa-x" onclick="PPAide.fermer()">Fermer</button>' +
      '</div><div class="ppa-c">' + alerte + contenu() + '</div></div>';
    document.body.appendChild(d);
    document.addEventListener('keydown', PPAide._echap);
  },

  fermer: function(){
    var d = document.getElementById('ppa-fond');
    if (d) d.remove();
    document.removeEventListener('keydown', PPAide._echap);
  },

  _echap: function(ev){ if (ev.key === 'Escape') PPAide.fermer(); }
};

})(window);
